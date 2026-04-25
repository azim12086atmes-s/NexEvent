import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST: Create a new club creation request (faculty only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      slug,
      description,
      category,
      requestedById,
      departmentId,
      facultyAdvisorId,
      autoJoin,
      requireApproval,
    } = body;

    if (!name || !slug || !description || !requestedById || !departmentId) {
      return NextResponse.json(
        { error: 'name, slug, description, requestedById, and departmentId are required' },
        { status: 400 }
      );
    }

    // Verify the requester is FACULTY role
    const requester = await db.user.findUnique({ where: { id: requestedById } });
    if (!requester || requester.role !== 'FACULTY') {
      return NextResponse.json(
        { error: 'Only faculty members can request club creation' },
        { status: 403 }
      );
    }

    // Auto-resolve hodId from the department's hodId field
    const department = await db.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check if a club with this slug already exists
    const existingClub = await db.club.findUnique({ where: { slug } });
    if (existingClub) {
      return NextResponse.json(
        { error: 'A club with this slug already exists' },
        { status: 409 }
      );
    }

    // Check for existing pending request with same name
    const existingRequest = await db.clubCreationRequest.findFirst({
      where: { name, status: 'PENDING' },
    });
    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending request for a club with this name already exists' },
        { status: 409 }
      );
    }

    const clubRequest = await db.clubCreationRequest.create({
      data: {
        name,
        slug,
        description,
        category: category || 'OTHER',
        requestedById,
        departmentId,
        hodId: department.hodId || null,
        status: 'PENDING',
        facultyAdvisorId: facultyAdvisorId || requestedById,
        autoJoin: autoJoin ?? false,
        requireApproval: requireApproval ?? true,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
        department: { select: { id: true, name: true, code: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ request: clubRequest, message: 'Club creation request submitted successfully' }, { status: 201 });
  } catch (error) {
    console.error('Club creation request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: List club creation requests with filters
export async function GET(request: NextRequest) {
  try {
    const departmentId = request.nextUrl.searchParams.get('departmentId');
    const status = request.nextUrl.searchParams.get('status');
    const hodId = request.nextUrl.searchParams.get('hodId');
    const requestedById = request.nextUrl.searchParams.get('requestedById');

    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (hodId) where.hodId = hodId;
    if (requestedById) where.requestedById = requestedById;

    const requests = await db.clubCreationRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
        department: { select: { id: true, name: true, code: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Club creation requests fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Review (approve/reject) a club creation request
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestUserId, requestId, action, rejectionReason } = body;

    if (!requestUserId || !requestId || !action) {
      return NextResponse.json(
        { error: 'requestUserId, requestId, and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Verify the reviewer is a valid HOD or ADMIN
    const reviewer = await db.user.findUnique({ where: { id: requestUserId } });
    if (!reviewer || !['HOD', 'ADMIN'].includes(reviewer.role)) {
      return NextResponse.json(
        { error: 'Only HODs or admins can review club creation requests' },
        { status: 403 }
      );
    }

    // Find the request
    const clubRequest = await db.clubCreationRequest.findUnique({
      where: { id: requestId },
    });

    if (!clubRequest) {
      return NextResponse.json(
        { error: 'Club creation request not found' },
        { status: 404 }
      );
    }

    if (clubRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Request has already been ${clubRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Create the club with data from the request
      const club = await db.club.create({
        data: {
          name: clubRequest.name,
          slug: clubRequest.slug,
          description: clubRequest.description,
          category: clubRequest.category,
          departmentId: clubRequest.departmentId,
          facultyAdvisorId: clubRequest.facultyAdvisorId || clubRequest.requestedById,
          approvalStatus: 'APPROVED',
          approvedById: requestUserId,
          approvedAt: new Date(),
          autoJoin: clubRequest.autoJoin,
          requireApproval: clubRequest.requireApproval,
        },
        include: {
          facultyAdvisor: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      });

      // Update the request status
      await db.clubCreationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedById: requestUserId,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        club,
        message: `Club "${club.name}" has been approved and created successfully`,
      });
    } else {
      // Reject the request
      if (!rejectionReason) {
        return NextResponse.json(
          { error: 'Rejection reason is required when rejecting a request' },
          { status: 400 }
        );
      }

      await db.clubCreationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedById: requestUserId,
          reviewedAt: new Date(),
          rejectionReason,
        },
      });

      return NextResponse.json({
        message: `Club creation request for "${clubRequest.name}" has been rejected`,
      });
    }
  } catch (error) {
    console.error('Club creation request review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
