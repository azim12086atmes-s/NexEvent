# NexEvent - Comprehensive Architecture & Implementation Plan

## AUDIT FINDINGS (What actually works vs what's broken)

### ✅ WORKING
1. **Login/Auth**: Basic email/password login works (but role system is wrong - allows self-selection of ORGANIZER, FACULTY)
2. **Event CRUD**: Create, Read, Update, Delete events all work at API level
3. **Event Registration**: Register for events, get QR code, cancel registration
4. **QR Scanner**: Manual input QR check-in works - scans QR code, validates against registration, checks geo-fence
5. **Club Management**: Join/Leave clubs, club detail page with roles/achievements
6. **Club Role Permissions**: CRUD for club roles, assign/revoke with delegation rules - THIS WORKS
7. **Event Role Creation/Assignment**: CRUD for event roles, assign/revoke with delegation rules - THIS WORKS
8. **Admin Panel**: Shows pending events, approve/reject workflow works
9. **Competition Config**: Creating events with rounds, criteria, teams - schema exists and API works
10. **PDF Report Generation**: Works via jsPDF

### ❌ BROKEN / MISSING
1. **ORGANIZER role still in code**: Register API accepts ORGANIZER, AuthModal has ORGANIZER option, Navbar shows ORGANIZER-specific nav
2. **No HOD role**: Not in schema, not in code
3. **No Department model**: No department-wise events or club-department relationship
4. **No admin-gated registration**: Anyone can register with any role (STUDENT, ORGANIZER, FACULTY)
5. **No CSV upload**: Admin cannot bulk-assign roles via CSV
6. **Default role is STUDENT**: Should be OTHER - admin must grant roles
7. **No UserApprovalStatus**: No approval workflow for new accounts
8. **Event status display bug**: Events show "Started" text for past dates, not showing LIVE properly
9. **Event delete too restrictive**: Only DRAFT/PENDING_APPROVAL can be deleted; organizer/faculty should be able to delete more broadly
10. **No Judge Scoring UI**: Judges cannot score participants - no UI exists
11. **No Score model**: Score model exists in schema but not pushed to DB yet, no API, no UI
12. **No Certificate system**: No cert model, API, or UI
13. **No AICTE points**: Not in schema or code
14. **No live geo-tracking**: Attendance is single check-in, not continuous tracking
15. **No club approval workflow**: Faculty cannot request clubs, HOD doesn't approve
16. **No HOD dashboard**: Doesn't exist
17. **My Events shown to Faculty/Admin**: Should be hidden for non-student roles
18. **Permissions (SCORE_PARTICIPANTS, VIEW_RESULTS, MANAGE_REGISTRATIONS, CHECK_IN_ATTENDEES, MANAGE_EVENT_ROLES)**: Only MANAGE_EVENT_ROLES has functional logic (in role assignment API). The others exist as strings in the permissions JSON but have NO enforcement or UI:
   - **SCORE_PARTICIPANTS**: No scoring API, no scoring UI - NOT FUNCTIONAL
   - **VIEW_RESULTS**: No results view API or UI - NOT FUNCTIONAL
   - **MANAGE_REGISTRATIONS**: Registration management is only available to organizer/admin/faculty by role, NOT by event role permission - NOT FUNCTIONAL via permission
   - **CHECK_IN_ATTENDEES**: QR scanner only checks user.role, doesn't check event role permissions - NOT FUNCTIONAL via permission
   - **MANAGE_EVENT_ROLES**: THIS IS FUNCTIONAL - role assign/revoke APIs check this permission
19. **No Google OAuth**: Not implemented
20. **Location tracking is NOT real-time**: Single ping at check-in, not continuous

### 🔶 PARTIALLY WORKING
1. **Event auto-status**: No auto-transition from APPROVED→LIVE→COMPLETED based on dates (schema supports it but no cron/auto logic)
2. **Geo-fencing**: Single check-in validation works, but NO continuous tracking or attendance % calculation

---

## SCHEMA DESIGN (Careful, line-by-line)

### Core Principle: ADMIN controls all role assignments
- Default role: OTHER (not STUDENT)
- Admin uploads CSV with emails → system grants roles
- No self-selection of FACULTY/HOD/STUDENT during registration
- Registration creates account with OTHER role → admin assigns role later

### Roles: ADMIN, HOD, FACULTY, STUDENT, OTHER
- ORGANIZER is REMOVED completely
- Faculty who are club advisors become event organizers by default
- Students with club permissions can also create events (via CLUB_PERMISSION)

### Department Model
- Every department has one HOD
- Clubs belong to departments
- Events can be department-specific
- Faculty belong to departments

### AICTE Points
- Field on User model: `aictePoints` (Float, default 0)
- Field on Event model: `aictePoints` (Float?, nullable) - organizer sets this
- When attendance is confirmed or registration confirmed, AICTE points are awarded
- Separate field for volunteer AICTE points vs participant AICTE points
- EventRole can specify AICTE points for that role (e.g., volunteers get X pts)

