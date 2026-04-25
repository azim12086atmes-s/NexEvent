import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper: Check if user has permission to score or view results
async function getUserEventPermissions(userId: string, eventId: string): Promise<{ canScore: boolean; canViewResults: boolean; canToggleScoring: boolean }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { canScore: false, canViewResults: false, canToggleScoring: false };

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return { canScore: false, canViewResults: false, canToggleScoring: false };

  const isOrganizer = event.organizerId === userId;
  const isAdmin = user.role === 'ADMIN';
  const isFaculty = user.role === 'FACULTY';
  const isHOD = user.role === 'HOD';
  const isPrivileged = isOrganizer || isAdmin || isFaculty || isHOD;

  // Check event role assignments for SCORE_PARTICIPANTS and VIEW_RESULTS permissions
  const roleAssignments = await db.eventRoleAssignment.findMany({
    where: { userId, role: { eventId } },
    include: { role: true },
  });

  const permissions = new Set<string>();
  for (const assignment of roleAssignments) {
    try {
      const perms: string[] = JSON.parse(assignment.role.permissions);
      perms.forEach(p => permissions.add(p));
    } catch { /* ignore parse errors */ }
  }

  return {
    canScore: isPrivileged || permissions.has('SCORE_PARTICIPANTS'),
    canViewResults: isPrivileged || permissions.has('VIEW_RESULTS'),
    canToggleScoring: isOrganizer || isAdmin || isFaculty || isHOD,
  };
}

