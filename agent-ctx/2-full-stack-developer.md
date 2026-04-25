# Task ID: 2 - Restrict faculty to only create events for their own clubs

## Agent: full-stack-developer

## Summary
Implemented faculty club restriction in both frontend (CreateEventForm) and backend (Events API) to ensure faculty can only create events for clubs they belong to.

## Changes Made

### 1. CreateEventForm (`src/components/nexevent/CreateEventForm.tsx`)
- Replaced `clubs` state with `allClubs` state + `useMemo`-derived `clubs`
- Faculty: filtered to clubs where `facultyAdvisorId === user.id` or `members.some(m => m.userId === user.id)`
- ADMIN/HOD: see all clubs
- Auto-select: if faculty belongs to exactly one club, pre-set as default `clubId`
- Info Badge: "Only your clubs are shown" next to Club label for faculty
- Empty state: Building2 icon + message "You can only create events for clubs you're a faculty advisor or member of. Join a club first."
- "No club" option preserved (clubId = 'none' → null)

### 2. Events API POST (`src/app/api/events/route.ts`)
- Added faculty club membership validation after required fields check
- Query: `db.club.findFirst({ where: { id: clubId, OR: [{ facultyAdvisorId: userId }, { members: { some: { userId } } }] } })`
- Returns 403 if faculty tries to create event for unauthorized club
- ADMIN and HOD bypass validation

## Lint Status
- All changes pass `bun run lint` with zero errors ✅
