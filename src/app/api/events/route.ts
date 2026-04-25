import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSlug } from '@/lib/geo';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const clubId = searchParams.get('clubId');
    const upcoming = searchParams.get('upcoming');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const userId = searchParams.get('userId');

    const where: any = {};

    if (category) where.category = category;
    if (status && status !== 'ALL') {
      // Support comma-separated status values like "APPROVED,LIVE"
      const statusValues = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusValues.length === 1) {
        where.status = statusValues[0];
      } else if (statusValues.length > 1) {
        where.status = { in: statusValues };
      }
    } else if (!status) {
      where.status = { in: ['APPROVED', 'LIVE', 'COMPLETED'] };
    }
    if (clubId) where.clubId = clubId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { venue: { contains: search } },
      ];
    }
    if (upcoming === 'true') {
      where.startDate = { gte: new Date() };
    }

    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        include: {
          organizer: { select: { id: true, name: true, email: true } },
          club: { select: { id: true, name: true, logo: true } },
          _count: { select: { registrations: true, attendances: true } },
        },
        orderBy: { startDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.event.count({ where }),
    ]);

    // If userId provided, check registration status
    let eventsWithRegistration = events;
    if (userId) {
      const registrations = await db.eventRegistration.findMany({
        where: { userId, eventId: { in: events.map(e => e.id) } },
        select: { eventId: true, status: true, qrCode: true },
      });
      const regMap = new Map(registrations.map(r => [r.eventId, r]));
      eventsWithRegistration = events.map(e => ({
        ...e,
        userRegistration: regMap.get(e.id) || null,
      }));
    }

    return NextResponse.json({
      events: eventsWithRegistration,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Events fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !['FACULTY', 'HOD', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Only faculty, HODs, or admins can create events' }, { status: 403 });
    }

    const {
      title, description, venue, startDate, endDate, category,
      clubId, poster, maxParticipants, registrationDeadline, tags,
      venueLat, venueLng, geoFenceRadius, isPublic, requiresApproval,
      eventType, competitionConfig,
    } = body;

    if (!title || !description || !venue || !startDate || !endDate || !category) {
      return NextResponse.json({ error: 'Title, description, venue, start/end dates, and category are required' }, { status: 400 });
    }

    const slug = generateSlug(title);

    const event = await db.event.create({
      data: {
        title,
        slug,
        description,
        venue,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        category,
        clubId: clubId || null,
        organizerId: userId,
        poster: poster || null,
        maxParticipants: maxParticipants || null,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        tags: tags || '',
        venueLat: venueLat || null,
        venueLng: venueLng || null,
        geoFenceRadius: geoFenceRadius || null,
        isPublic: isPublic !== false,
        requiresApproval: requiresApproval || false,
        eventType: eventType || 'GENERAL',
        status: 'PENDING_APPROVAL',
      },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        club: { select: { id: true, name: true } },
      },
    });

    // If competition, create config + rounds
    if (eventType === 'COMPETITION' && competitionConfig) {
      const config = await db.competitionConfig.create({
        data: {
          eventId: event.id,
          teamMinSize: competitionConfig.teamMinSize || 1,
          teamMaxSize: competitionConfig.teamMaxSize || 5,
          maxTeams: competitionConfig.maxTeams || null,
          allowIndividual: competitionConfig.allowIndividual !== false,
          scoringType: competitionConfig.scoringType || 'CUMULATIVE',
        },
      });
      if (competitionConfig.rounds && Array.isArray(competitionConfig.rounds)) {
        for (const round of competitionConfig.rounds) {
          await db.competitionRound.create({
            data: {
              competitionConfigId: config.id,
              roundNumber: round.roundNumber,
              name: round.name,
              description: round.description || null,
              criteria: JSON.stringify(round.criteria || []),
              maxScore: round.maxScore ?? 100,
              weight: round.weight ?? 1.0,
              isElimination: round.isElimination ?? false,
              advanceCount: round.advanceCount ?? null,
            },
          });
        }
      }
    }

    // If eventRoles provided, create them
    if (body.eventRoles && Array.isArray(body.eventRoles)) {
      for (const er of body.eventRoles) {
        await db.eventRole.create({
          data: {
            eventId: event.id,
            name: er.name,
            description: er.description || null,
            permissions: JSON.stringify(er.permissions || []),
            color: er.color || null,
            maxAssignees: er.maxAssignees || null,
            createdBy: userId,
          },
        });
      }
    }

    return NextResponse.json({ event, message: 'Event created successfully, pending approval' }, { status: 201 });
  } catch (error) {
    console.error('Event creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
