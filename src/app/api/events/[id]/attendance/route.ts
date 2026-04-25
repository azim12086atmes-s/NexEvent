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

    const scanner = await db.user.findUnique({ where: { id: scannerUserId } });
    if (!scanner) {
      return NextResponse.json({ error: 'Scanner user not found' }, { status: 401 });
    }

    // ===== NEXEVENT-CHECKIN-{eventId} format: student self-check-in =====
    if (qrCode.startsWith('NEXEVENT-CHECKIN-')) {
      const checkinEventId = qrCode.replace('NEXEVENT-CHECKIN-', '');

      // Verify the event ID matches the URL
      if (checkinEventId !== id) {
        return NextResponse.json({ error: 'QR code does not match this event' }, { status: 400 });
      }

      // Any registered user (including STUDENT) can self-check-in
      const registration = await db.eventRegistration.findFirst({
        where: { eventId: id, userId: scannerUserId, status: { not: 'CANCELLED' } },
        include: { user: { select: { id: true, name: true, email: true, usn: true, department: true } } },
      });

      if (!registration) {
        return NextResponse.json({ error: 'You are not registered for this event' }, { status: 404 });
      }

      // Check if already has an attendance record
      const existingAttendance = await db.attendance.findUnique({
        where: { registrationId: registration.id },
      });

      if (existingAttendance) {
        if (existingAttendance.status === 'CHECKED_OUT') {
          return NextResponse.json({
            error: 'You have already checked out of this event',
            attendance: existingAttendance,
            student: registration.user,
          }, { status: 409 });
        }

        // Already checked in (PRESENT/LATE) — treat as check-out
        const now = new Date();
        const checkInTime = new Date(existingAttendance.checkInTime);
        const durationMs = now.getTime() - checkInTime.getTime();
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        const eventDurationMs = eventEnd.getTime() - eventStart.getTime();

        // Calculate attendance percentage based on time spent vs event duration
        let attendancePercentage = 0;
        if (eventDurationMs > 0) {
          attendancePercentage = Math.min(100, Math.round((durationMs / eventDurationMs) * 100));
        }

        const updatedAttendance = await db.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            status: 'CHECKED_OUT',
            checkOutTime: now,
            attendancePercentage,
          },
        });

        return NextResponse.json({
          attendance: updatedAttendance,
          student: registration.user,
          isCheckOut: true,
          message: `Checked out successfully. Attendance: ${attendancePercentage}%`,
        }, { status: 200 });
      }

      // No existing attendance — create check-in
      let isWithinFence = true;
      if (event.venueLat && event.venueLng && event.geoFenceRadius && latitude && longitude) {
        isWithinFence = isWithinGeoFence(
          latitude, longitude,
          event.venueLat, event.venueLng,
          event.geoFenceRadius
        );
      }

      const now = new Date();
      const eventStart = new Date(event.startDate);
      const isLate = now > new Date(eventStart.getTime() + 15 * 60 * 1000);

      const attendance = await db.attendance.create({
        data: {
          registrationId: registration.id,
          eventId: id,
          userId: scannerUserId,
          status: isLate ? 'LATE' : 'PRESENT',
          checkInTime: now,
          checkInLat: latitude || null,
          checkInLng: longitude || null,
          isWithinGeoFence: isWithinFence,
          notes: !isWithinFence ? 'Self check-in outside geo-fence radius' : 'Self check-in via event QR code',
        },
      });

      // Auto-award AICTE points if event has them configured
      let aictePointsAwarded = 0;
      if (event.aictePoints && event.aictePoints > 0) {
        try {
          await db.user.update({
            where: { id: scannerUserId },
            data: { aictePoints: { increment: event.aictePoints } },
          });
          aictePointsAwarded = event.aictePoints;

          await db.notification.create({
            data: {
              userId: scannerUserId,
              title: 'AICTE Points Awarded! 🏆',
              message: `You earned ${event.aictePoints} AICTE points for attending "${event.title}"`,
              type: 'success',
            },
          });
        } catch (e) {
          console.error('AICTE points award error:', e);
        }
      }

      return NextResponse.json({
        attendance,
        student: registration.user,
        isSelfCheckIn: true,
        aictePointsAwarded,
        message: isWithinFence
          ? (isLate ? 'Checked in (Late) via event QR' : 'Self check-in successful!')
          : 'Warning: You are outside the event venue radius. Attendance flagged.',
      }, { status: 201 });
    }

    // ===== Standard NEXEVENT-{eventId}-{userId}-{timestamp} format: faculty/staff scanning student QR =====
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

    // Find the registration by QR code for this event
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

    const studentUserId = registration.userId;

    // Check if already has an attendance record
    const existingAttendance = await db.attendance.findUnique({
      where: { registrationId: registration.id },
    });

    if (existingAttendance) {
      if (existingAttendance.status === 'CHECKED_OUT') {
        return NextResponse.json({
          error: 'Student has already checked out of this event',
          attendance: existingAttendance,
          student: registration.user,
        }, { status: 409 });
      }

      // Already checked in (PRESENT/LATE) — treat as check-out
      const now = new Date();
      const checkInTime = new Date(existingAttendance.checkInTime);
      const durationMs = now.getTime() - checkInTime.getTime();
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const eventDurationMs = eventEnd.getTime() - eventStart.getTime();

      let attendancePercentage = 0;
      if (eventDurationMs > 0) {
        attendancePercentage = Math.min(100, Math.round((durationMs / eventDurationMs) * 100));
      }

      const updatedAttendance = await db.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: 'CHECKED_OUT',
          checkOutTime: now,
          attendancePercentage,
        },
      });

      return NextResponse.json({
        attendance: updatedAttendance,
        student: registration.user,
        isCheckOut: true,
        message: `${registration.user.name} checked out. Attendance: ${attendancePercentage}%`,
      }, { status: 200 });
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
        userId: studentUserId,
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
          where: { id: studentUserId },
          data: { aictePoints: { increment: event.aictePoints } },
        });
        aictePointsAwarded = event.aictePoints;

        await db.notification.create({
          data: {
            userId: studentUserId,
            title: 'AICTE Points Awarded! 🏆',
            message: `You earned ${event.aictePoints} AICTE points for attending "${event.title}"`,
            type: 'success',
          },
        });
      } catch (e) {
        console.error('AICTE points award error:', e);
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
