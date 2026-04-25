# Task 3+4: Faculty Dashboard Enhancement & Club Creation Request Flow

## Task ID: 3+4
## Agent: Code Agent
## Date: 2026-03-05

## Summary
Enhanced the Faculty Dashboard (OrganizerDashboard) and created the Club Creation Request flow for faculty, including POST API for creating club requests and comprehensive UI updates.

## Changes Made

### 1. POST Handler - `/api/clubs/creation-requests/route.ts`
- **Added POST handler** for faculty to create club creation requests
- Body accepts: `{ name, slug, description, category, requestedById, departmentId, facultyAdvisorId?, autoJoin?, requireApproval? }`
- Validates that the requester is FACULTY role (403 if not)
- Auto-resolves `hodId` from the department's `hodId` field
- Checks for existing club with same slug (409 conflict)
- Checks for existing pending request with same name (409 conflict)
- Creates ClubCreationRequest with status PENDING
- Returns 201 with the created request including related data
- **Also added** `requestedById` filter parameter to the existing GET handler

### 2. OrganizerDashboard.tsx - Complete Rewrite
The dashboard was significantly enhanced with the following changes:

#### Removed: "My Events" section
- The list of events with "My Events" heading has been removed
- Replaced with more useful content sections

#### Added: "Request New Club" dialog/button
- "Request Club" button with Building2 icon next to "New Event" button
- Only visible for FACULTY role users
- Opens a Dialog form with:
  - Club Name (required)
  - Slug (auto-generated from name, customizable)
  - Description (required, textarea)
  - Category select (TECHNICAL, CULTURAL, SPORTS, etc.)
  - Department select (auto-detects user's department)
  - Auto-Join toggle (students can join without approval)
  - Require Approval toggle (students need club approval)
- On submit, POSTs to `/api/clubs/creation-requests`
- Shows success toast and refreshes club requests list
- Proper form validation

#### Added: "My Club Requests" section (replaces "My Events")
- Fetches club creation requests by current user via GET `/api/clubs/creation-requests?requestedById=xxx`
- Grid layout with animated cards
- Status badges with color coding:
  - PENDING: amber with Clock icon
  - APPROVED: emerald with CheckCircle2 icon
  - REJECTED: red with XCircle icon
- Shows department, category, creation date, and auto-join flag
- For rejected requests: shows rejection reason in red alert box
- For approved requests: shows "View Club" link navigating to club-detail
- Pending count badge in section header
- Empty state with rotating dashed border animation

#### Added: "Assign Student Organizer" section
- Below the registration overview section
- Only shows for events that have a club (clubId)
- Each event card shows:
  - Event title with Crown icon
  - Club member count and assigned organizer count
  - Currently assigned organizers shown as violet badges
  - Expandable "Assign" form with:
    - Student selector (populated from club members)
    - Assign button that creates/finds an Organizer event role
    - Permissions: CREATE_EVENT, EDIT_EVENT, MANAGE_REGISTRATIONS
  - Calls POST `/api/events/[id]/roles/assign` for assignment
  - Auto-creates Organizer role via POST `/api/events/[id]/roles` if none exists
- Empty state when no club events exist

#### Added: "Events Quick Access" section
- Grid of event cards (replaces the old list-style "My Events")
- Compact cards with status badges, date, venue, registration count
- Report download and View buttons
- Hover scale animation

### 3. Code Quality Fixes
- Removed `useCallback` dependency (unused after refactor)
- Converted slug auto-generation from useEffect to inline in handleClubFormChange (fixed `react-hooks/set-state-in-effect` lint error)
- Converted loadData from useCallback to inline async function in useEffect with cleanup (fixed `react-hooks/set-state-in-effect` lint error)
- All code passes `bun run lint` with zero errors

## Files Modified
- `/home/z/my-project/src/app/api/clubs/creation-requests/route.ts` - Added POST handler and requestedById filter
- `/home/z/my-project/src/components/nexevent/OrganizerDashboard.tsx` - Complete rewrite with new sections

## No Changes Needed
- `CreateEventForm.tsx` - Faculty already can create events, no changes needed
- Prisma schema - ClubCreationRequest model already existed with all required fields
