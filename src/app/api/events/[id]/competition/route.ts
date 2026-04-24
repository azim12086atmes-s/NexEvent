import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await db.competitionConfig.findUnique({
      where: { eventId: id },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
    });

    if (!config) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Competition config fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, teamMinSize, teamMaxSize, maxTeams, allowIndividual, scoringType, rounds } = body;

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });

    // Verify authorization
    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const user = await db.user.findUnique({ where: { id: userId } });
    const isAuthorized = event.organizerId === userId || user?.role === 'ADMIN' || user?.role === 'FACULTY';
    if (!isAuthorized) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    // Check if config already exists
    const existing = await db.competitionConfig.findUnique({ where: { eventId: id } });
    if (existing) {
      // Update instead
      const updated = await db.competitionConfig.update({
        where: { eventId: id },
        data: {
          teamMinSize: teamMinSize ?? existing.teamMinSize,
          teamMaxSize: teamMaxSize ?? existing.teamMaxSize,
          maxTeams: maxTeams ?? existing.maxTeams,
          allowIndividual: allowIndividual ?? existing.allowIndividual,
          scoringType: scoringType ?? existing.scoringType,
        },
        include: { rounds: { orderBy: { roundNumber: 'asc' } } },
      });

      // Update rounds if provided
      if (rounds && Array.isArray(rounds)) {
        // Delete existing rounds and recreate
        await db.competitionRound.deleteMany({ where: { competitionConfigId: updated.id } });
        for (const round of rounds) {
          await db.competitionRound.create({
            data: {
              competitionConfigId: updated.id,
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
        // Refetch with rounds
        const withRounds = await db.competitionConfig.findUnique({
          where: { eventId: id },
          include: { rounds: { orderBy: { roundNumber: 'asc' } } },
        });
        return NextResponse.json({ config: withRounds, message: 'Competition config updated' });
      }

      return NextResponse.json({ config: updated, message: 'Competition config updated' });
    }

    // Also update event type to COMPETITION
    await db.event.update({ where: { id }, data: { eventType: 'COMPETITION' } });

    const config = await db.competitionConfig.create({
      data: {
        eventId: id,
        teamMinSize: teamMinSize || 1,
        teamMaxSize: teamMaxSize || 5,
        maxTeams: maxTeams || null,
        allowIndividual: allowIndividual !== false,
        scoringType: scoringType || 'CUMULATIVE',
      },
    });

    // Create rounds
    if (rounds && Array.isArray(rounds)) {
      for (const round of rounds) {
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

    const fullConfig = await db.competitionConfig.findUnique({
      where: { id: config.id },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
    });

    return NextResponse.json({ config: fullConfig, message: 'Competition config created' }, { status: 201 });
  } catch (error) {
    console.error('Competition config create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });

    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const user = await db.user.findUnique({ where: { id: userId } });
    const isAuthorized = event.organizerId === userId || user?.role === 'ADMIN';
    if (!isAuthorized) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    await db.competitionConfig.delete({ where: { eventId: id } });
    await db.event.update({ where: { id }, data: { eventType: 'GENERAL' } });

    return NextResponse.json({ message: 'Competition config deleted' });
  } catch (error) {
    console.error('Competition config delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
