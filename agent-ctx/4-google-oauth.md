# Task 4 - Google OAuth Implementation (Simulated)

## Summary
Implemented a simulated Google OAuth flow for the NexEvent campus event management platform. Since this is a sandboxed environment without a real Google OAuth client, the implementation demonstrates the complete UI flow and backend logic.

## Files Created

### 1. `/src/app/api/auth/google/route.ts` - Google OAuth API
- **POST** handler accepts `{ googleToken, email, name, googleId }`
- Validates email ends with `@vvce.ac.in` using `isVVCEEmail()` from `geo.ts`
- **Existing user**: Links `googleId` and `googleEmail` to the account, checks approval status (PENDING/REJECTED/APPROVED), returns user data same format as login API
- **New user**: Creates user with `role: OTHER`, `approvalStatus: PENDING`, sets `googleId` and `googleEmail`, returns `isNewUser: true` flag
- Generates a `passwordHash` from a combination of googleId and timestamp for account consistency

### 2. Auth Store (`/src/store/auth-store.ts`) - Added `googleLogin` method
- New `GoogleLoginData` interface: `{ googleToken, email, name, googleId }`
- New `GoogleLoginResponse` interface: `{ user, message, isNewUser? }`
- `googleLogin()` method:
  - Calls `/api/auth/google` endpoint
  - If `isNewUser: true` → does NOT auto-login (needs admin approval), returns `{ isNewUser: true }`
  - If existing approved user → sets user in store and `isAuthenticated: true`, returns `{ isNewUser: false }`
  - On error → sets error message in store

### 3. AuthModal (`/src/components/nexevent/AuthModal.tsx`) - Complete Rewrite
- **"Sign in with Google" button**: Styled with Google colors (white background, border, Google SVG icon)
- **"or" divider** between email/password form and Google button
- **Simulated Google Sign-In Dialog** with 4 animated steps:
  1. **Email step**: Shows simulated "Choose an account" UI (like real Google OAuth)
     - Quick-select buttons for existing demo accounts (Aditi N, Priya Sharma)
     - Custom email input with `@vvce.ac.in` domain suffix
     - Name field for new users
  2. **Loading step**: Animated spinner with Google logo
  3. **Success step**: Green checkmark with spring animation, auto-closes after 1.2s
  4. **Pending approval step**: Amber alert icon, message about pending admin approval, "Got it" button
- Uses `AnimatePresence` for smooth step transitions
- Uses `toast` from sonner for error notifications
- Uses `framer-motion` for all animations

### 4. Pre-existing Lint Fix in EventDetail.tsx
- **Issue**: `useEffect` calling `stopPinging()` which calls `setIsPinging()` — `react-hooks/set-state-in-effect` error
- **Fix**: Moved the auto-stop logic directly into the `sendPing` catch block where `err.code === 1` (permission denied) is detected, eliminating the need for the useEffect entirely

## Design Decisions
- **Simulated flow** rather than real Google OAuth — appropriate for sandboxed environment
- **GoogleId generation**: Simple hash from email + timestamp — simulates what Google would return
- **Account linking**: If existing user logs in via Google, their account gets `googleId` and `googleEmail` linked
- **New users get PENDING status**: Consistent with existing registration flow — admin must approve
- **Demo account quick-select**: Shows existing VVCE accounts in the Google picker for easy testing

## Lint Status
All files pass `bun run lint` with zero errors ✅
