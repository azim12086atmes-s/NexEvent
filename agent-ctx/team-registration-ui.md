# Team Registration UI - Work Record

## Task: Add team registration UI for competition events

### What was created/modified:

1. **NEW: `/src/app/api/events/[id]/teams/route.ts`** - Teams API
   - **GET**: List all teams for an event with leader and member info; also returns `userTeam` if the user is on a team
   - **POST**: Two actions:
     - `action: 'create'` - Creates a new team with auto-generated 6-char code, sets user as leader, creates EventRegistration
     - `action: 'join'` - Joins an existing team via team code, validates team size limits, creates EventRegistration
   - **DELETE**: Leave a team (leader leaving disbands entire team and unregisters all members; regular member just leaves)
   - Validation: checks competition type, event status, team size limits, max teams, duplicate membership

2. **MODIFIED: `/src/components/nexevent/EventDetail.tsx`** - Team Registration UI
   - Added imports: Input, Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter, UserPlus, LogOut, Copy, Hash
   - Added state: teams, userTeam, showCreateTeamDialog, showJoinTeamDialog, teamName, joinCode, teamLoading
   - Added `fetchTeams` callback for fetching team data from the new API
   - Added handlers: handleCreateTeam, handleJoinTeam, handleJoinTeamById, handleLeaveTeam, copyTeamCode
   - Added "Team Registration" section (emerald-themed card) for competition events with:
     - **When user is on a team**: Shows team card with name, team code (with copy button), member list with leader/you badges, leave/disband button
     - **When user has no team**: Shows "Form a Team" and "Join a Team" buttons, "or register individually" divider if allowed, list of available teams with Join buttons (disabled if full)
   - Added "Create Team" dialog with team name input, team size info, and "What happens next?" info box
   - Added "Join Team" dialog with team code input (uppercase, monospace, centered), and "Good to know" info box
   - Replaced old static "Teams" section in Competition Details card (removed since team registration card is more comprehensive)

### Lint: Passes with zero errors ✅
### Dev server: Running successfully ✅
