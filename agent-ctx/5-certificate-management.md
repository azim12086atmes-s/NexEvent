# Task 5 - Certificate Management Component

## Agent: Main Agent
## Date: 2026-03-05

### Summary
Created a full-featured Certificate Management component and integrated it into the NexEvent app.

### Changes Made

#### 1. Created `/src/components/nexevent/CertificateManagement.tsx` (NEW)
- **'use client'** component with Framer Motion animations and shadcn/ui components
- **Tabbed interface**: Templates | Issued Certificates
- **Stats row**: Templates count, Issued count, Total
- **Templates Tab**:
  - "Create Template" form with: title input, certificateType select (PARTICIPATION/WINNER/RUNNER_UP/BEST_PERFORMER/SPECIAL_MENTION/CUSTOM), scope select (EVENT_WIDE/ROUND_SPECIFIC), round select (conditionally shown when ROUND_SPECIFIC, fetched from competition config), description textarea, isDefault toggle switch
  - List of template cards showing type badge, scope badge, round info, description
  - Each template has: "Auto-Issue" button, "Generate All PDFs" button, Delete button
- **Issued Tab**:
  - List of issued certificates with recipient name, USN, type badge, scope badge, round info
  - "Download PDF" button per certificate → calls PUT generate, converts base64 to Blob, triggers browser download
- **Permission check**: Only FACULTY/HOD/ADMIN or event organizer can manage
- **Color scheme**: No indigo/blue; uses emerald/amber/rose/purple/cyan/teal/orange badges
- **Responsive**: Grid layouts adapt to mobile/desktop
- **Loading states**: Spinner on initial load, per-action loaders (autoIssuing, generatingAll, downloading, deleting, creating)

#### 2. Updated `/src/store/ui-store.ts`
- Added `'certificates'` to `ViewName` type union
- Updated `navigate` function: Added `'certificates'` to the array of views that preserve `selectedEventId` (`['event-detail', 'judge-scoring', 'results', 'certificates']`)

#### 3. Updated `/src/app/page.tsx`
- Added `CertificateManagement` import
- Added `case 'certificates': return <CertificateManagement />;` in `renderView` switch

#### 4. Updated `/src/components/nexevent/EventDetail.tsx`
- Added `Award` icon import from lucide-react
- Added "Manage Certificates" button in sidebar (after competition actions, before organizer section)
- Button visible when user is organizer, admin, faculty, or HOD
- Navigates to 'certificates' view with `selectedEventId` preserved

### Lint Status
All code passes `bun run lint` with zero errors ✅

### API Integration
- GET `/api/events/[id]/certificates` - Fetch certificates and summary
- POST `/api/events/[id]/certificates` - Create template (userId=null) or auto-issue (action='auto-issue' with templateId)
- PUT `/api/events/[id]/certificates` - Generate PDF (action='generate' with certificateId) or generate all (action='generate-all')
- DELETE `/api/events/[id]/certificates?certificateId=...&userId=...` - Delete certificate
- GET `/api/events/[id]` - Fetch event data and competition config (for rounds)
- GET `/api/events/[id]/competition` - Fallback fetch for rounds
