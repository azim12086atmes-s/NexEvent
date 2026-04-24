import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roles = await db.eventRole.findMany({
      where: { eventId: id },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ roles });
  } catch (error) {
    console.error('Event roles fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, permissions, color, maxAssignees, userId } = body;

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    if (!name) return NextResponse.json({ error: 'Role name is required' }, { status: 400 });

    // Only event organizer or admin/faculty can create event roles
    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const isAuthorized = event.organizerId === userId || user.role === 'ADMIN' || user.role === 'FACULTY';
    // Also check if user has CREATE_CLUB_EVENT permission via club
    if (!isAuthorized && event.clubId) {
      const clubPerms = await getClubEventPerms(userId, event.clubId);
      if (clubPerms.includes('CREATE_CLUB_EVENT')) {
        // They can create events for the club, so they can create event roles too
      } else {
        return NextResponse.json({ error: 'Not authorized to create event roles' }, { status: 403 });
      }
    } else if (!isAuthorized) {
      return NextResponse.json({ error: 'Not authorized to create event roles' }, { status: 403 });
    }

    const role = await db.eventRole.create({
      data: {
        eventId: id,
        name,
        description: description || null,
        permissions: JSON.stringify(permissions || []),
        color: color || null,
        maxAssignees: maxAssignees || null,
        createdBy: userId,
      },
      include: { creator: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ role, message: 'Event role created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Event role create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { roleId, name, description, permissions, color, maxAssignees, userId } = body;

    if (!userId || !roleId) return NextResponse.json({ error: 'User ID and Role ID are required' }, { status: 400 });

    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const user = await db.user.findUnique({ where: { id: userId } });
    const isAuthorized = event.organizerId === userId || user?.role === 'ADMIN' || user?.role === 'FACULTY';
    if (!isAuthorized) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const existing = await db.eventRole.findFirst({ where: { id: roleId, eventId: id } });
    if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);
    if (color !== undefined) updateData.color = color;
    if (maxAssignees !== undefined) updateData.maxAssignees = maxAssignees;

    const role = await db.eventRole.update({ where: { id: roleId }, data: updateData });
    return NextResponse.json({ role, message: 'Role updated' });
  } catch (error) {
    console.error('Event role update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');
    const userId = searchParams.get('userId');

    if (!userId || !roleId) return NextResponse.json({ error: 'User ID and Role ID are required' }, { status: 400 });

    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const user = await db.user.findUnique({ where: { id: userId } });
    const isAuthorized = event.organizerId === userId || user?.role === 'ADMIN' || user?.role === 'FACULTY';
    if (!isAuthorized) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    await db.eventRole.delete({ where: { id: roleId } });
    return NextResponse.json({ message: 'Role deleted' });
  } catch (error) {
    console.error('Event role delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getClubEventPerms(userId: string, clubId: string): Promise<string[]> {
  const user = await db.user.findUnique({ where: { id: userId } });
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!user || !club) return [];
  if (user.role === 'ADMIN' || club.facultyAdvisorId === userId) {
    return ['EDIT_CLUB_PAGE', 'CREATE_CLUB_EVENT', 'MANAGE_MEMBERS', 'MANAGE_ROLES', 'VIEW_ANALYTICS', 'MANAGE_ACHIEVEMENTS'];
  }
  const assignments = await db.clubRoleAssignment.findMany({
    where: { userId, clubId },
    include: { role: true },
  });
  const permissions = new Set<string>();
  for (const a of assignments) {
    try { JSON.parse(a.role.permissions).forEach((p: string) => permissions.add(p)); } catch {}
  }
  const membership = await db.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
  if (membership && ['president', 'secretary'].includes(membership.role)) {
    ['EDIT_CLUB_PAGE', 'CREATE_CLUB_EVENT', 'VIEW_ANALYTICS', 'MANAGE_ACHIEVEMENTS'].forEach(p => permissions.add(p));
  }
  return Array.from(permissions);
}
