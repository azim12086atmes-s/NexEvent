import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isWithinGeoFence } from '@/lib/geo';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { qrCode, latitude, longitude } = body;
    const scannerUserId = body.userId;

    if (!scannerUserId || !qrCode) {
      return NextResponse.json({ error: 'Scanner user ID and QR code are required' }, { status: 400 });
    }

    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!['LIVE', 'APPROVED'].includes(event.status)) {
      return NextResponse.json({ error: 'Event is not active for check-in' }, { status: 400 });
    }

    // Verify scanner has permission (faculty/HOD/admin or event role with CHECK_IN_ATTENDEES)
    const scanner = await db.user.findUnique({ where: { id: scannerUserId } });
    if (!scanner) {
      return NextResponse.json({ error: 'Scanner user not found' }, { status: 401 });
    }

    const hasBasePermission = ['FACULTY', 'HOD', 'ADMIN'].includes(scanner.role);
    let hasEventRolePermission = false;

    if (!hasBasePermission) {
      // Check if scanner has an event role with CHECK_IN_ATTENDEES permission
      const scannerAssignments = await db.eventRoleAssignment.findMany({
        where: { userId: scannerUserId },
        include: { role: { where: { eventId: id } } },
      });

      for (const assignment of scannerAssignments) {
        if (assignment.role) {
          try {
            const perms: string[] = JSON.parse(assignment.role.permissions || '[]');
            if (perms.includes('CHECK_IN_ATTENDEES')) {
              hasEventRolePermission = true;
              break;
            }
          } catch { /* ignore parse errors */ }
        }
      }
    }

    if (!hasBasePermission && !hasEventRolePermission) {
      return NextResponse.json({ error: 'You do not have permission to check in attendees' }, { status: 403 });
    }

    // Find the registration by QR code for this event (FIX: was using scanner's userId before)
    const registration = await db.eventRegistration.findFirst({
      where: { eventId: id, qrCode: qrCode },
      include: { user: { select: { id: true, name: true, email: true, usn: true, department: true } } },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Invalid QR code for this event' }, { status: 404 });
    }

    if (registration.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Registration has been cancelled' }, { status: 400 });
    }

    // The student who registered
    const studentUserId = registration.userId;

    // Check if already checked in
    const existingAttendance = await db.attendance.findUnique({
      where: { registrationId: registration.id },
    });

    if (existingAttendance) {
      return NextResponse.json({
        error: 'Already checked in',
        attendance: existingAttendance,
        student: registration.user,
      }, { status: 409 });
    }

    // Geo-fencing check
    let isWithinFence = true;
    if (event.venueLat && event.venueLng && event.geoFenceRadius && latitude && longitude) {
      isWithinFence = isWithinGeoFence(
        latitude, longitude,
        event.venueLat, event.venueLng,
        event.geoFenceRadius
      );
    }

    // Determine if late (after 15 minutes from event start)
    const now = new Date();
    const eventStart = new Date(event.startDate);
    const isLate = now > new Date(eventStart.getTime() + 15 * 60 * 1000);

    const attendance = await db.attendance.create({
      data: {
        registrationId: registration.id,
        eventId: id,
        userId: studentUserId, // FIX: use student's ID, not scanner's
        status: isLate ? 'LATE' : 'PRESENT',
        checkInTime: now,
        checkInLat: latitude || null,
        checkInLng: longitude || null,
        isWithinGeoFence: isWithinFence,
        notes: !isWithinFence ? 'Checked in outside geo-fence radius' : null,
      },
    });

    // Auto-award AICTE points if event has them configured
    let aictePointsAwarded = 0;
    if (event.aictePoints && event.aictePoints > 0) {
      try {
        await db.user.update({
          where: { id: studentUserId }, // FIX: award points to student, not scanner
          data: { aictePoints: { increment: event.aictePoints } },
        });
        aictePointsAwarded = event.aictePoints;

        // Notify student about AICTE points
        await db.notification.create({
          data: {
            userId: studentUserId, // FIX: notify student, not scanner
            title: 'AICTE Points Awarded! 🏆',
            message: `You earned ${event.aictePoints} AICTE points for attending "${event.title}"`,
            type: 'success',
          },
        });
      } catch (e) {
        console.error('AICTE points award error:', e);
        // Don't fail check-in if points award fails
      }
    }

    return NextResponse.json({
      attendance,
      student: registration.user,
      aictePointsAwarded,
      message: isWithinFence
        ? (isLate ? 'Checked in (Late)' : 'Checked in successfully')
        : 'Warning: You are outside the event venue radius. Attendance flagged.',
    }, { status: 201 });
  } catch (error) {
    console.error('Attendance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const recent = searchParams.get('recent');

    // If userId is provided, return only that user's attendance record
    // This is used by students to check their own attendance
    if (userId && !recent) {
      const attendance = await db.attendance.findFirst({
        where: { eventId: id, userId },
        include: {
          user: { select: { id: true, name: true, email: true, usn: true, department: true } },
        },
      });

      if (!attendance) {
        return NextResponse.json({ attendance: null });
      }

      return NextResponse.json({
        attendance: {
          ...attendance,
          attendancePercentage: Math.round(attendance.attendancePercentage),
        },
      });
    }

    // Otherwise return all attendances (organizer view)
    // Support ?recent=N to get last N check-ins
    const limit = recent ? parseInt(recent) || 10 : undefined;

    const attendances = await db.attendance.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, name: true, email: true, usn: true, department: true } },
      },
      orderBy: { checkInTime: 'desc' },
      ...(limit ? { take: limit } : {}),
    });

    return NextResponse.json({ attendances });
  } catch (error) {
    console.error('Attendance fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
