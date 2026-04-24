import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserClubPermissions } from '../../route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { clubRoleId, userId: targetUserId, assignedBy } = body;

    if (!clubRoleId || !targetUserId || !assignedBy) {
      return NextResponse.json({ error: 'Role ID, target user ID, and assigner ID are required' }, { status: 400 });
    }

    // Get the role being assigned
    const role = await db.clubRole.findFirst({
      where: { id: clubRoleId, clubId: id },
    });
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Check if assigner has MANAGE_ROLES permission
    const assignerPerms = await getUserClubPermissions(assignedBy, id);
    const assignerUser = await db.user.findUnique({ where: { id: assignedBy } });
    const club = await db.club.findUnique({ where: { id } });
    const isExempt = (assignerUser?.role === 'ADMIN') || (club?.facultyAdvisorId === assignedBy);

    if (!isExempt && !assignerPerms.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'You do not have permission to assign roles' }, { status: 403 });
    }

    // DELEGATION RULE: Cannot grant permissions you don't have yourself
    if (!isExempt) {
      const rolePermissions: string[] = JSON.parse(role.permissions || '[]');
      const missingPerms = rolePermissions.filter(p => !assignerPerms.includes(p));
      if (missingPerms.length > 0) {
        return NextResponse.json({
          error: `Cannot assign role: You don't have these permissions yourself: ${missingPerms.join(', ')}`,
          missingPermissions: missingPerms,
        }, { status: 403 });
      }
    }

    // Check if already assigned
    const existing = await db.clubRoleAssignment.findUnique({
      where: { clubRoleId_userId: { clubRoleId, userId: targetUserId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'User already has this role' }, { status: 409 });
    }

    // Verify target user is a member of the club
    const membership = await db.clubMember.findUnique({
      where: { userId_clubId: { userId: targetUserId, clubId: id } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Target user is not a member of this club' }, { status: 400 });
    }

    const assignment = await db.clubRoleAssignment.create({
      data: {
        clubRoleId,
        userId: targetUserId,
        clubId: id,
        assignedBy,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        role: true,
      },
    });

    return NextResponse.json({ assignment, message: 'Role assigned successfully' }, { status: 201 });
  } catch (error) {
    console.error('Club role assign error:', error);
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
    const { clubRoleId, userId: targetUserId, revokedBy } = body;

    if (!clubRoleId || !targetUserId || !revokedBy) {
      return NextResponse.json({ error: 'Role ID, target user ID, and revoker ID are required' }, { status: 400 });
    }

    // Check permission
    const revokerPerms = await getUserClubPermissions(revokedBy, id);
    const revokerUser = await db.user.findUnique({ where: { id: revokedBy } });
    const club = await db.club.findUnique({ where: { id } });
    const isExempt = (revokerUser?.role === 'ADMIN') || (club?.facultyAdvisorId === revokedBy);

    if (!isExempt && !revokerPerms.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'You do not have permission to revoke roles' }, { status: 403 });
    }

    const existing = await db.clubRoleAssignment.findUnique({
      where: { clubRoleId_userId: { clubRoleId, userId: targetUserId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await db.clubRoleAssignment.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ message: 'Role revoked successfully' });
  } catch (error) {
    console.error('Club role revoke error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
