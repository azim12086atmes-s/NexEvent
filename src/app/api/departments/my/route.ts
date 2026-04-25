import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Find the department where this user is HOD
    const department = await db.department.findFirst({
      where: { hodId: userId },
      include: {
        hod: { select: { id: true, name: true, email: true, role: true } },
        clubs: {
          where: { isActive: true },
          include: {
            facultyAdvisor: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, userId: true, role: true, user: { select: { id: true, name: true } } } },
            _count: { select: { members: true, events: true } },
          },
          orderBy: { name: 'asc' },
        },
        events: {
          include: {
            organizer: { select: { id: true, name: true } },
            club: { select: { id: true, name: true } },
            _count: { select: { registrations: true } },
          },
          orderBy: { startDate: 'desc' },
          take: 20,
        },
        users: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            usn: true,
            aictePoints: true,
            _count: {
              select: {
                registrations: true,
                clubMemberships: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
        clubCreationRequests: {
          include: {
            requestedBy: { select: { id: true, name: true, email: true, role: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: 'No department found for this HOD' }, { status: 404 });
    }

    // Compute stats
    const students = department.users.filter(u => u.role === 'STUDENT');
    const faculty = department.users.filter(u => u.role === 'FACULTY');
    const activeClubs = department.clubs;
    const now = new Date();
    const activeEvents = department.events.filter(
      e => e.status === 'APPROVED' || e.status === 'LIVE'
    );
    const pendingRequests = department.clubCreationRequests.filter(
      r => r.status === 'PENDING'
    );

    return NextResponse.json({
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        isActive: department.isActive,
        hod: department.hod,
      },
      clubs: department.clubs,
      events: department.events,
      users: department.users,
      clubCreationRequests: department.clubCreationRequests,
      stats: {
        totalStudents: students.length,
        totalFaculty: faculty.length,
        totalClubs: activeClubs.length,
        totalEvents: department.events.length,
        activeEvents: activeEvents.length,
        pendingRequests: pendingRequests.length,
      },
    });
  } catch (error) {
    console.error('Department fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
