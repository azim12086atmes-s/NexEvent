import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId;
    const { action, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !['FACULTY', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Only faculty or admins can approve events' }, { status: 403 });
    }

    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'Event is not pending approval' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 });
    }

    const updatedEvent = await db.event.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        approverId: userId,
        approvedAt: action === 'approve' ? new Date() : null,
        rejectionReason: action === 'reject' ? reason || null : null,
      },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
      },
    });

    // Create notification for organizer
    await db.notification.create({
      data: {
        userId: event.organizerId,
        title: action === 'approve' ? 'Event Approved!' : 'Event Rejected',
        message: action === 'approve'
          ? `Your event "${event.title}" has been approved.`
          : `Your event "${event.title}" has been rejected. Reason: ${reason || 'Not specified'}`,
        type: action === 'approve' ? 'success' : 'error',
        link: `/event/${id}`,
      },
    });

    return NextResponse.json({
      event: updatedEvent,
      message: action === 'approve' ? 'Event approved successfully' : 'Event rejected',
    });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
