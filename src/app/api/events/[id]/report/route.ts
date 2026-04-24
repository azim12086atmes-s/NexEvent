import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        club: { select: { id: true, name: true } },
        registrations: {
          include: {
            user: { select: { id: true, name: true, email: true, usn: true, department: true } },
            attendance: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const totalRegistered = event.registrations.filter(r => r.status !== 'CANCELLED').length;
    const totalPresent = event.registrations.filter(r => r.attendance?.status === 'PRESENT').length;
    const totalLate = event.registrations.filter(r => r.attendance?.status === 'LATE').length;
    const totalAbsent = totalRegistered - totalPresent - totalLate;
    const attendanceRate = totalRegistered > 0 ? ((totalPresent + totalLate) / totalRegistered) * 100 : 0;

    // Save/update report
    const report = await db.eventReport.upsert({
      where: { eventId: id },
      create: {
        eventId: id,
        totalRegistered,
        totalPresent: totalPresent + totalLate,
        totalAbsent,
        attendanceRate,
        summary: `Event "${event.title}" held at ${event.venue}. ${totalRegistered} registered, ${totalPresent + totalLate} attended (${attendanceRate.toFixed(1)}% attendance rate).`,
      },
      update: {
        totalRegistered,
        totalPresent: totalPresent + totalLate,
        totalAbsent,
        attendanceRate,
        summary: `Event "${event.title}" held at ${event.venue}. ${totalRegistered} registered, ${totalPresent + totalLate} attended (${attendanceRate.toFixed(1)}% attendance rate).`,
        generatedAt: new Date(),
      },
    });

    const attendees = event.registrations
      .filter(r => r.status !== 'CANCELLED')
      .map(r => ({
        name: r.user.name,
        email: r.user.email,
        usn: r.user.usn,
        department: r.user.department,
        status: r.attendance?.status || 'ABSENT',
        checkInTime: r.attendance?.checkInTime || null,
        isWithinGeoFence: r.attendance?.isWithinGeoFence ?? null,
      }));

    return NextResponse.json({
      report,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        venue: event.venue,
        startDate: event.startDate,
        endDate: event.endDate,
        category: event.category,
        organizer: event.organizer,
        club: event.club,
      },
      attendees,
    });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        club: { select: { id: true, name: true } },
        registrations: {
          include: {
            user: { select: { id: true, name: true, email: true, usn: true, department: true } },
            attendance: true,
          },
        },
        report: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const totalRegistered = event.registrations.filter(r => r.status !== 'CANCELLED').length;
    const totalPresent = event.registrations.filter(r => r.attendance?.status === 'PRESENT').length;
    const totalLate = event.registrations.filter(r => r.attendance?.status === 'LATE').length;
    const totalAbsent = totalRegistered - totalPresent - totalLate;
    const attendanceRate = totalRegistered > 0 ? ((totalPresent + totalLate) / totalRegistered) * 100 : 0;

    // Return report data for client-side PDF generation
    const reportData = {
      event: {
        title: event.title,
        description: event.description,
        venue: event.venue,
        startDate: event.startDate,
        endDate: event.endDate,
        category: event.category,
        organizer: event.organizer,
        club: event.club,
      },
      stats: {
        totalRegistered,
        totalPresent: totalPresent + totalLate,
        totalAbsent,
        attendanceRate: attendanceRate.toFixed(1),
      },
      attendees: event.registrations
        .filter(r => r.status !== 'CANCELLED')
        .map(r => ({
          name: r.user.name,
          email: r.user.email,
          usn: r.user.usn,
          department: r.user.department,
          status: r.attendance?.status || 'ABSENT',
          checkInTime: r.attendance?.checkInTime || null,
          isWithinGeoFence: r.attendance?.isWithinGeoFence ?? null,
        })),
    };

    // Save report
    await db.eventReport.upsert({
      where: { eventId: id },
      create: {
        eventId: id,
        totalRegistered,
        totalPresent: totalPresent + totalLate,
        totalAbsent,
        attendanceRate,
        summary: `Event "${event.title}" - ${totalRegistered} registered, ${totalPresent + totalLate} attended`,
      },
      update: {
        totalRegistered,
        totalPresent: totalPresent + totalLate,
        totalAbsent,
        attendanceRate,
        summary: `Event "${event.title}" - ${totalRegistered} registered, ${totalPresent + totalLate} attended`,
        generatedAt: new Date(),
      },
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('PDF report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
