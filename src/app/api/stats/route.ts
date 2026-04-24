import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    // For unauthenticated/demo access, return public stats
    if (!userId || userId === 'demo') {
      const [totalEvents, totalClubs, totalRegistrations, activeEvents] = await Promise.all([
        db.event.count({ where: { status: { in: ['APPROVED', 'LIVE', 'COMPLETED'] } } }),
        db.club.count({ where: { isActive: true } }),
        db.eventRegistration.count({ where: { status: { not: 'CANCELLED' } } }),
        db.event.count({ where: { status: { in: ['APPROVED', 'LIVE'] }, startDate: { gte: new Date() } } }),
      ]);

      return NextResponse.json({
        stats: {
          totalEvents,
          activeEvents,
          totalClubs,
          totalRegistrations,
          userRegistrations: 0,
          userOrganizedEvents: 0,
          pendingApprovals: 0,
          categoryBreakdown: [],
        },
      });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Return basic stats even if user not found
      const [totalEvents, totalClubs] = await Promise.all([
        db.event.count({ where: { status: { in: ['APPROVED', 'LIVE', 'COMPLETED'] } } }),
        db.club.count({ where: { isActive: true } }),
      ]);
      return NextResponse.json({
        stats: { totalEvents, activeEvents: 0, totalClubs, totalRegistrations: 0, userRegistrations: 0, userOrganizedEvents: 0, pendingApprovals: 0, categoryBreakdown: [] },
      });
    }

    const [
      totalEvents,
      activeEvents,
      totalClubs,
      totalRegistrations,
      userRegistrations,
      userOrganizedEvents,
      pendingApprovals,
    ] = await Promise.all([
      db.event.count({ where: { status: { in: ['APPROVED', 'LIVE', 'COMPLETED'] } } }),
      db.event.count({ where: { status: { in: ['APPROVED', 'LIVE'] }, startDate: { gte: new Date() } } }),
      db.club.count({ where: { isActive: true } }),
      db.eventRegistration.count({ where: { status: { not: 'CANCELLED' } } }),
      db.eventRegistration.count({ where: { userId, status: { not: 'CANCELLED' } } }),
      db.event.count({ where: { organizerId: userId } }),
      ['FACULTY', 'ADMIN'].includes(user.role)
        ? db.event.count({ where: { status: 'PENDING_APPROVAL' } })
        : Promise.resolve(0),
    ]);

    const categoryBreakdown = await db.event.groupBy({
      by: ['category'],
      where: { status: { in: ['APPROVED', 'LIVE', 'COMPLETED'] } },
      _count: { category: true },
    });

    return NextResponse.json({
      stats: {
        totalEvents,
        activeEvents,
        totalClubs,
        totalRegistrations,
        userRegistrations,
        userOrganizedEvents,
        pendingApprovals,
        categoryBreakdown: categoryBreakdown.map(c => ({
          category: c.category,
          count: c._count.category,
        })),
      },
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
