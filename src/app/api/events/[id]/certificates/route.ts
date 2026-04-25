import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jsPDF from 'jspdf';

// ============================================================
// CERTIFICATE PDF GENERATOR
// ============================================================

function generateCertificatePDF(certificate: any, event: any, user: any): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Outer border - elegant double line
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(2);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // Corner decorations
  const cornerSize = 15;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(1);
  // Top-left
  doc.line(12, 12 + cornerSize, 12, 12); doc.line(12, 12, 12 + cornerSize, 12);
  // Top-right
  doc.line(pageW - 12 - cornerSize, 12, pageW - 12, 12); doc.line(pageW - 12, 12, pageW - 12, 12 + cornerSize);
  // Bottom-left
  doc.line(12, pageH - 12 - cornerSize, 12, pageH - 12); doc.line(12, pageH - 12, 12 + cornerSize, pageH - 12);
  // Bottom-right
  doc.line(pageW - 12 - cornerSize, pageH - 12, pageW - 12, pageH - 12); doc.line(pageW - 12, pageH - 12, pageW - 12, pageH - 12 - cornerSize);

  // Header decoration line
  doc.setFillColor(30, 58, 95);
  doc.rect(40, 28, pageW - 80, 1.5, 'F');

  // College name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Vidyavardhaka College of Engineering, Mysuru', pageW / 2, 24, { align: 'center' });

  // Certificate type
  const typeLabels: Record<string, string> = {
    PARTICIPATION: 'Certificate of Participation',
    WINNER: 'Certificate of Achievement',
    RUNNER_UP: 'Certificate of Achievement',
    BEST_PERFORMER: 'Certificate of Excellence',
    SPECIAL_MENTION: 'Certificate of Special Mention',
    CUSTOM: 'Certificate',
  };
  const certTitle = typeLabels[certificate.certificateType] || 'Certificate';
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(30, 58, 95);
  doc.text(certTitle, pageW / 2, 42, { align: 'center' });

  // Decorative line below title
  doc.setFillColor(180, 140, 60);
  doc.rect(80, 46, pageW - 160, 0.8, 'F');

  // Body text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);

  // "This is to certify that"
  doc.text('This is to certify that', pageW / 2, 60, { align: 'center' });

  // Student name - large and bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(30, 58, 95);
  doc.text(user.name || 'Participant', pageW / 2, 75, { align: 'center' });

  // Name underline
  const nameWidth = doc.getTextWidth(user.name || 'Participant');
  doc.setDrawColor(180, 140, 60);
  doc.setLineWidth(0.5);
  doc.line(pageW / 2 - nameWidth / 2 - 10, 78, pageW / 2 + nameWidth / 2 + 10, 78);

  // Action text
  const actionMap: Record<string, string> = {
    PARTICIPATION: 'has actively participated in',
    WINNER: 'won',
    RUNNER_UP: 'was the Runner-Up in',
    BEST_PERFORMER: 'was the Best Performer in',
    SPECIAL_MENTION: 'received Special Mention in',
    CUSTOM: 'was recognized in',
  };
  const action = actionMap[certificate.certificateType] || 'participated in';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(`has ${action}`, pageW / 2, 90, { align: 'center' });

  // Event name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95);
  doc.text(`"${event.title}"`, pageW / 2, 103, { align: 'center' });

  // Round-specific text
  let yPos = 113;
  if (certificate.roundId && certificate.round) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(`in the ${certificate.round.name} round`, pageW / 2, yPos, { align: 'center' });
    yPos += 10;
  }

  // Event details line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const eventDate = new Date(event.startDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const detailsLine = `held at ${event.venue} on ${eventDate}`;
  doc.text(detailsLine, pageW / 2, yPos, { align: 'center' });
  yPos += 8;

  // Certificate description if custom
  if (certificate.description) {
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(certificate.description, pageW / 2, yPos, { align: 'center' });
    yPos += 8;
  }

  // Signature lines
  const sigY = pageH - 40;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);

  // Faculty Advisor signature
  doc.line(40, sigY, 110, sigY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Faculty Advisor', 75, sigY + 5, { align: 'center' });

  // HOD signature
  doc.line(pageW - 110, sigY, pageW - 40, sigY);
  doc.text('Head of Department', pageW / 2 + 55, sigY + 5, { align: 'center' });

  // Principal signature (center)
  doc.line(pageW / 2 - 35, sigY, pageW / 2 + 35, sigY);
  doc.text('Principal', pageW / 2, sigY + 5, { align: 'center' });

  // Certificate ID
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Certificate ID: ${certificate.id}`, pageW - 15, pageH - 15, { align: 'right' });

  // Generated date
  const genDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.text(`Generated: ${genDate}`, 15, pageH - 15);

  // Bottom decoration line
  doc.setFillColor(30, 58, 95);
  doc.rect(40, pageH - 24, pageW - 80, 1, 'F');

  return Buffer.from(doc.output('arraybuffer'));
}

// ============================================================
// GET - List certificates for an event
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const roundId = searchParams.get('roundId');
    const certificateType = searchParams.get('certificateType');
    const scope = searchParams.get('scope');

    // Verify event exists
    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Build filters
    const where: any = { eventId: id };
    if (roundId) where.roundId = roundId;
    if (certificateType) where.certificateType = certificateType;
    if (scope) where.scope = scope;

    // Permission check: students can only see their own
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user && user.role === 'STUDENT') {
        where.OR = [
          { userId: userId },
          { userId: null }, // templates visible to all
        ];
      }
    }

    const certificates = await db.certificate.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, usn: true } },
        round: { select: { id: true, name: true, roundNumber: true } },
        event: { select: { id: true, title: true, venue: true, startDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Count issued vs templates
    const templates = certificates.filter(c => c.userId === null);
    const issued = certificates.filter(c => c.userId !== null);

    return NextResponse.json({
      certificates,
      summary: {
        total: certificates.length,
        templates: templates.length,
        issued: issued.length,
      },
    });
  } catch (error) {
    console.error('Certificate list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// POST - Create certificate template or issue certificates
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, title, description, certificateType, scope, roundId, isDefault, templateData, action, requestUserId } = body;

    // Verify event
    const event = await db.event.findUnique({
      where: { id },
      include: { competitionConfig: { include: { rounds: true } } },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Permission check
    const requestUser = requestUserId ? await db.user.findUnique({ where: { id: requestUserId } }) : null;
    if (!requestUser || !['ADMIN', 'FACULTY', 'HOD'].includes(requestUser.role)) {
      // Also allow event organizer
      if (!requestUser || (event.organizerId !== requestUser.id && requestUser.role !== 'ADMIN')) {
        return NextResponse.json({ error: 'Only organizers, faculty, HOD, or admins can create certificates' }, { status: 403 });
      }
    }

    // Auto-issue action
    if (action === 'auto-issue') {
      const templateId = body.templateId;
      if (!templateId) {
        return NextResponse.json({ error: 'Template ID required for auto-issue' }, { status: 400 });
      }

      const template = await db.certificate.findUnique({
        where: { id: templateId },
        include: { event: true },
      });
      if (!template || template.eventId !== id) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      if (template.userId) {
        return NextResponse.json({ error: 'This is not a template (already issued)' }, { status: 400 });
      }

      // Get eligible users
      let eligibleUserIds: string[] = [];

      if (template.scope === 'ROUND_SPECIFIC' && template.roundId) {
        // Get users registered for this round (via registrations with currentRoundId)
        const registrations = await db.eventRegistration.findMany({
          where: {
            eventId: id,
            status: { in: ['REGISTERED', 'CONFIRMED'] },
            currentRoundId: template.roundId,
          },
          select: { userId: true },
        });
        eligibleUserIds = registrations.map(r => r.userId);

        // If no registrations have currentRoundId, fall back to all event registrations
        if (eligibleUserIds.length === 0) {
          const allRegs = await db.eventRegistration.findMany({
            where: {
              eventId: id,
              status: { in: ['REGISTERED', 'CONFIRMED'] },
            },
            select: { userId: true },
          });
          eligibleUserIds = allRegs.map(r => r.userId);
        }
      } else {
        // EVENT_WIDE - all registered participants
        const registrations = await db.eventRegistration.findMany({
          where: {
            eventId: id,
            status: { in: ['REGISTERED', 'CONFIRMED'] },
          },
          select: { userId: true },
        });
        eligibleUserIds = registrations.map(r => r.userId);
      }

      // Filter out users who already have this type of certificate
      const existingCerts = await db.certificate.findMany({
        where: {
          eventId: id,
          certificateType: template.certificateType,
          scope: template.scope,
          roundId: template.roundId,
          userId: { not: null },
        },
        select: { userId: true },
      });
      const existingUserIds = new Set(existingCerts.map(c => c.userId));
      const newUsers = eligibleUserIds.filter(uid => !existingUserIds.has(uid));

      // Issue certificates
      const issued = [];
      for (const uid of newUsers) {
        const cert = await db.certificate.create({
          data: {
            eventId: id,
            roundId: template.roundId,
            userId: uid,
            title: template.title,
            description: template.description,
            certificateType: template.certificateType,
            scope: template.scope,
            templateData: template.templateData,
            isDefault: false,
            issuedAt: new Date(),
          },
        });
        issued.push(cert);
      }

      return NextResponse.json({
        message: `Issued ${issued.length} certificates`,
        issued: issued.length,
        skipped: existingUserIds.size,
        totalEligible: eligibleUserIds.length,
      });
    }

    // Create a single certificate or template
    if (!title || !certificateType) {
      return NextResponse.json({ error: 'Title and certificate type are required' }, { status: 400 });
    }

    // If userId is provided, issue directly
    if (userId) {
      // Check if user already has this type
      const existing = await db.certificate.findFirst({
        where: {
          eventId: id,
          userId,
          certificateType,
          scope: scope || 'EVENT_WIDE',
          roundId: roundId || null,
        },
      });
      if (existing) {
        return NextResponse.json({ error: 'User already has this type of certificate' }, { status: 409 });
      }

      const certificate = await db.certificate.create({
        data: {
          eventId: id,
          roundId: roundId || null,
          userId,
          title,
          description: description || null,
          certificateType,
          scope: scope || 'EVENT_WIDE',
          templateData: templateData || null,
          isDefault: isDefault || false,
          issuedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          round: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ certificate }, { status: 201 });
    }

    // Otherwise, create a template (userId = null)
    const template = await db.certificate.create({
      data: {
        eventId: id,
        roundId: roundId || null,
        userId: null,
        title,
        description: description || null,
        certificateType,
        scope: scope || 'EVENT_WIDE',
        templateData: templateData || null,
        isDefault: isDefault || false,
        issuedAt: null,
      },
      include: {
        round: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ certificate: template }, { status: 201 });
  } catch (error) {
    console.error('Certificate create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// PUT - Generate certificate PDF
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { certificateId, action, requestUserId } = body;

    if (action === 'generate' && certificateId) {
      // Fetch certificate with all needed data
      const certificate = await db.certificate.findUnique({
        where: { id: certificateId },
        include: {
          event: { select: { id: true, title: true, venue: true, startDate: true, endDate: true } },
          user: { select: { id: true, name: true, email: true, usn: true } },
          round: { select: { id: true, name: true, roundNumber: true } },
        },
      });

      if (!certificate || certificate.eventId !== id) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
      }

      if (!certificate.userId || !certificate.user) {
        return NextResponse.json({ error: 'Cannot generate PDF for template (no user assigned)' }, { status: 400 });
      }

      // Generate PDF
      const pdfBuffer = generateCertificatePDF(certificate, certificate.event, certificate.user);
      const base64Pdf = pdfBuffer.toString('base64');

      // Update certificate with URL and issued date
      await db.certificate.update({
        where: { id: certificateId },
        data: {
          certificateUrl: `data:application/pdf;base64,${base64Pdf.substring(0, 50)}...`,
          issuedAt: certificate.issuedAt || new Date(),
        },
      });

      // Return the PDF as base64 for client-side download
      return NextResponse.json({
        pdf: base64Pdf,
        fileName: `${certificate.certificateType}_${certificate.user.name.replace(/\s+/g, '_')}_${certificate.event.title.replace(/\s+/g, '_')}.pdf`,
        certificateId: certificate.id,
      });
    }

    // Generate all PDFs for event
    if (action === 'generate-all') {
      const certificates = await db.certificate.findMany({
        where: { eventId: id, userId: { not: null } },
        include: {
          event: { select: { id: true, title: true, venue: true, startDate: true, endDate: true } },
          user: { select: { id: true, name: true, email: true, usn: true } },
          round: { select: { id: true, name: true, roundNumber: true } },
        },
      });

      const generated = [];
      for (const cert of certificates) {
        if (!cert.user) continue;
        const pdfBuffer = generateCertificatePDF(cert, cert.event, cert.user);
        const base64Pdf = pdfBuffer.toString('base64');
        await db.certificate.update({
          where: { id: cert.id },
          data: {
            certificateUrl: `data:application/pdf;base64,${base64Pdf.substring(0, 50)}...`,
            issuedAt: cert.issuedAt || new Date(),
          },
        });
        generated.push({ id: cert.id, userName: cert.user.name });
      }

      return NextResponse.json({
        message: `Generated ${generated.length} certificate PDFs`,
        generated: generated.length,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Certificate PDF generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// DELETE - Delete certificate template
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const certificateId = searchParams.get('certificateId');
    const requestUserId = searchParams.get('userId');

    if (!certificateId) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 });
    }

    const certificate = await db.certificate.findUnique({ where: { id: certificateId } });
    if (!certificate || certificate.eventId !== id) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    // Permission check
    const event = await db.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const requestUser = requestUserId ? await db.user.findUnique({ where: { id: requestUserId } }) : null;
    const isAdmin = requestUser?.role === 'ADMIN';

    // Can delete templates (userId = null) or issued certificates (admin only)
    if (certificate.userId && !isAdmin) {
      return NextResponse.json({ error: 'Cannot delete issued certificates (admin only)' }, { status: 403 });
    }

    if (!isAdmin && event.organizerId !== requestUserId && !['FACULTY', 'HOD'].includes(requestUser?.role || '')) {
      return NextResponse.json({ error: 'Not authorized to delete certificates' }, { status: 403 });
    }

    await db.certificate.delete({ where: { id: certificateId } });
    return NextResponse.json({ message: 'Certificate deleted' });
  } catch (error) {
    console.error('Certificate delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
