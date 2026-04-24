import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserClubPermissions } from '../route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roles = await db.clubRole.findMany({
      where: { clubId: id },
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
    console.error('Club roles fetch error:', error);
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
    const { name, description, permissions, color, userId, isDefault } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Check permission
    const userPerms = await getUserClubPermissions(userId, id);
    if (!userPerms.includes('MANAGE_ROLES')) {
      const user = await db.user.findUnique({ where: { id: userId } });
      const club = await db.club.findUnique({ where: { id } });
      if (!user || user.role !== 'ADMIN' || !club || club.facultyAdvisorId !== userId) {
        return NextResponse.json({ error: 'You do not have permission to manage roles' }, { status: 403 });
      }
    }

    const club = await db.club.findUnique({ where: { id } });
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    const role = await db.clubRole.create({
      data: {
        clubId: id,
        name,
        description: description || null,
        permissions: JSON.stringify(permissions || []),
        color: color || null,
        isDefault: isDefault || false,
        createdBy: userId,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ role, message: 'Role created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Club role create error:', error);
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
    const { roleId, name, description, permissions, color, userId } = body;

    if (!userId || !roleId) {
      return NextResponse.json({ error: 'User ID and Role ID are required' }, { status: 400 });
    }

    const userPerms = await getUserClubPermissions(userId, id);
    if (!userPerms.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'You do not have permission to manage roles' }, { status: 403 });
    }

    const existing = await db.clubRole.findFirst({ where: { id: roleId, clubId: id } });
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);
    if (color !== undefined) updateData.color = color;

    const role = await db.clubRole.update({
      where: { id: roleId },
      data: updateData,
    });

    return NextResponse.json({ role, message: 'Role updated successfully' });
  } catch (error) {
    console.error('Club role update error:', error);
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

    if (!userId || !roleId) {
      return NextResponse.json({ error: 'User ID and Role ID are required' }, { status: 400 });
    }

    const userPerms = await getUserClubPermissions(userId, id);
    if (!userPerms.includes('MANAGE_ROLES')) {
      return NextResponse.json({ error: 'You do not have permission to manage roles' }, { status: 403 });
    }

    const existing = await db.clubRole.findFirst({ where: { id: roleId, clubId: id } });
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    await db.clubRole.delete({ where: { id: roleId } });
    return NextResponse.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Club role delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
