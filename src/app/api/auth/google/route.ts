import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { simpleHash, isVVCEEmail } from '@/lib/geo';

export async function POST(request: NextRequest) {
  try {
    const { googleToken, email, name, googleId } = await request.json();

    if (!email || !googleId) {
      return NextResponse.json(
        { error: 'Email and Google ID are required' },
        { status: 400 }
      );
    }

    if (!isVVCEEmail(email)) {
      return NextResponse.json(
        { error: 'Only @vvce.ac.in email addresses are allowed. Please use your college Google account.' },
        { status: 400 }
      );
    }

    // Check if user already exists with this email
    const existingUser = await db.user.findUnique({ where: { email } });

    if (existingUser) {
      // Link Google ID to existing account if not already linked
      if (!existingUser.googleId) {
        await db.user.update({
          where: { id: existingUser.id },
          data: {
            googleId,
            googleEmail: email,
          },
        });
      }

      // Check if account is active
      if (!existingUser.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated' },
          { status: 403 }
        );
      }

      // Check approval status
      if (existingUser.approvalStatus === 'PENDING') {
        return NextResponse.json(
          { error: 'Your account is pending admin approval' },
          { status: 403 }
        );
      }

      if (existingUser.approvalStatus === 'REJECTED') {
        return NextResponse.json(
          { error: 'Your account has been rejected' },
          { status: 403 }
        );
      }

      // Return user data (same format as login API)
      const { passwordHash: _, ...userWithoutPassword } = existingUser;
      return NextResponse.json({
        user: {
          ...userWithoutPassword,
          googleId,
          googleEmail: email,
        },
        message: 'Google sign-in successful',
      });
    }

    // No existing user — create new account
    // Generate a password hash from the googleId so the account has a valid passwordHash
    const generatedPasswordHash = simpleHash(`google-${googleId}-${Date.now()}`);

    const newUser = await db.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash: generatedPasswordHash,
        role: 'OTHER',
        approvalStatus: 'PENDING',
        googleId,
        googleEmail: email,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(
      {
        user: userWithoutPassword,
        message: 'Account created via Google! Your account is pending admin approval.',
        isNewUser: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
