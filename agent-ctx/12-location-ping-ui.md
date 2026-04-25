# Task 12: Student-Side Location Ping Submission UI

## Task Summary
Added a "Live Attendance Tracking" section to EventDetail.tsx for STUDENT role users to submit periodic location pings during LIVE events with geo-fence configured.

## Changes Made

### 1. Modified: `/src/app/api/events/[id]/attendance/route.ts` (GET handler)
- Added `userId` query parameter support to the existing GET handler
- When `userId` is provided, returns only that specific user's attendance record (for student self-service)
- Returns `attendance: null` if no attendance record exists yet
- Attendance percentage is rounded for display
- Original behavior (return all attendances) preserved when no `userId` is provided

### 2. Modified: `/src/components/nexevent/EventDetail.tsx`

#### New Imports
- Added `Radio, Navigation, Pause` icons from lucide-react
- `useRef` was already imported

#### New State Variables
- `isPinging` - whether periodic location pings are active
- `attendancePct` - current attendance percentage (0-100)
- `withinFence` - whether user is currently inside geo-fence (boolean | null)
- `geoError` - geolocation error message if any
- `pingCount` - number of successful pings sent
- `lastPingTime` - timestamp of last successful ping
- `pingIntervalRef` - ref to hold the interval timer for cleanup

#### New Functions
- `fetchAttendance()` - Fetches student's own attendance record from API
- `sendPing()` - Gets browser geolocation and POSTs to location-pings API
- `startPinging()` - Sends first ping immediately, then starts 60-second interval
- `stopPinging()` - Clears interval, fetches final attendance, shows toast

#### New useEffect Hooks
- Cleanup: Clears ping interval on component unmount
- Auto-stop: If geo permission is denied, auto-stops pinging via effect

#### Load Detail Enhancement
- When user is a STUDENT viewing a LIVE event with geo-fence and is registered, automatically fetches their attendance data

#### Live Attendance Tracking Card (UI)
- Only visible when: user is STUDENT + event is LIVE + user is registered + event has geo-fence (venueLat, venueLng, geoFenceRadius)
- Features:
  - Title with pulsing green dot on the Radio icon when pinging is active
  - "Active" badge with pulse animation when pinging
  - Circular SVG progress ring showing attendance percentage with color coding (green >= 75%, amber >= 50%, red < 50%)
  - Geo-fence status indicator (inside/outside/not checked) with color-coded dot
  - Ping stats grid (count + last ping time)
  - Active tracking indicator with Navigation icon and pulse animation
  - Error message display (rose-colored) with AlertTriangle icon
  - "Start Check-in Pings" button (green) / "Stop Pings" button (outline)
  - Info text explaining ping interval, attendance formula, and geo-fence radius

## Lint Status
- All code passes `bun run lint` with zero errors
