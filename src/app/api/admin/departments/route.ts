import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const departments = await db.department.findMany({
      include: {
        hod: { select: { id: true, name: true, email: true } },
        _count: { select: { clubs: true, users: true, events: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error('Departments fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, description, userId } = body;

    if (!userId || !name || !code) {
      return NextResponse.json({ error: 'User ID, name, and code are required' }, { status: 400 });
    }

    const admin = await db.user.findUnique({ where: { id: userId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can create departments' }, { status: 403 });
    }

    const existing = await db.department.findFirst({
      where: { OR: [{ name }, { code: code.toUpperCase() }] },
    });
    if (existing) {
      return NextResponse.json({ error: 'Department with this name or code already exists' }, { status: 409 });
    }

    const department = await db.department.create({
      data: {
        name,
        code: code.toUpperCase(),
        description: description || null,
      },
    });

    return NextResponse.json({ department, message: 'Department created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Department create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, departmentId, hodId, name, code, description } = body;

    if (!userId || !departmentId) {
      return NextResponse.json({ error: 'User ID and department ID are required' }, { status: 400 });
    }

    const admin = await db.user.findUnique({ where: { id: userId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can update departments' }, { status: 403 });
    }

    const dept = await db.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (description !== undefined) updateData.description = description;

    // Assign HOD
    if (hodId !== undefined) {
      if (hodId) {
        const hodUser = await db.user.findUnique({ where: { id: hodId } });
        if (!hodUser || hodUser.role !== 'HOD') {
          return NextResponse.json({ error: 'Selected user must have HOD role' }, { status: 400 });
        }
        updateData.hodId = hodId;
      } else {
        updateData.hodId = null;
      }
    }

    const department = await db.department.update({
      where: { id: departmentId },
      data: updateData,
      include: { hod: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ department, message: 'Department updated successfully' });
  } catch (error) {
    console.error('Department update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const userId = searchParams.get('userId');

    if (!userId || !departmentId) {
      return NextResponse.json({ error: 'User ID and department ID are required' }, { status: 400 });
    }

    const admin = await db.user.findUnique({ where: { id: userId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete departments' }, { status: 403 });
    }

    const dept = await db.department.findUnique({
      where: { id: departmentId },
      include: { _count: { select: { clubs: true, users: true } } },
    });
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (dept._count.clubs > 0 || dept._count.users > 0) {
      return NextResponse.json({ error: 'Cannot delete department with existing clubs or users. Remove them first.' }, { status: 400 });
    }

    await db.department.delete({ where: { id: departmentId } });
    return NextResponse.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Department delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
