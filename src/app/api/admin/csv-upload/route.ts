import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { simpleHash } from '@/lib/geo';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const csvType = formData.get('type') as string; // 'students' or 'faculty'
    const adminId = formData.get('adminId') as string;

    if (!file || !csvType || !adminId) {
      return NextResponse.json({ error: 'File, type, and admin ID are required' }, { status: 400 });
    }

    // Only admins can upload CSV
    const admin = await db.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can upload CSV files' }, { status: 403 });
    }

    const csvText = await file.text();
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have at least a header row and one data row' }, { status: 400 });
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    const results = {
      total: 0,
      updated: 0,
      created: 0,
      notFound: 0,
      errors: [] as string[],
    };

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      results.total++;

      const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const email = row['email']?.toLowerCase();
      if (!email) {
        results.errors.push(`Row ${i + 1}: Missing email`);
        continue;
      }

      // Find department by code
      let deptId: string | null = null;
      const deptCode = row['department_code'] || row['department'] || row['dept'];
      if (deptCode) {
        const dept = await db.department.findFirst({
          where: { code: { equals: deptCode, mode: 'insensitive' } },
        });
        if (dept) deptId = dept.id;
      }

      const existingUser = await db.user.findUnique({ where: { email } });

      if (csvType === 'students') {
        const name = row['name'] || '';
        const usn = row['usn'] || '';
        
        if (existingUser) {
          // Update existing user
          await db.user.update({
            where: { id: existingUser.id },
            data: {
              role: 'STUDENT',
              approvalStatus: 'APPROVED',
              departmentId: deptId || existingUser.departmentId,
              usn: usn || existingUser.usn,
              name: name || existingUser.name,
            },
          });
          results.updated++;
        } else {
          // Create new user with email as default password
          try {
            await db.user.create({
              data: {
                email,
                name: name || email.split('@')[0],
                passwordHash: simpleHash(email.split('@')[0]),
                role: 'STUDENT',
                approvalStatus: 'APPROVED',
                departmentId: deptId,
                usn: usn || null,
              },
            });
            results.created++;
          } catch (e) {
            results.errors.push(`Row ${i + 1}: Failed to create user - ${email}`);
          }
        }
      } else if (csvType === 'faculty') {
        const name = row['name'] || '';
        const roleStr = (row['role'] || 'FACULTY').toUpperCase();
        const targetRole = roleStr === 'HOD' ? 'HOD' : 'FACULTY';

        if (existingUser) {
          // Update existing user
          await db.user.update({
            where: { id: existingUser.id },
            data: {
              role: targetRole,
              approvalStatus: 'APPROVED',
              departmentId: deptId || existingUser.departmentId,
              name: name || existingUser.name,
            },
          });

          // If HOD, set department's hodId
          if (targetRole === 'HOD' && deptId) {
            await db.department.update({ where: { id: deptId }, data: { hodId: existingUser.id } });
          }
          results.updated++;
        } else {
          // Create new user
          try {
            const newUser = await db.user.create({
              data: {
                email,
                name: name || email.split('@')[0],
                passwordHash: simpleHash(email.split('@')[0]),
                role: targetRole,
                approvalStatus: 'APPROVED',
                departmentId: deptId,
              },
            });

            if (targetRole === 'HOD' && deptId) {
              await db.department.update({ where: { id: deptId }, data: { hodId: newUser.id } });
            }
            results.created++;
          } catch (e) {
            results.errors.push(`Row ${i + 1}: Failed to create user - ${email}`);
          }
        }
      }
    }

    return NextResponse.json({ results, message: `Processed ${results.total} rows: ${results.updated} updated, ${results.created} created, ${results.errors.length} errors` });
  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
