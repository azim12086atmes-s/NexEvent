import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/events/[id]/teams - List teams for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const event = await db.event.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const teams = await db.team.findMany({
      where: { eventId: id },
      include: {
        leader: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Check if user is already on a team for this event
    let userTeam: any = null;
    if (userId) {
      const membership = await db.teamMember.findFirst({
        where: {
          userId,
          team: { eventId: id },
        },
        include: {
          team: {
            include: {
              leader: { select: { id: true, name: true, email: true } },
              members: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
      });
      if (membership) {
        userTeam = membership.team;
      }
    }

    return NextResponse.json({ teams, userTeam });
  } catch (error) {
    console.error('Teams fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/events/[id]/teams - Create a new team or join a team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, action, teamName, teamCode } = body;

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });

    const event = await db.event.findUnique({
      where: { id },
      include: { competitionConfig: true },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    if (event.eventType !== 'COMPETITION') {
      return NextResponse.json({ error: 'This event is not a competition' }, { status: 400 });
    }

    if (!['APPROVED', 'LIVE'].includes(event.status)) {
      return NextResponse.json({ error: 'Event is not open for registration' }, { status: 400 });
    }

    // Check if user is already on a team for this event
    const existingMembership = await db.teamMember.findFirst({
      where: { userId, team: { eventId: id } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: 'You are already on a team for this event' }, { status: 400 });
    }

    if (action === 'create') {
      // Create a new team
      if (!teamName || teamName.trim().length < 2) {
        return NextResponse.json({ error: 'Team name must be at least 2 characters' }, { status: 400 });
      }

      const config = event.competitionConfig;

      // Check max teams limit
      if (config?.maxTeams) {
        const teamCount = await db.team.count({ where: { eventId: id } });
        if (teamCount >= config.maxTeams) {
          return NextResponse.json({ error: 'Maximum number of teams reached' }, { status: 400 });
        }
      }

      // Generate unique team code
      const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      let teamCodeGenerated = generateCode();
      // Ensure uniqueness
      let codeExists = await db.team.findUnique({ where: { teamCode: teamCodeGenerated } });
      while (codeExists) {
        teamCodeGenerated = generateCode();
        codeExists = await db.team.findUnique({ where: { teamCode: teamCodeGenerated } });
      }

      // Create team with leader as first member
      const team = await db.team.create({
        data: {
          eventId: id,
          name: teamName.trim(),
          teamCode: teamCodeGenerated,
          leaderId: userId,
          status: 'REGISTERED',
          members: {
            create: { userId },
          },
        },
        include: {
          leader: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      // Create EventRegistration for the team leader
      const qrCode = `EVT-${id}-USR-${userId}-${Date.now()}`;
      await db.eventRegistration.create({
        data: {
          eventId: id,
          userId,
          status: 'REGISTERED',
          qrCode,
          teamId: team.id,
        },
      });

      return NextResponse.json({ team, message: 'Team created successfully! Share the team code with your teammates.' }, { status: 201 });
    }

    if (action === 'join') {
      // Join an existing team via team code
      if (!teamCode || teamCode.trim().length < 2) {
        return NextResponse.json({ error: 'Team code is required' }, { status: 400 });
      }

      const team = await db.team.findUnique({
        where: { teamCode: teamCode.trim().toUpperCase() },
        include: {
          leader: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!team || team.eventId !== id) {
        return NextResponse.json({ error: 'Invalid team code for this event' }, { status: 404 });
      }

      if (team.status === 'ELIMINATED' || team.status === 'WINNER') {
        return NextResponse.json({ error: 'This team is no longer accepting members' }, { status: 400 });
      }

      // Check team size limit
      const config = event.competitionConfig;
      const maxTeamSize = config?.teamMaxSize || 5;
      if (team.members.length >= maxTeamSize) {
        return NextResponse.json({ error: `Team is full (max ${maxTeamSize} members)` }, { status: 400 });
      }

      // Add user to team
      await db.teamMember.create({
        data: { teamId: team.id, userId },
      });

      // Create EventRegistration for the joining member
      const qrCode = `EVT-${id}-USR-${userId}-${Date.now()}`;
      await db.eventRegistration.create({
        data: {
          eventId: id,
          userId,
          status: 'REGISTERED',
          qrCode,
          teamId: team.id,
        },
      });

      // Refetch team with updated members
      const updatedTeam = await db.team.findUnique({
        where: { id: team.id },
        include: {
          leader: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      return NextResponse.json({ team: updatedTeam, message: 'Successfully joined the team!' });
    }

    return NextResponse.json({ error: 'Invalid action. Use "create" or "join"' }, { status: 400 });
  } catch (error) {
    console.error('Team operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/events/[id]/teams - Leave a team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });

    const membership = await db.teamMember.findFirst({
      where: { userId, team: { eventId: id } },
      include: { team: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'You are not on a team for this event' }, { status: 404 });
    }

    const team = membership.team;

    // If leader is leaving, delete the entire team
    if (team.leaderId === userId) {
      // Delete all team members' registrations for this event
      const memberUserIds = await db.teamMember.findMany({
        where: { teamId: team.id },
        select: { userId: true },
      });

      for (const m of memberUserIds) {
        await db.eventRegistration.deleteMany({
          where: { eventId: id, userId: m.userId },
        });
      }

      // Delete all team members and the team
      await db.teamMember.deleteMany({ where: { teamId: team.id } });
      await db.team.delete({ where: { id: team.id } });

      return NextResponse.json({ message: 'Team disbanded. All members have been unregistered.' });
    }

    // Regular member leaving
    await db.teamMember.delete({ where: { id: membership.id } });
    await db.eventRegistration.deleteMany({
      where: { eventId: id, userId },
    });

    return NextResponse.json({ message: 'You have left the team' });
  } catch (error) {
    console.error('Team leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
