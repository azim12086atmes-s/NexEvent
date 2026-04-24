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
    const userId = body.userId;

    if (!userId || !qrCode) {
      return NextResponse.json({ error: 'User ID and QR code are required' }, { status: 400 });
    }

    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!['LIVE', 'APPROVED'].includes(event.status)) {
      return NextResponse.json({ error: 'Event is not active for check-in' }, { status: 400 });
    }

    const registration = await db.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Not registered for this event' }, { status: 404 });
    }

    if (registration.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Registration has been cancelled' }, { status: 400 });
    }

    if (registration.qrCode !== qrCode) {
      return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });
    }

    // Check if already checked in
    const existingAttendance = await db.attendance.findUnique({
      where: { registrationId: registration.id },
    });

    if (existingAttendance) {
      return NextResponse.json({
        error: 'Already checked in',
        attendance: existingAttendance,
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
        userId,
        status: isLate ? 'LATE' : 'PRESENT',
        checkInTime: now,
        checkInLat: latitude || null,
        checkInLng: longitude || null,
        isWithinGeoFence: isWithinFence,
        notes: !isWithinFence ? 'Checked in outside geo-fence radius' : null,
      },
    });

    return NextResponse.json({
      attendance,
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

    const attendances = await db.attendance.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, name: true, email: true, usn: true, department: true } },
      },
      orderBy: { checkInTime: 'asc' },
    });

    return NextResponse.json({ attendances });
  } catch (error) {
    console.error('Attendance fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
