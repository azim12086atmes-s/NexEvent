import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// POST - Submit a location ping for real-time geo-fence tracking
// The client periodically sends pings during an event
// Attendance % = totalPingsInFence / totalPings * 100
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, latitude, longitude } = body;

    if (!userId || !latitude || !longitude) {
      return NextResponse.json(
        { error: 'User ID, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    // Verify event exists and is active
    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!['LIVE', 'APPROVED'].includes(event.status)) {
      return NextResponse.json({ error: 'Event is not active' }, { status: 400 });
    }

    // Verify user is registered
    const registration = await db.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    });

    if (!registration || registration.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Not registered for this event' }, { status: 403 });
    }

    // Calculate if within geo-fence
    let isWithinFence = true;
    if (event.venueLat && event.venueLng && event.geoFenceRadius) {
      const R = 6371000; // Earth's radius in meters
      const dLat = ((event.venueLat - latitude) * Math.PI) / 180;
      const dLng = ((event.venueLng - longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((latitude * Math.PI) / 180) *
          Math.cos((event.venueLat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      isWithinFence = distance <= event.geoFenceRadius;
    }

    // Create the location ping
    const ping = await db.locationPing.create({
      data: {
        userId,
        eventId: id,
        latitude,
        longitude,
        isWithinFence,
      },
    });

    // Update attendance record with ping stats
    const attendance = await db.attendance.findUnique({
      where: { registrationId: registration.id },
    });

    if (attendance) {
      const newTotalPings = attendance.totalPings + 1;
      const newPingsInFence = attendance.totalPingsInFence + (isWithinFence ? 1 : 0);
      const newPercentage = newTotalPings > 0 ? (newPingsInFence / newTotalPings) * 100 : 0;

      await db.attendance.update({
        where: { id: attendance.id },
        data: {
          totalPings: newTotalPings,
          totalPingsInFence: newPingsInFence,
          attendancePercentage: newPercentage,
          lastPingTime: new Date(),
        },
      });
    }

    return NextResponse.json({
      ping,
      isWithinFence,
      message: isWithinFence ? 'Location ping recorded' : 'Location ping recorded (outside geo-fence)',
    }, { status: 201 });
  } catch (error) {
    console.error('Location ping error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// GET - Get location pings for an event (organizer view)
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestorId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Verify permissions
    const requestor = requestorId ? await db.user.findUnique({ where: { id: requestorId } }) : null;
    const event = await db.event.findUnique({ where: { id } });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const isPrivileged = requestor && ['ADMIN', 'FACULTY', 'HOD'].includes(requestor.role);
    const isOrganizer = event.organizerId === requestorId;

    if (!isPrivileged && !isOrganizer) {
      return NextResponse.json({ error: 'Not authorized to view location data' }, { status: 403 });
    }

    // Get recent pings
    const pings = await db.locationPing.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { pingedAt: 'desc' },
      take: limit,
    });

    // Get attendance summary
    const attendances = await db.attendance.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, name: true, email: true, usn: true } },
      },
    });

    const summary = attendances.map(a => ({
      userId: a.userId,
      userName: a.user.name,
      usn: a.user.usn,
      status: a.status,
      attendancePercentage: Math.round(a.attendancePercentage),
      totalPings: a.totalPings,
      totalPingsInFence: a.totalPingsInFence,
      lastPingTime: a.lastPingTime,
      isWithinGeoFence: a.isWithinGeoFence,
    }));

    return NextResponse.json({
      pings,
      summary,
      geoFence: event.geoFenceRadius ? {
        latitude: event.venueLat,
        longitude: event.venueLng,
        radius: event.geoFenceRadius,
      } : null,
    });
  } catch (error) {
    console.error('Location pings fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
