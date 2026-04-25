import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// GET - Get AICTE points for a user with breakdown
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requestorId = searchParams.get('requestorId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Permission check: admin/faculty/HOD can see any user, students only their own
    if (requestorId && requestorId !== userId) {
      const requestor = await db.user.findUnique({ where: { id: requestorId } });
      if (!requestor || !['ADMIN', 'FACULTY', 'HOD'].includes(requestor.role)) {
        return NextResponse.json({ error: 'Not authorized to view other users\' points' }, { status: 403 });
      }
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, aictePoints: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build breakdown: events where user earned AICTE points
    // We determine this from:
    // 1. Event registrations for events with aictePoints set + user has attendance
    // 2. Event role assignments for volunteer points

    const registrations = await db.eventRegistration.findMany({
      where: {
        userId,
        status: { in: ['REGISTERED', 'CONFIRMED'] },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            category: true,
            startDate: true,
            aictePoints: true,
            volunteerAictePoints: true,
          },
        },
        attendance: {
          select: { id: true, status: true },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });

    const breakdown: {
      eventId: string;
      eventTitle: string;
      category: string;
      date: string;
      points: number;
      type: 'participation' | 'volunteer';
    }[] = [];

    for (const reg of registrations) {
      const ev = reg.event;
      // Participation points: awarded if user attended (has attendance record)
      if (ev.aictePoints && ev.aictePoints > 0 && reg.attendance) {
        breakdown.push({
          eventId: ev.id,
          eventTitle: ev.title,
          category: ev.category,
          date: ev.startDate,
          points: ev.aictePoints,
          type: 'participation',
        });
      }
    }

    // Volunteer points from event role assignments
    const volunteerAssignments = await db.eventRoleAssignment.findMany({
      where: { userId },
      include: {
        role: {
          select: { name: true, eventId: true },
        },
      },
    });

    // Get unique event IDs from volunteer assignments
    const volunteerEventIds = [...new Set(volunteerAssignments.map(a => a.role.eventId))];
    const volunteerEvents = await db.event.findMany({
      where: { id: { in: volunteerEventIds } },
      select: { id: true, title: true, category: true, startDate: true, volunteerAictePoints: true },
    });

    for (const ev of volunteerEvents) {
      if (ev.volunteerAictePoints && ev.volunteerAictePoints > 0) {
        breakdown.push({
          eventId: ev.id,
          eventTitle: ev.title,
          category: ev.category,
          date: ev.startDate,
          points: ev.volunteerAictePoints,
          type: 'volunteer',
        });
      }
    }

    // Calculate total from breakdown (actual earned)
    const earnedTotal = breakdown.reduce((sum, b) => sum + b.points, 0);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        aictePoints: user.aictePoints,
      },
      totalPoints: user.aictePoints,
      earnedPoints: earnedTotal,
      breakdown,
      summary: {
        participationEvents: breakdown.filter(b => b.type === 'participation').length,
        volunteerEvents: breakdown.filter(b => b.type === 'volunteer').length,
        totalBreakdownPoints: earnedTotal,
      },
    });
  } catch (error) {
    console.error('AICTE points GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// POST - Award AICTE points to a user
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eventId, points, reason, awardedBy } = body;

    if (!userId || !points || points <= 0) {
      return NextResponse.json({ error: 'User ID and positive points value are required' }, { status: 400 });
    }

    // Permission check
    const awarder = awardedBy ? await db.user.findUnique({ where: { id: awardedBy } }) : null;
    if (!awarder || !['ADMIN', 'FACULTY', 'HOD'].includes(awarder.role)) {
      return NextResponse.json({ error: 'Only faculty, HOD, or admins can award AICTE points' }, { status: 403 });
    }

    // Verify user exists
    const targetUser = await db.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user's AICTE points
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { aictePoints: { increment: points } },
      select: { id: true, name: true, aictePoints: true },
    });

    // Create notification for the user
    if (eventId) {
      const event = await db.event.findUnique({ where: { id: eventId } });
      if (event) {
        await db.notification.create({
          data: {
            userId,
            title: 'AICTE Points Awarded! 🏆',
            message: `You earned ${points} AICTE points for "${event.title}"${reason ? ` - ${reason}` : ''}`,
            type: 'success',
          },
        });
      }
    } else {
      await db.notification.create({
        data: {
          userId,
          title: 'AICTE Points Awarded! 🏆',
          message: `You earned ${points} AICTE points${reason ? ` - ${reason}` : ''}`,
          type: 'success',
        },
      });
    }

    return NextResponse.json({
      message: `Awarded ${points} AICTE points to ${updatedUser.name}`,
      user: updatedUser,
      pointsAwarded: points,
    });
  } catch (error) {
    console.error('AICTE points POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
