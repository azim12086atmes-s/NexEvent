import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { simpleHash, isVVCEEmail } from '@/lib/geo';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!isVVCEEmail(email)) {
      return NextResponse.json({ error: 'Only @vvce.ac.in email addresses are allowed' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.passwordHash !== simpleHash(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
