# Task 4 - Phase 4: Scoring/Judging System

## Agent: full-stack-developer

## Work Completed

### 1. Scores API Route (`/api/events/[id]/scores/route.ts`)
- Created comprehensive API route with GET, POST, and PUT handlers
- **GET**: Supports raw score listing with filters (roundId, judgeId, targetId) and aggregated results mode (aggregate=true)
  - Aggregated mode calculates per-criterion average across judges, per-round totals, applies round weights, and supports CUMULATIVE/AVERAGE/BEST_OF scoring types
  - Results sorted by total score descending with rank
- **POST**: Submit/update scores with validation (0-maxScore range), permission checking (SCORE_PARTICIPANTS via event role assignments), round scoring open/closed state enforcement, and deadline checking
  - Upsert logic allows judges to update their own scores
  - Privileged users (organizer, admin, faculty, HOD) bypass scoring open/closed checks
- **PUT**: Toggle scoring open/close for rounds - restricted to organizers, admins, faculty, and HODs
- Added `getUserEventPermissions` helper function for centralized permission resolution

### 2. Event Role Assignments GET Handler (`/api/events/[id]/roles/assign/route.ts`)
- Added GET handler to list event role assignments, filterable by userId
- Returns assignments with user and role details for permission checking on the client side

### 3. JudgeScoring Component (`/components/nexevent/JudgeScoring.tsx`)
- Full-featured scoring interface for judges
- **Header**: Event name with "Judge Scoring" title and competition badge
- **Round Selector**: Tabs showing all rounds with scoring status indicators (Lock/Unlock icons)
- **Round Info Card**: Shows round name, max score, weight, scoring status, deadline, and organizer toggle button
- **Scoring Grid**: Interactive table with rows for each team/participant and columns for each criterion
  - Number inputs with min/max validation
  - Visual feedback: green border for saved, amber for pending, loading spinner while saving
  - Auto-save on blur, explicit "Save" button per row
  - Expandable rows for judge comments per criterion
  - Criteria totals row at bottom
- **Permission checking**: Checks SCORE_PARTICIPANTS permission via event role assignments and privileged roles

### 4. ResultsView Component (`/components/nexevent/ResultsView.tsx`)
- Comprehensive results/leaderboard view
- **Podium Display**: Top 3 participants/teams with gold/silver/bronze styling and animated reveal
- **Full Ranking Table**: Expandable rows with per-criterion breakdowns and progress bars
- **PDF Export**: Full results export with jsPDF and autoTable including:
  - Event header with colored banner
  - Main rankings table with round breakdowns
  - Per-criterion detailed breakdown for top 10
- **Permission checking**: VIEW_RESULTS permission via event role assignments

### 5. UI Store Updates (`/store/ui-store.ts`)
- Added `'judge-scoring'` and `'results'` to ViewName type
- Updated navigate function to preserve selectedEventId for 'judge-scoring' and 'results' views

### 6. Page Integration (`/app/page.tsx`)
- Added JudgeScoring and ResultsView imports
- Added renderView cases for 'judge-scoring' and 'results'

### 7. EventDetail Integration (`/components/nexevent/EventDetail.tsx`)
- Added `canScore` and `canViewResults` state variables
- Added permission checking in useEffect on event load for competition events
- Added "Score Participants" and "View Results" buttons in sidebar for competition events with appropriate permissions
- Added ClipboardCheck and BarChart3 icon imports

### 8. Lint & Quality
- All code passes `bun run lint` with zero errors