// GET /api/events/[id]/scores - Get scores (raw or aggregated)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const roundId = searchParams.get('roundId');
    const judgeId = searchParams.get('judgeId');
    const targetId = searchParams.get('targetId');
    const aggregate = searchParams.get('aggregate') === 'true';

    if (aggregate) {
      // Return aggregated scores per team/participant across all rounds
      const event = await db.event.findUnique({
        where: { id: eventId },
        include: {
          competitionConfig: {
            include: { rounds: { orderBy: { roundNumber: 'asc' } } },
          },
          teams: {
            include: {
              leader: { select: { id: true, name: true } },
              members: { include: { user: { select: { id: true, name: true } } } },
            },
          },
          registrations: {
            where: { status: { in: ['REGISTERED', 'CONFIRMED'] } },
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      if (!event || !event.competitionConfig) {
        return NextResponse.json({ error: 'Competition config not found' }, { status: 404 });
      }

      const config = event.competitionConfig;
      const rounds = config.rounds;
      const isTeamBased = config.teamMinSize > 1 || event.teams.length > 0;

      // Get all scores for this event
      const allScores = await db.score.findMany({
        where: { roundId: { in: rounds.map(r => r.id) } },
        include: {
          judge: { select: { id: true, name: true } },
          round: { select: { id: true, name: true, roundNumber: true, weight: true, maxScore: true } },
        },
      });

      // Build targets list
      const targets: { id: string; name: string; type: string }[] = [];
      if (isTeamBased) {
        for (const team of event.teams) {
          targets.push({ id: team.id, name: team.name, type: 'TEAM' });
        }
      }
      // Also add individual participants if allowIndividual
      if (config.allowIndividual) {
        for (const reg of event.registrations) {
          // Only add if not already in a team
          if (!reg.teamId) {
            targets.push({ id: reg.user.id, name: reg.user.name, type: 'INDIVIDUAL' });
          }
        }
      }

      // Aggregate scores per target
      const results = targets.map(target => {
        const targetScores = allScores.filter(s => s.targetId === target.id);
        const roundBreakdowns: {
          roundId: string;
          roundName: string;
          roundNumber: number;
          weight: number;
          maxScore: number;
          criteriaBreakdown: { criterionName: string; avgScore: number; maxScore: number; judgeCount: number }[];
          roundTotal: number;
          weightedScore: number;
        }[] = [];

        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const round of rounds) {
          const roundScores = targetScores.filter(s => s.roundId === round.id);
          const criteriaNames = [...new Set(roundScores.map(s => s.criterionName))];

          // If no criteria found from scores, try parsing from round config
          let criteriaList: { name: string; maxScore: number; weight: number }[] = [];
          try {
            criteriaList = JSON.parse(round.criteria || '[]');
          } catch { /* ignore */ }

          if (criteriaNames.length === 0 && criteriaList.length === 0) {
            roundBreakdowns.push({
              roundId: round.id,
              roundName: round.name,
              roundNumber: round.roundNumber,
              weight: round.weight,
              maxScore: round.maxScore,
              criteriaBreakdown: [],
              roundTotal: 0,
              weightedScore: 0,
            });
            continue;
          }

          const effectiveCriteria = criteriaNames.length > 0 ? criteriaNames : criteriaList.map(c => c.name);

          const criteriaBreakdown = effectiveCriteria.map(cName => {
            const cScores = roundScores.filter(s => s.criterionName === cName);
            const cMaxScore = cScores.length > 0 ? cScores[0].maxScore : (criteriaList.find(c => c.name === cName)?.maxScore || 0);
            const avgScore = cScores.length > 0
              ? cScores.reduce((sum, s) => sum + s.score, 0) / cScores.length
              : 0;
            return {
              criterionName: cName,
              avgScore: Math.round(avgScore * 100) / 100,
              maxScore: cMaxScore,
              judgeCount: cScores.length,
            };
          });

          const roundTotal = criteriaBreakdown.reduce((sum, c) => sum + c.avgScore, 0);
          const weightedScore = roundTotal * round.weight;

          roundBreakdowns.push({
            roundId: round.id,
            roundName: round.name,
            roundNumber: round.roundNumber,
            weight: round.weight,
            maxScore: round.maxScore,
            criteriaBreakdown,
            roundTotal: Math.round(roundTotal * 100) / 100,
            weightedScore: Math.round(weightedScore * 100) / 100,
          });

          totalWeightedScore += weightedScore;
          totalWeight += round.weight;
        }

        // Apply scoring type
        let finalScore = 0;
        if (config.scoringType === 'CUMULATIVE') {
          finalScore = totalWeightedScore;
        } else if (config.scoringType === 'AVERAGE' && totalWeight > 0) {
          finalScore = totalWeightedScore / totalWeight;
        } else if (config.scoringType === 'BEST_OF') {
          finalScore = Math.max(...roundBreakdowns.map(r => r.roundTotal), 0);
        }

        return {
          targetId: target.id,
          targetName: target.name,
          targetType: target.type,
          team: isTeamBased ? event.teams.find(t => t.id === target.id) : undefined,
          roundBreakdowns,
          totalScore: Math.round(finalScore * 100) / 100,
        };
      });

      // Sort by total score descending (ranking)
      results.sort((a, b) => b.totalScore - a.totalScore);

      // Add rank
      const rankedResults = results.map((r, i) => ({ ...r, rank: i + 1 }));

      return NextResponse.json({ results: rankedResults, scoringType: config.scoringType, rounds: rounds.map(r => ({ id: r.id, name: r.name, roundNumber: r.roundNumber, weight: r.weight })) });
    }

    // Raw scores with filters
    const where: any = {};
    if (roundId) where.roundId = roundId;
    if (judgeId) where.judgeId = judgeId;
    if (targetId) where.targetId = targetId;

    // If roundId specified, filter by it. Otherwise get all rounds for this event's config.
    if (!roundId) {
      const config = await db.competitionConfig.findUnique({
        where: { eventId },
        include: { rounds: true },
      });
      if (config) {
        where.roundId = { in: config.rounds.map(r => r.id) };
      }
    }

    const scores = await db.score.findMany({
      where,
      include: {
        judge: { select: { id: true, name: true } },
        round: { select: { id: true, name: true, roundNumber: true } },
      },
      orderBy: [{ roundId: 'asc' }, { targetId: 'asc' }, { criterionName: 'asc' }],
    });

    return NextResponse.json({ scores });
  } catch (error) {
    console.error('Scores fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/events/[id]/scores - Submit/Update a score
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { roundId, targetId, criterionName, score, maxScore, judgeId, weight, comments, targetType } = body;

    if (!roundId || !targetId || !criterionName || score === undefined || !maxScore || !judgeId) {
      return NextResponse.json({ error: 'Missing required fields: roundId, targetId, criterionName, score, maxScore, judgeId' }, { status: 400 });
    }

    // Validate score range
    if (score < 0 || score > maxScore) {
      return NextResponse.json({ error: `Score must be between 0 and ${maxScore}` }, { status: 400 });
    }

    // Check permissions
    const perms = await getUserEventPermissions(judgeId, eventId);
    const isPrivileged = perms.canToggleScoring; // organizer, admin, faculty, HOD

    if (!perms.canScore) {
      return NextResponse.json({ error: 'You do not have permission to score participants' }, { status: 403 });
    }

    // Check round scoringOpen (unless privileged)
    const round = await db.competitionRound.findUnique({ where: { id: roundId } });
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    if (!round.scoringOpen && !isPrivileged) {
      return NextResponse.json({ error: 'Scoring is not open for this round' }, { status: 403 });
    }

    if (round.scoringDeadline && new Date() > new Date(round.scoringDeadline) && !isPrivileged) {
      return NextResponse.json({ error: 'Scoring deadline has passed for this round' }, { status: 403 });
    }

    // Upsert score
    const existing = await db.score.findUnique({
      where: {
        roundId_judgeId_targetId_criterionName: {
          roundId,
          judgeId,
          targetId,
          criterionName,
        },
      },
    });

    let result;
    if (existing) {
      // Only the same judge can update their own score
      if (existing.judgeId !== judgeId && !isPrivileged) {
        return NextResponse.json({ error: 'You can only update your own scores' }, { status: 403 });
      }
      result = await db.score.update({
        where: { id: existing.id },
        data: {
          score,
          maxScore,
          weight: weight ?? existing.weight,
          comments: comments ?? existing.comments,
        },
      });
    } else {
      result = await db.score.create({
        data: {
          roundId,
          judgeId,
          targetId,
          targetType: targetType || 'INDIVIDUAL',
          criterionName,
          score,
          maxScore,
          weight: weight ?? 1.0,
          comments: comments || null,
        },
      });
    }

    return NextResponse.json({ score: result, message: existing ? 'Score updated' : 'Score submitted' });
  } catch (error) {
    console.error('Score submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/events/[id]/scores - Toggle scoring open/close for a round
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { roundId, userId, scoringOpen, scoringDeadline } = body;

    if (!roundId || !userId || scoringOpen === undefined) {
      return NextResponse.json({ error: 'Missing required fields: roundId, userId, scoringOpen' }, { status: 400 });
    }

    // Only organizer, admin, faculty, HOD can toggle
    const perms = await getUserEventPermissions(userId, eventId);
    if (!perms.canToggleScoring) {
      return NextResponse.json({ error: 'Only event organizers, admins, faculty, and HODs can toggle scoring' }, { status: 403 });
    }

    const round = await db.competitionRound.findUnique({ where: { id: roundId } });
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    const updateData: any = { scoringOpen };
    if (scoringDeadline !== undefined) {
      updateData.scoringDeadline = scoringDeadline ? new Date(scoringDeadline) : null;
    }

    const updated = await db.competitionRound.update({
      where: { id: roundId },
      data: updateData,
    });

    return NextResponse.json({ round: updated, message: `Scoring ${scoringOpen ? 'opened' : 'closed'} for ${round.name}` });
  } catch (error) {
    console.error('Toggle scoring error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
