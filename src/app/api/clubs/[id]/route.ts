import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const club = await db.club.findUnique({
      where: { id },
      include: {
        facultyAdvisor: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        events: {
          where: { status: { in: ['APPROVED', 'LIVE'] } },
          take: 5,
          orderBy: { startDate: 'asc' },
          include: { _count: { select: { registrations: true } } },
        },
        roles: {
          include: {
            assignments: {
              include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            },
            creator: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        achievements: {
          orderBy: { date: 'desc' },
        },
        roleAssignments: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            role: true,
          },
        },
        _count: { select: { members: true, events: true } },
      },
    });

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    return NextResponse.json({ club });
  } catch (error) {
    console.error('Club fetch error:', error);
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
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const club = await db.club.findUnique({ where: { id } });
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    // Check permissions
    const permissions = await getUserClubPermissions(userId, id);
    const canEditPage = permissions.includes('EDIT_CLUB_PAGE');

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const isAuthorized = canEditPage || user.role === 'ADMIN' || club.facultyAdvisorId === userId;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Not authorized to edit this club' }, { status: 403 });
    }

    const allowedFields = ['name', 'description', 'mission', 'vision', 'highlights', 'socialLinks', 'contactEmail', 'contactPhone', 'category', 'foundedYear'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const updatedClub = await db.club.update({
      where: { id },
      data: updateData,
      include: {
        facultyAdvisor: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, events: true } },
      },
    });

    return NextResponse.json({ club: updatedClub, message: 'Club updated successfully' });
  } catch (error) {
    console.error('Club update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: get user permissions for a club
export async function getUserClubPermissions(userId: string, clubId: string): Promise<string[]> {
  const ALL_PERMISSIONS = ['EDIT_CLUB_PAGE', 'CREATE_CLUB_EVENT', 'MANAGE_MEMBERS', 'MANAGE_ROLES', 'VIEW_ANALYTICS', 'MANAGE_ACHIEVEMENTS'];

  const user = await db.user.findUnique({ where: { id: userId } });
  const club = await db.club.findUnique({ where: { id: clubId } });
  if (!user || !club) return [];

  // Admin and faculty advisor get all permissions
  if (user.role === 'ADMIN' || club.facultyAdvisorId === userId) {
    return ALL_PERMISSIONS;
  }

  // Get permissions from assigned custom roles
  const assignments = await db.clubRoleAssignment.findMany({
    where: { userId, clubId },
    include: { role: true },
  });

  const permissions = new Set<string>();
  for (const assignment of assignments) {
    try {
      const rolePerms = JSON.parse(assignment.role.permissions);
      rolePerms.forEach((p: string) => permissions.add(p));
    } catch { /* ignore parse errors */ }
  }

  // President/secretary get base permissions
  const membership = await db.clubMember.findUnique({
    where: { userId_clubId: { userId, clubId } },
  });
  if (membership && ['president', 'secretary'].includes(membership.role)) {
    ['EDIT_CLUB_PAGE', 'CREATE_CLUB_EVENT', 'VIEW_ANALYTICS', 'MANAGE_ACHIEVEMENTS'].forEach(p => permissions.add(p));
  }

  return Array.from(permissions);
}
