import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const members = await db.clubMember.findMany({
      where: { clubId: id },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, usn: true, department: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return NextResponse.json({ members });
  } catch (error) {
    console.error('Members fetch error:', error);
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
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const club = await db.club.findUnique({ where: { id } });
    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 });
    }

    const existing = await db.clubMember.findUnique({
      where: { userId_clubId: { userId, clubId: id } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Already a member of this club' }, { status: 409 });
    }

    const member = await db.clubMember.create({
      data: { userId, clubId: id, role: 'member' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ member, message: 'Joined club successfully' }, { status: 201 });
  } catch (error) {
    console.error('Join club error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const existing = await db.clubMember.findUnique({
      where: { userId_clubId: { userId, clubId: id } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not a member of this club' }, { status: 404 });
    }

    await db.clubMember.delete({ where: { id: existing.id } });

    return NextResponse.json({ message: 'Left club successfully' });
  } catch (error) {
    console.error('Leave club error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
