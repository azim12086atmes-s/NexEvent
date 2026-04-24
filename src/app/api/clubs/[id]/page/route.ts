import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserClubPermissions } from '../route';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, mission, vision, highlights, socialLinks, contactEmail, contactPhone } = body;

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });

    const perms = await getUserClubPermissions(userId, id);
    const user = await db.user.findUnique({ where: { id: userId } });
    const club = await db.club.findUnique({ where: { id } });
    const isExempt = (user?.role === 'ADMIN') || (club?.facultyAdvisorId === userId);

    if (!isExempt && !perms.includes('EDIT_CLUB_PAGE')) {
      return NextResponse.json({ error: 'You do not have permission to edit the club page' }, { status: 403 });
    }
    if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

    const updateData: any = {};
    if (mission !== undefined) updateData.mission = mission;
    if (vision !== undefined) updateData.vision = vision;
    if (highlights !== undefined) updateData.highlights = typeof highlights === 'string' ? highlights : JSON.stringify(highlights);
    if (socialLinks !== undefined) updateData.socialLinks = typeof socialLinks === 'string' ? socialLinks : JSON.stringify(socialLinks);
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;

    const updated = await db.club.update({
      where: { id },
      data: updateData,
      include: {
        facultyAdvisor: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, events: true } },
      },
    });

    return NextResponse.json({ club: updated, message: 'Club page updated successfully' });
  } catch (error) {
    console.error('Club page update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
