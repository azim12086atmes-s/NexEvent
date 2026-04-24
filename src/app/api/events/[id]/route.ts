import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.nextUrl.searchParams.get('userId');

    const event = await db.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true, avatar: true } },
        approver: { select: { id: true, name: true, email: true } },
        club: { select: { id: true, name: true, logo: true, slug: true } },
        registrations: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
            attendance: true,
          },
          orderBy: { registeredAt: 'desc' },
        },
        attendances: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        report: true,
        _count: { select: { registrations: true, attendances: true } },
        competitionConfig: {
          include: { rounds: { orderBy: { roundNumber: 'asc' } } },
        },
        eventRoles: {
          include: {
            assignments: {
              include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            },
          },
        },
        teams: {
          include: {
            leader: { select: { id: true, name: true } },
            members: { include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if current user is registered
    let userRegistration = null;
    if (userId) {
      userRegistration = await db.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
        include: { attendance: true },
      });
    }

    return NextResponse.json({ event, userRegistration });
  } catch (error) {
    console.error('Event fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const existingEvent = await db.event.findUnique({ where: { id } });
    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || (existingEvent.organizerId !== userId && user.role !== 'ADMIN' && user.role !== 'FACULTY')) {
      return NextResponse.json({ error: 'Not authorized to update this event' }, { status: 403 });
    }

    const updateData: any = {};
    const allowedFields = ['title', 'description', 'venue', 'category', 'poster', 'maxParticipants', 'tags', 'isPublic', 'requiresApproval', 'eventType'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.registrationDeadline) updateData.registrationDeadline = new Date(body.registrationDeadline);
    if (body.venueLat !== undefined) updateData.venueLat = body.venueLat;
    if (body.venueLng !== undefined) updateData.venueLng = body.venueLng;
    if (body.geoFenceRadius !== undefined) updateData.geoFenceRadius = body.geoFenceRadius;
    if (body.status) updateData.status = body.status;

    const event = await db.event.update({
      where: { id },
      data: updateData,
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        club: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ event, message: 'Event updated successfully' });
  } catch (error) {
    console.error('Event update error:', error);
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

    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || (event.organizerId !== userId && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Not authorized to delete this event' }, { status: 403 });
    }

    if (!['DRAFT', 'PENDING_APPROVAL'].includes(event.status)) {
      return NextResponse.json({ error: 'Can only delete events in draft or pending approval status' }, { status: 400 });
    }

    await db.event.delete({ where: { id } });

    return NextResponse.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Event delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
