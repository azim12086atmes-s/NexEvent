import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const approvalStatus = searchParams.get('approvalStatus');
    const departmentId = searchParams.get('departmentId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};
    if (role) where.role = role;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { usn: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          departmentId: true,
          usn: true,
          phone: true,
          approvalStatus: true,
          aictePoints: true,
          isActive: true,
          createdAt: true,
          department: { select: { id: true, name: true, code: true } },
          hodDepartment: { select: { id: true, name: true, code: true } },
          _count: {
            select: {
              registrations: true,
              clubMemberships: true,
              organizedEvents: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Users fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, targetUserId, role, approvalStatus, departmentId, isActive, usn } = body;

    if (!userId || !targetUserId) {
      return NextResponse.json({ error: 'User ID and target user ID are required' }, { status: 400 });
    }

    // Only admins can manage users
    const admin = await db.user.findUnique({ where: { id: userId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can manage users' }, { status: 403 });
    }

    const target = await db.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const updateData: any = {};

    // Role assignment
    if (role !== undefined) {
      if (!['STUDENT', 'FACULTY', 'HOD', 'ADMIN', 'OTHER'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      // Only admin can create other admins
      if (role === 'ADMIN' && admin.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can assign admin role' }, { status: 403 });
      }
      updateData.role = role;

      // If assigning HOD role, also set their department's hodId
      if (role === 'HOD' && departmentId) {
        const dept = await db.department.findUnique({ where: { id: departmentId } });
        if (dept) {
          await db.department.update({ where: { id: departmentId }, data: { hodId: targetUserId } });
        }
      }
      // If removing HOD role from current user, clear their department's hodId
      if (target.role === 'HOD' && role !== 'HOD' && target.hodDepartment) {
        // Clear the HOD reference - find which department they're HOD of
        const hodDepts = await db.department.findMany({ where: { hodId: targetUserId } });
        for (const dept of hodDepts) {
          await db.department.update({ where: { id: dept.id }, data: { hodId: null } });
        }
      }
    }

    if (approvalStatus !== undefined) {
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatus)) {
        return NextResponse.json({ error: 'Invalid approval status' }, { status: 400 });
      }
      updateData.approvalStatus = approvalStatus;
    }

    if (departmentId !== undefined) {
      updateData.departmentId = departmentId || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (usn !== undefined) {
      updateData.usn = usn || null;
    }

    const updated = await db.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        usn: true,
        approvalStatus: true,
        aictePoints: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ user: updated, message: 'User updated successfully' });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
