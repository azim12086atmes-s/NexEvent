import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { simpleHash, isVVCEEmail } from '@/lib/geo';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, department, usn, phone } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (!isVVCEEmail(email)) {
      return NextResponse.json({ error: 'Only @vvce.ac.in email addresses are allowed' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // New users get role OTHER and must be approved by admin
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: simpleHash(password),
        role: 'OTHER',
        approvalStatus: 'PENDING',
        phone: phone || null,
        usn: usn || null,
        departmentId: department || null,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return NextResponse.json({ 
      user: userWithoutPassword, 
      message: 'Registration successful! Your account is pending admin approval.' 
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
