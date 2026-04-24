import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserClubPermissions } from '../route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const achievements = await db.clubAchievement.findMany({
      where: { clubId: id },
      orderBy: { date: 'desc' },
      include: { creator: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ achievements });
  } catch (error) {
    console.error('Achievements fetch error:', error);
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
    const { title, description, date, icon, category, userId } = body;

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const perms = await getUserClubPermissions(userId, id);
    const user = await db.user.findUnique({ where: { id: userId } });
    const club = await db.club.findUnique({ where: { id } });
    const isExempt = (user?.role === 'ADMIN') || (club?.facultyAdvisorId === userId);

    if (!isExempt && !perms.includes('MANAGE_ACHIEVEMENTS')) {
      return NextResponse.json({ error: 'You do not have permission to manage achievements' }, { status: 403 });
    }
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

    const achievement = await db.clubAchievement.create({
      data: {
        clubId: id, title,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        icon: icon || null, category: category || null,
        createdBy: userId,
      },
    });

    return NextResponse.json({ achievement, message: 'Achievement added successfully' }, { status: 201 });
  } catch (error) {
    console.error('Achievement create error:', error);
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
    const { achievementId, title, description, date, icon, category, userId } = body;

    if (!userId || !achievementId) return NextResponse.json({ error: 'User ID and Achievement ID are required' }, { status: 400 });

    const perms = await getUserClubPermissions(userId, id);
    const user = await db.user.findUnique({ where: { id: userId } });
    const club = await db.club.findUnique({ where: { id } });
    const isExempt = (user?.role === 'ADMIN') || (club?.facultyAdvisorId === userId);

    if (!isExempt && !perms.includes('MANAGE_ACHIEVEMENTS')) {
      return NextResponse.json({ error: 'You do not have permission to manage achievements' }, { status: 403 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = new Date(date);
    if (icon !== undefined) updateData.icon = icon;
    if (category !== undefined) updateData.category = category;

    const achievement = await db.clubAchievement.update({ where: { id: achievementId }, data: updateData });
    return NextResponse.json({ achievement, message: 'Achievement updated successfully' });
  } catch (error) {
    console.error('Achievement update error:', error);
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
    const achievementId = searchParams.get('achievementId');
    const userId = searchParams.get('userId');

    if (!userId || !achievementId) return NextResponse.json({ error: 'User ID and Achievement ID are required' }, { status: 400 });

    const perms = await getUserClubPermissions(userId, id);
    const user = await db.user.findUnique({ where: { id: userId } });
    const club = await db.club.findUnique({ where: { id } });
    const isExempt = (user?.role === 'ADMIN') || (club?.facultyAdvisorId === userId);

    if (!isExempt && !perms.includes('MANAGE_ACHIEVEMENTS')) {
      return NextResponse.json({ error: 'You do not have permission to manage achievements' }, { status: 403 });
    }

    await db.clubAchievement.delete({ where: { id: achievementId } });
    return NextResponse.json({ message: 'Achievement deleted successfully' });
  } catch (error) {
    console.error('Achievement delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
