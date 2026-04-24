import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const status = request.nextUrl.searchParams.get('status');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const where: any = { userId };
    if (status) where.status = status;

    const registrations = await db.eventRegistration.findMany({
      where,
      include: {
        event: {
          include: {
            organizer: { select: { id: true, name: true } },
            club: { select: { id: true, name: true, logo: true } },
            _count: { select: { registrations: true } },
          },
        },
        attendance: true,
      },
      orderBy: { registeredAt: 'desc' },
    });

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error('User events fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
