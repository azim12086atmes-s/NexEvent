import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { simpleHash, isVVCEEmail } from '@/lib/geo';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role, department, usn, phone } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Name, email, password, and role are required' }, { status: 400 });
    }

    if (!isVVCEEmail(email)) {
      return NextResponse.json({ error: 'Only @vvce.ac.in email addresses are allowed' }, { status: 400 });
    }

    if (!['STUDENT', 'ORGANIZER', 'FACULTY', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: simpleHash(password),
        role,
        department: department || null,
        usn: usn || null,
        phone: phone || null,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword, message: 'Registration successful' }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
