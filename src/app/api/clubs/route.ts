import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const clubs = await db.club.findMany({
      where: { isActive: true },
      include: {
        facultyAdvisor: { select: { id: true, name: true, email: true } },
        members: { select: { id: true, userId: true, role: true, user: { select: { id: true, name: true } } } },
        _count: { select: { members: true, events: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ clubs });
  } catch (error) {
    console.error('Clubs fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !['FACULTY', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Only faculty or admins can create clubs' }, { status: 403 });
    }

    const { name, description, category, facultyAdvisorId, foundedYear } = body;

    if (!name || !description) {
      return NextResponse.json({ error: 'Name and description are required' }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') + '-' + Date.now().toString(36);

    const club = await db.club.create({
      data: {
        name,
        slug,
        description,
        category: category || 'OTHER',
        facultyAdvisorId: facultyAdvisorId || userId,
        foundedYear: foundedYear || new Date().getFullYear(),
      },
      include: {
        facultyAdvisor: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ club, message: 'Club created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Club creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