### Scoring/Judging
- Organizer creates scoring criteria per round
- Judge has SCORE_PARTICIPANTS permission
- Judge sees open rounds, scores each criterion
- Scores aggregate per round → per event
- Results visible to those with VIEW_RESULTS permission

### Certificates
- Organizer defines certificate templates per event
- Can be round-specific or event-wide (round-free)
- Participation certificates auto-issued when eliminated (if organizer enables)
- Certificate generation on demand or auto

### Live Geo-Tracking
- LocationPing model stores periodic GPS pings from attendees
- Attendance % = pings within fence / total pings
- Requires a mini-service or client-side interval ping

---

## IMPLEMENTATION PHASES

### Phase 1: Schema + Core Role System (CRITICAL - foundation for everything)
1. Update Prisma schema: remove ORGANIZER, add HOD/OTHER, Department, ClubCreationRequest, Score, Certificate, LocationPing, AICTE fields
2. Push schema to DB
3. Update register API: default role=OTHER, no role self-selection
4. Update AuthModal: remove role selection, just email+password
5. Update auth-store types: remove ORGANIZER, add HOD/OTHER
6. Update Navbar: remove ORGANIZER references, add HOD nav items
7. Create Admin CSV upload API for role assignment
8. Create Department CRUD API
9. Update seed data

### Phase 2: Admin Panel - Role Assignment & User Management
1. Admin can view all users, filter by role/approval status
2. Admin can manually assign roles (HOD, FACULTY, STUDENT)
3. Admin can upload CSV → bulk assign roles
4. Admin can create departments and assign HOD
5. Admin can approve/reject user accounts
6. User list with search/filter in Admin Panel

### Phase 3: Department & HOD System
1. HOD Dashboard: see department clubs, events, faculty
2. Faculty creates club under department → HOD approves
3. Club approval workflow UI
4. Department events filtering
5. Remove "My Events" from Faculty/Admin/HOD nav

### Phase 4: Scoring/Judging System
1. Score API: POST scores per criterion per round
2. Score aggregation API: calculate totals per team/participant
3. Judge Scoring UI: shows open rounds, criteria, input scores
4. Results view: for those with VIEW_RESULTS permission
5. Enforce SCORE_PARTICIPANTS and VIEW_RESULTS permissions in API

### Phase 5: Certificate System
1. Certificate template API: organizer creates cert definitions
2. Auto-issue logic: participation certs when eliminated
3. Certificate generation (PDF) per user
4. Certificate download UI for students
5. Round-based vs round-free certificate logic

### Phase 6: AICTE Points System
1. Add aictePoints to User model (if not done in Phase 1)
2. Event organizer sets AICTE points for participation/volunteering
3. Auto-award points on registration confirmation / attendance
4. AICTE points history/ledger
5. Display points on student profile

### Phase 7: Bug Fixes & Permission Enforcement
1. Fix event status display (LIVE events showing "Started" instead of live)
2. Allow broader event deletion for organizers/faculty
3. Enforce CHECK_IN_ATTENDEES permission in QR scanner
4. Enforce MANAGE_REGISTRATIONS permission in registration management
5. Enforce all permissions in relevant APIs

### Phase 8: Live Geo-Tracking (Advanced)
1. Client-side periodic location ping
2. LocationPing API endpoint
3. Attendance % calculation from ping data
4. Real-time attendance dashboard for organizers

### Phase 9: Google OAuth
1. Set up Google OAuth credentials
2. Auth callback handling
3. Link Google accounts to existing users
4. Fallback for non-Google users

---

## CURRENT PERMISSION STATUS

| Permission | API Enforcement | UI Implementation | Status |
|---|---|---|---|
| SCORE_PARTICIPANTS | ❌ No API | ❌ No UI | NOT FUNCTIONAL |
| VIEW_RESULTS | ❌ No API | ❌ No UI | NOT FUNCTIONAL |
| MANAGE_REGISTRATIONS | ❌ Not checked | ⚠️ By role only | PARTIALLY |
| CHECK_IN_ATTENDEES | ❌ Not checked | ⚠️ By role only | PARTIALLY |
| MANAGE_EVENT_ROLES | ✅ Checked in API | ✅ UI works | FUNCTIONAL |
| EDIT_CLUB_PAGE | ✅ Checked in API | ✅ UI works | FUNCTIONAL |
| CREATE_CLUB_EVENT | ✅ Checked in API | ✅ UI works | FUNCTIONAL |
| MANAGE_MEMBERS | ❌ Not enforced | ⚠️ Basic UI | PARTIALLY |
| MANAGE_ROLES | ✅ Checked in API | ✅ UI works | FUNCTIONAL |
| VIEW_ANALYTICS | ❌ No API | ❌ No UI | NOT FUNCTIONAL |
| MANAGE_ACHIEVEMENTS | ✅ Checked in API | ✅ UI works | FUNCTIONAL |
