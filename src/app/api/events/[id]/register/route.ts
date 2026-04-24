import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateQRCode } from '@/lib/geo';

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

    const event = await db.event.findUnique({
      where: { id },
      include: { _count: { select: { registrations: true } } },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!['APPROVED', 'LIVE'].includes(event.status)) {
      return NextResponse.json({ error: 'Event is not open for registration' }, { status: 400 });
    }

    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }

    if (event.maxParticipants && event._count.registrations >= event.maxParticipants) {
      return NextResponse.json({ error: 'Event is fully booked' }, { status: 400 });
    }

    const existingReg = await db.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    });

    if (existingReg) {
      return NextResponse.json({ error: 'Already registered for this event' }, { status: 409 });
    }

    const qrCode = generateQRCode(id, userId);

    const registration = await db.eventRegistration.create({
      data: {
        eventId: id,
        userId,
        qrCode,
        status: event.requiresApproval ? 'WAITLISTED' : 'CONFIRMED',
        confirmedAt: event.requiresApproval ? null : new Date(),
      },
      include: {
        event: { select: { id: true, title: true, startDate: true, venue: true } },
      },
    });

    return NextResponse.json({ registration, message: 'Registration successful' }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
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

    const registration = await db.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (registration.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Registration already cancelled' }, { status: 400 });
    }

    await db.eventRegistration.update({
      where: { id: registration.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return NextResponse.json({ message: 'Registration cancelled successfully' });
  } catch (error) {
    console.error('Cancellation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
