# Auth System Cleanup Notes (Feb 2026)

## What Changed

### Phone Auth Provider Removed
- The `Credentials({ id: "phone" })` provider was removed from `src/lib/auth.ts`
- Phone OTP login is no longer a primary auth method
- Code is preserved in git history for potential reactivation
- `PhoneOtpForm` component is still used in `/settings/security` for adding phone to existing accounts

### `/add-phone` Page Redirected
- Previously a standalone page requiring phone verification before continuing
- Now redirects to `/settings/security` where users can optionally add a phone number

### Signup Page Rewritten
- Was: MetaTrader EA-only signup (download EA, install, register)
- Now: Web signup form (name, username, email, password) with secondary EA panel
- New users are created as SPECTATOR role via existing `/api/auth/signup` endpoint
- EA registration still creates users as TRADER role (unchanged)

### Login Page Simplified
- Was: Tabbed UI (Username & Password | MetaTrader EA with full 3-step instructions)
- Now: Single form (username or email + password) with collapsible EA token section and forgot-password link
- Supports both username and email login in one input field

### `/ea` Callback Improved
- Better error states with recovery links (sign in / create account)
- Wrapped in Card component for visual consistency

### `/join` Page Copy Fixed
- Button: "Create Account" (was "Create Account with Phone")
- Added note about MetaTrader verified trader upgrade path

### Verified Trader Gating
- SPECTATOR users who later connect MetaTrader EA are auto-upgraded to TRADER role
- Leaderboard shows "Connect MetaTrader" banner for SPECTATOR users
- EA-only users (no email) see "Add email" banner on home page

## Backward Compatibility

All existing auth flows are preserved:
- EA register -> token -> `/ea` callback -> auto sign-in (TRADER)
- EA login -> token -> `/ea` callback -> auto sign-in
- Username + password login
- Email + password login (verified email required)
- Dev quick-login buttons (hidden in production)

## No Schema Changes

No database migrations required. Existing user data is fully compatible.
