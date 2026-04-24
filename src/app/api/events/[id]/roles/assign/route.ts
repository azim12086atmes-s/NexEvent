import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { eventRoleId, userId: targetUserId, assignedBy } = body;

    if (!eventRoleId || !targetUserId || !assignedBy) {
      return NextResponse.json({ error: 'Role ID, target user ID, and assigner ID are required' }, { status: 400 });
    }

    const role = await db.eventRole.findFirst({ where: { id: eventRoleId, eventId: id } });
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

    // Check assigner is authorized
    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const assigner = await db.user.findUnique({ where: { id: assignedBy } });
    const isOrganizer = event.organizerId === assignedBy;
    const isPrivileged = assigner?.role === 'ADMIN' || assigner?.role === 'FACULTY';

    if (!isOrganizer && !isPrivileged) {
      // Check if assigner has MANAGE_EVENT_ROLES permission via their own event role
      const assignerRoles = await db.eventRoleAssignment.findMany({
        where: { userId: assignedBy, role: { eventId: id } },
        include: { role: true },
      });
      const assignerPerms = new Set<string>();
      for (const a of assignerRoles) {
        try { JSON.parse(a.role.permissions).forEach((p: string) => assignerPerms.add(p)); } catch {}
      }

      if (!assignerPerms.has('MANAGE_EVENT_ROLES')) {
        return NextResponse.json({ error: 'You do not have permission to assign event roles' }, { status: 403 });
      }

      // Delegation rule: cannot grant permissions you don't have
      const rolePermissions: string[] = JSON.parse(role.permissions || '[]');
      const missingPerms = rolePermissions.filter(p => !assignerPerms.has(p));
      if (missingPerms.length > 0) {
        return NextResponse.json({
          error: `Cannot assign role: You don't have these permissions: ${missingPerms.join(', ')}`,
          missingPermissions: missingPerms,
        }, { status: 403 });
      }
    }

    // Check max assignees
    if (role.maxAssignees) {
      const currentCount = await db.eventRoleAssignment.count({
        where: { eventRoleId },
      });
      if (currentCount >= role.maxAssignees) {
        return NextResponse.json({ error: `Role already has maximum ${role.maxAssignees} assignees` }, { status: 400 });
      }
    }

    // Check if already assigned
    const existing = await db.eventRoleAssignment.findUnique({
      where: { eventRoleId_userId: { eventRoleId, userId: targetUserId } },
    });
    if (existing) return NextResponse.json({ error: 'User already has this role' }, { status: 409 });

    const assignment = await db.eventRoleAssignment.create({
      data: { eventRoleId, userId: targetUserId, assignedBy },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        role: true,
      },
    });

    return NextResponse.json({ assignment, message: 'Role assigned successfully' }, { status: 201 });
  } catch (error) {
    console.error('Event role assign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { eventRoleId, userId: targetUserId, revokedBy } = body;

    if (!eventRoleId || !targetUserId || !revokedBy) {
      return NextResponse.json({ error: 'Role ID, target user ID, and revoker ID are required' }, { status: 400 });
    }

    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const revoker = await db.user.findUnique({ where: { id: revokedBy } });
    const isOrganizer = event.organizerId === revokedBy;
    const isPrivileged = revoker?.role === 'ADMIN' || revoker?.role === 'FACULTY';

    if (!isOrganizer && !isPrivileged) {
      const revokerRoles = await db.eventRoleAssignment.findMany({
        where: { userId: revokedBy, role: { eventId: id } },
        include: { role: true },
      });
      const revokerPerms = new Set<string>();
      for (const a of revokerRoles) {
        try { JSON.parse(a.role.permissions).forEach((p: string) => revokerPerms.add(p)); } catch {}
      }
      if (!revokerPerms.has('MANAGE_EVENT_ROLES')) {
        return NextResponse.json({ error: 'You do not have permission to revoke event roles' }, { status: 403 });
      }
    }

    const existing = await db.eventRoleAssignment.findUnique({
      where: { eventRoleId_userId: { eventRoleId, userId: targetUserId } },
    });
    if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

    await db.eventRoleAssignment.delete({ where: { id: existing.id } });
    return NextResponse.json({ message: 'Role revoked successfully' });
  } catch (error) {
    console.error('Event role revoke error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
