---
Task ID: 1
Agent: full-stack-developer
Task: Phase 1 - Schema redesign + Core Role System

Work Log:
- Read worklog.md to understand current project state (6 sessions of prior work)
- Updated Prisma schema: UserRole enum (removed ORGANIZER, added OTHER), User model (role default → OTHER, approvalStatus → PENDING, added aictePoints, googleId, googleEmail, departmentId, fixed ClubCreationRequest relations), Event model (added aictePoints, volunteerAictePoints), Department model (added clubCreationRequests relation), Event model (added locationPings relation)
- Pushed schema to database after fixing missing opposite relation fields (Department.clubCreationRequests, Event.locationPings)
- Reset database and re-seeded with new data: 5 departments, 2 HODs, former ORGANIZERs → STUDENTs
- Updated Registration API: removed role from required fields, default role=OTHER, default approvalStatus=PENDING
- Updated Login API: added approvalStatus checks (PENDING → "pending admin approval", REJECTED → "account rejected")
- Updated AuthModal: removed Role/USN/Department fields from registration, simplified to name+email+password, updated demo accounts (Admin, Faculty, HOD, Student)
- Updated Auth Store: role type → 'STUDENT'|'FACULTY'|'HOD'|'ADMIN'|'OTHER', added departmentId and approvalStatus to AuthUser, register no longer auto-logs in
- Updated Navbar: Dashboard/Create/Admin/ScanQR for FACULTY/HOD/ADMIN, My Events for STUDENT/OTHER only, added HOD and OTHER to roleColors, removed ORGANIZER
- Updated AdminPanel: access for ADMIN, HOD, FACULTY
- Updated OrganizerDashboard: title → "Event Dashboard", badge shows dynamic role instead of "Organizer"
- Updated QRScanner: access for FACULTY, HOD, ADMIN (removed ORGANIZER)
- Updated EventFeed: Create Event buttons for FACULTY, HOD, ADMIN (replaced ORGANIZER with HOD)
- Updated CreateEventForm: access check for FACULTY, HOD, ADMIN
- Updated Events API: ['FACULTY', 'HOD', 'ADMIN'] for event creation
- Updated ProfileView: added HOD and OTHER to roleColors/roleGradients, removed ORGANIZER
- Updated Seed data: departments, HODs, departmentId on clubs, approvalStatus on all users
- Lint passes with zero errors

Stage Summary:
- ORGANIZER role completely removed from all code, schema, and seed data
- HOD and OTHER roles added to enum, UI, and role checks
- New user approval system (PENDING → APPROVED/REJECTED) implemented in login API
- Department model with HOD relationships fully functional
- Registration simplified to name+email+password (role assigned by admin)
- All 16 files updated successfully
- Lint clean, dev server running, database re-seeded with 23 users across 4 roles
