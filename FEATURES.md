# ClanTrader QA Checklist

Two testers (Tester A & Tester B) should go through this list independently. Mark each item with:
- **P** = Pass
- **F** = Fail (add a note describing the issue)
- **S** = Skipped (add reason)

Test every item in **both light and dark mode** unless noted otherwise.
Test on **desktop (Chrome)** and **mobile (iOS Safari or Chrome Android)**.

---

## 1. Authentication

### 1.1 Phone Signup & Login (Primary Flow)
- [ ] Send OTP to a valid phone number
- [ ] OTP rate limiting works (can't spam send)
- [ ] Enter correct OTP -> account created, redirected to home
- [ ] Enter wrong OTP -> error message shown
- [ ] OTP expires after timeout
- [ ] Login with existing phone number (send OTP, verify, logged in)
- [x] Session persists across page reload *(API: spec 01)*
- [ ] Sign out from user menu -> redirected to login

### 1.2 Email + Password (Secondary)
- [ ] Add email + password from Settings > Security
- [x] Login with email + password works *(API: spec 01)*
- [ ] Forgot password -> receives reset email
- [ ] Reset password with valid link -> can login with new password
- [ ] Reset password with expired/invalid link -> error

### 1.3 MetaTrader EA Auth
- [x] Signup via EA registration token (token=xxx in URL) *(API: spec 16)*
- [x] Login via EA token *(API: spec 16)*
- [ ] Download MT4 EA (.mq4) button works
- [ ] Download MT5 EA (.mq5) button works

### 1.4 Signup Form Validation
- [x] Username: min 3 chars enforced *(API: spec 16)*
- [ ] Username: real-time availability check (debounced)
- [ ] Username: shows available / taken / invalid indicator
- [ ] Password: min 8 chars enforced
- [ ] Email: valid format enforced
- [ ] Signup with referral code (ref=XXX in URL) tracks referral

### 1.5 Phone Verification
- [ ] User without phone sees redirect to /add-phone
- [ ] Add phone number -> receive OTP -> verify
- [ ] Change phone number from Settings > Security
- [ ] Phone displays as verified in security settings

### 1.6 Email Verification
- [ ] Send verification email from Settings > Security
- [ ] Click verification link -> email marked verified
- [ ] "Add email" banner appears on home if no email set

---

## 2. Navigation & Layout

### 2.1 Desktop
- [ ] Sidebar visible with all nav items: Home, Explore, Clans, Chats, DMs, Journal
- [ ] Sidebar shows admin link (admin users only)
- [ ] Settings link accessible from user menu
- [ ] Clicking logo/brand navigates to home

### 2.2 Mobile
- [ ] Hamburger menu opens sidebar overlay
- [ ] Tapping outside sidebar closes it
- [ ] Bottom mobile nav bar visible with correct icons
- [ ] All nav items reachable from mobile nav
- [ ] No horizontal scroll on any page

### 2.3 Top Bar
- [ ] MT connection status indicator (green pulse = connected, yellow = idle, red = disconnected)
- [ ] Clicking MT status navigates to Settings > MT Accounts
- [ ] Language switch works (EN / FA / AR)
- [ ] Theme toggle switches light/dark
- [ ] Invite friend button (mobile) opens invite dialog
- [ ] User menu dropdown with avatar/initials

### 2.4 RTL / LTR
- [ ] Switch to Persian (fa) -> entire layout flips to RTL
- [ ] Switch to English (en) -> layout is LTR
- [ ] Switch to Arabic (ar) -> layout is RTL
- [ ] All text, icons, padding, margins flip correctly
- [ ] No overlapping elements in RTL mode

---

## 3. User Profile

### 3.1 View Profile (own)
- [ ] Navigate to own profile from user menu
- [ ] Name, avatar, bio displayed correctly
- [ ] Trading style, preferred session, preferred pairs shown (if set)
- [ ] Clan memberships with role badges
- [ ] Trading stats from verified statements
- [ ] MT account summary (balance, equity, trade count)
- [ ] Badges displayed correctly

### 3.2 View Profile (other user)
- [ ] Navigate to another user's profile
- [ ] "Message" button visible -> opens DM
- [ ] Cannot see private info (email, phone)
- [ ] Public trading stats visible
- [ ] MT accounts section visible with connection status

### 3.3 Edit Profile (Settings > Profile)
- [ ] Edit name -> saves and reflects everywhere
- [ ] Edit username -> availability check works
- [x] Edit bio -> saves *(API: spec 01, 22)*
- [ ] Upload avatar -> preview shown, saves on submit
- [ ] Select trading style dropdown
- [ ] Select preferred session
- [ ] Edit preferred pairs (multi-input)
- [ ] Error shown if username taken

---

## 4. Settings

### 4.1 Appearance
- [ ] Display Size: 100% selected by default
- [ ] Select 125% -> text and spacing scale up, layout stays intact
- [ ] Select 150% -> readable on both desktop and mobile, no overflow
- [ ] Select 175% -> large text, still functional
- [ ] Select 200% -> very large, still usable (may need scrolling)
- [ ] Zoom persists after page reload
- [ ] Reset to 100% -> back to normal
- [ ] English font selection: Inter, Geist, Plus Jakarta Sans
- [ ] Persian font selection: Vazirmatn, YekanBakh, Shabnam, Estedad, Samim
- [ ] Font preview text renders in selected font
- [ ] Font selection persists after reload
- [ ] Font applies globally (check chat, profile, nav, etc.)

### 4.2 Security
- [ ] Phone number displayed (masked or full)
- [ ] Phone verification status shown
- [ ] Change phone number flow works
- [ ] Email status shown (set / not set)
- [ ] Add email + password (if phone-only account)
- [ ] Email verification status shown
- [ ] Change password works
- [ ] Send verification email button works

### 4.3 MT Accounts
- [ ] List of connected MT accounts
- [ ] Each account shows: number, broker, platform, type
- [ ] Balance, equity, currency displayed
- [ ] Last heartbeat timestamp
- [ ] Connection status (online/idle/disconnected)
- [ ] Open positions count
- [ ] Recent trades list
- [ ] Trading stats (win rate, total profit, avg duration)
- [ ] Top pairs breakdown
- [ ] Disconnect account button (with confirmation)
- [ ] Regenerate API key button
- [ ] Download EA buttons (MT4, MT5)

---

## 5. Clans

### 5.1 Create Clan
- [ ] Navigate to Clans > Create
- [ ] Fill in name (required), description, trading focus (required)
- [ ] Toggle public/private
- [ ] Upload clan avatar
- [x] Submit -> clan created, redirected to clan page *(API: spec 02)*
- [x] Creator has LEADER role *(API: spec 03)*

### 5.2 Discover & Join Clans
- [x] Explore page shows clan cards *(API: spec 11)*
- [x] Search clans by name *(API: spec 11)*
- [ ] Filter by trading focus
- [ ] Clan card shows: name, avatar, member count, followers, description
- [ ] Follow button works (toggle follow/unfollow)
- [ ] Join public clan -> instant membership
- [x] Request to join private clan -> request sent *(API: spec 04)*
- [ ] Cannot join if clan is full (member limit reached)
- [x] Free Agents tab shows verified traders without clan *(API: spec 11)*
- [ ] Free agent card shows trading stats

### 5.3 Clan Profile Page
- [ ] Header: name, avatar, description, trading focus badge
- [ ] Member count / limit shown
- [ ] Follower count shown
- [ ] Follow button
- [ ] Join/Leave button
- [ ] Settings button (leaders/co-leaders only)
- [ ] **Channel tab**: posts visible (members or public clan)
- [ ] **Chat tab**: real-time messages (members only)
- [ ] **Members tab**: list with roles and trading style
- [x] **Performance tab**: win rate, profit factor, avg R, total R *(API: spec 20)*
- [x] **Performance tab**: top providers list, recent signals, instrument breakdown *(API: spec 20)*
- [ ] **Statements tab**: clan trading statements

### 5.4 Clan Settings (Leader Only)
- [x] Edit clan name *(API: spec 02)*
- [x] Edit description *(API: spec 02)*
- [ ] Change avatar
- [ ] Change trading focus
- [ ] Toggle public/private
- [x] Enable/disable join requests *(API: spec 02)*
- [ ] Member limit display (based on tier)
- [x] Create invite link *(API: spec 05)*
- [ ] Share invite link
- [x] Approve/reject join requests *(API: spec 04)*
- [x] Remove member *(API: spec 03)*
- [x] Promote member to co-leader *(API: spec 03)*
- [x] Demote co-leader to member *(API: spec 03)*
- [ ] Ban member
- [x] Delete clan (with confirmation) *(API: spec 02)*

### 5.5 Topics
- [x] Default topic exists on clan creation *(API: spec 07)*
- [x] Create new topic (name, description) *(API: spec 07)*
- [ ] Edit topic name and description
- [ ] Archive topic
- [ ] Reorder topics
- [ ] Max 20 topics enforced
- [x] Switch between topics in chat *(API: spec 07)*

### 5.6 Invite Links
- [x] Generate invite link *(API: spec 05)*
- [ ] Join clan via invite link (/invite/[code])
- [ ] Expired/invalid invite shows error
- [ ] Invite tracks referral code

### 5.7 Edge Cases
- [x] User can only be in one clan at a time (enforced) *(API: spec 03, 04)*
- [ ] Cannot join a full clan
- [ ] Leader cannot leave without promoting another leader first
- [ ] Last member leaving -> clan handled gracefully

---

## 6. Clan Chat (Real-Time)

### 6.1 Messaging
- [x] Send text message -> appears instantly *(API: spec 06)*
- [x] Other members see message in real-time *(API: spec 06)*
- [ ] Message shows sender name, avatar, timestamp
- [x] Edit own message -> updated text shown with "edited" indicator *(API: spec 06)*
- [x] Delete own message -> removed from chat *(API: spec 06)*
- [x] Reply to a message -> shows quoted original *(API: spec 06)*
- [x] Message max 2000 characters enforced *(API: spec 06)*
- [x] Rate limiting: cannot send more than 5 messages in 10 seconds *(API: spec 14)*

### 6.2 Images
- [ ] Attach 1 image -> uploads and displays inline
- [ ] Attach up to 4 images -> grid layout
- [ ] Image preview/lightbox on tap
- [ ] Large image files handled (compressed/rejected)

### 6.3 Reactions
- [x] React to message with emoji (available: thumbs up, heart, laugh, wow, sad, fire) *(API: spec 06)*
- [ ] Reaction count updates in real-time
- [x] Remove own reaction *(API: spec 06)*
- [x] Multiple users can react to same message *(API: spec 06)*

### 6.4 Pinning
- [x] Pin message (leader/co-leader only) *(API: spec 06)*
- [ ] Pinned message indicator shown
- [x] Unpin message *(API: spec 06)*
- [ ] Max 10 pinned messages per topic enforced
- [x] View pinned messages list *(API: spec 06)*

### 6.5 Typing Indicator
- [x] Typing indicator appears when other user is typing *(API: spec 06)*
- [ ] Typing indicator disappears when user stops
- [ ] Shows who is typing (name)

### 6.6 Presence & Online Status
- [ ] Online users visible in chat
- [ ] User goes offline -> removed from online list

### 6.7 History & Pagination
- [ ] Load older messages (scroll up or load more button)
- [ ] 50 messages per page
- [ ] Auto-scroll to newest message on open
- [ ] Search messages by text

---

## 7. Trade Cards

### 7.1 Signal Cards (Leader Only)
- [ ] Open trade card composer
- [ ] Fill in: instrument, direction (buy/sell), entry price, stop loss, targets, timeframe
- [ ] Optional: risk %, tags, note
- [x] Submit -> signal card appears in chat *(API: spec 08)*
- [ ] Card shows all fields with proper formatting
- [ ] Live R:R calculation updates in real-time
- [ ] Risk status badge: protected / breakeven / unprotected

### 7.2 Analysis Cards (Any Member)
- [ ] Open analysis card composer
- [ ] Fill in same fields as signal
- [ ] Card type shows as "Analysis" (not "Signal")
- [ ] Analysis cards excluded from statements

### 7.3 Trade Card Interactions
- [ ] View trade card detail sheet (tap card)
- [x] Track trade button -> creates trade record *(API: spec 08)*
- [x] Edit trade card (own cards only) *(API: spec 08)*
- [ ] Delete trade card

### 7.4 Trade Actions
- [x] Set break even -> SL moves to entry *(API: spec 08)*
- [ ] Move stop loss -> SL updates
- [ ] Change targets -> TP list updates
- [x] Close trade -> enter close price, trade marked closed *(API: spec 08)*
- [ ] Add/edit note on trade
- [ ] System messages appear in chat for each action
- [ ] MT-linked trades: action sent to EA as pending action
- [ ] Pending action shows expiry timer
- [ ] Manual trades update immediately

### 7.5 Trade Status Updates
- [x] PENDING -> OPEN -> TP_HIT / SL_HIT / BE / CLOSED *(API: spec 08)*
- [ ] Status updates reflected on card in real-time
- [ ] Integrity: VERIFIED vs UNVERIFIED badge

### 7.6 Auto-Post to Channel
- [ ] Signal cards auto-post to channel (if enabled)
- [ ] Only SIGNAL type auto-posts (not ANALYSIS)
- [ ] Auto-posted messages marked with badge

---

## 8. Direct Messages (DMs)

### 8.1 Conversations
- [x] DM list shows all conversations *(API: spec 09)*
- [ ] Last message preview shown
- [ ] Sorted by most recent
- [ ] Unread count badge on unread conversations
- [ ] Start new DM from user profile ("Message" button)

### 8.2 Messaging
- [x] Send text message -> appears instantly *(API: spec 09)*
- [x] Receive message in real-time *(API: spec 09)*
- [x] Edit own message *(API: spec 09)*
- [x] Delete own message *(API: spec 09)*
- [x] Reply to message *(API: spec 09)*
- [ ] Max 2000 characters enforced
- [ ] Attach images (up to 4)

### 8.3 Read Receipts & Typing
- [x] Mark conversation as read -> unread badge clears *(API: spec 09)*
- [x] Typing indicator when other user types *(API: spec 09)*
- [ ] Typing indicator clears when they stop

---

## 9. Channel & Posts

### 9.1 Viewing Posts
- [ ] Channel tab shows posts (newest first)
- [ ] Post shows: title, content, author, timestamp, view count
- [ ] Post images displayed
- [ ] Signal trade card embedded in post (if applicable)
- [ ] Filter: All / Signals / Announcements
- [ ] Load more posts (pagination)
- [ ] Post detail view on tap

### 9.2 Creating Posts (Leader Only)
- [x] Create post with title and content *(API: spec 10)*
- [ ] Attach images
- [ ] Include signal trade card (optional)
- [ ] Publish post
- [x] Edit own post *(API: spec 10)*
- [x] Delete own post *(API: spec 10)*

### 9.3 Reactions
- [x] React to post with emoji *(API: spec 10)*
- [x] Remove reaction *(API: spec 10)*
- [ ] Reaction count and users shown

---

## 10. Trade Journal

### 10.1 Dashboard
- [ ] Navigate to Journal from sidebar
- [ ] Summary cards: win rate, profit factor, expectancy, total R, best R, worst R, avg R
- [ ] Trade breakdown: total trades, wins, losses, breakevens
- [ ] Trades with unknown R indicator

### 10.2 Charts & Analytics
- [ ] Equity curve chart renders
- [ ] Cumulative R chart renders
- [ ] Calendar heatmap (win/loss/BE per day) renders
- [ ] Instrument breakdown table
- [ ] Tag breakdown (if tags used)
- [ ] Streaks: current and max win/loss streaks
- [ ] Time analysis: day of week breakdown
- [ ] Monthly breakdown comparison

### 10.3 Filters
- [ ] Filter: tracked signals only vs all trades
- [x] Filter: all clans vs specific clan *(API: spec 19)*
- [x] Time period: all time, this month, last 3 months, last 6 months, this year *(API: spec 19)*
- [ ] Filters update all charts and stats in real-time

---

## 11. Leaderboard & Rankings

- [ ] Navigate to Leaderboard from Explore
- [x] Users ranked by: win rate, profit factor, total R *(API: spec 12)*
- [ ] Filter by trading style
- [ ] Filter by preferred pairs
- [ ] Filter by season
- [ ] Each entry shows: rank, avatar, name, badges, stats
- [ ] Tap entry -> navigates to user profile
- [ ] Only verified traders appear
- [ ] Active season name and dates displayed

---

## 12. Badges

- [ ] Badges displayed on user profile
- [ ] Badge shows: icon, name, description
- [ ] Badge categories visible: Rank, Performance, Trophy
- [ ] Rank ladder progression visible
- [ ] Earned badges highlighted, unearned dimmed
- [ ] Tapping badge shows details

---

## 13. Home Feed

- [ ] Home page shows greeting with user name
- [ ] Active season widget with dates and "View Rankings" link
- [ ] Quick stats: clans count, follows count
- [ ] Feed shows posts from member/followed clans
- [ ] Load more posts (pagination)
- [ ] Empty feed state with "Explore Clans" link
- [ ] "Add email" banner if no email set
- [ ] "Connect MT" banner if no MT account

### 13.1 Missions Dashboard
- [x] Missions section shows pending missions *(API: spec 22)*
- [ ] Progress checkmarks for completed missions
- [ ] Completion count (X of Y)
- [ ] All-complete message when done

---

## 14. Watchlist

- [ ] Open watchlist in clan chat
- [x] Add instrument to watchlist *(API: spec 18)*
- [x] Remove instrument from watchlist *(API: spec 18)*
- [x] Watchlist displays added instruments *(API: spec 18)*
- [ ] Instrument data updates

---

## 15. Statements

- [ ] View own trading statements
- [ ] Statement shows metrics (win rate, profit, trades)
- [ ] Statement verification status: pending / verified / rejected
- [ ] Statements auto-generated from MT trade data

---

## 16. Admin Panel (Admin Users Only)

### 16.1 Dashboard
- [ ] Quick stats: users, clans, trades, flags, rules, plans, logs, referrals
- [ ] Recent audit logs (10 latest)

### 16.2 Audit Logs
- [ ] Filter by category: AUTH, EA, TRADE, CHAT, ADMIN, SYSTEM
- [ ] Filter by level: INFO, WARN, ERROR
- [ ] Search by action text
- [ ] Date range filter
- [ ] 24-hour stats counters
- [ ] Expand log entry to see metadata JSON
- [ ] Pagination (50 per page)
- [ ] Live mode (auto-refresh every 5s)

### 16.3 Impersonation
- [ ] List all users
- [ ] Click to impersonate user
- [ ] See site as that user
- [ ] Switch back to admin

### 16.4 Feature Flags
- [x] Create flag *(API: spec 21)*
- [x] Enable / disable flag *(API: spec 21)*
- [x] Edit flag *(API: spec 21)*
- [x] Delete flag *(API: spec 21)*

### 16.5 Paywall Rules
- [x] Create rule *(API: spec 21)*
- [x] Edit rule *(API: spec 21)*
- [x] Delete rule *(API: spec 21)*

### 16.6 Plans
- [x] View plans *(API: spec 21)*
- [x] Create plan *(API: spec 21)*
- [x] Edit plan (name, price, features) *(API: spec 21)*
- [ ] Activate / deactivate plan
- [x] Delete plan *(API: spec 21)*

### 16.7 Badges
- [x] View all badges (filter by category, enabled/disabled) *(API: spec 15)*
- [x] Create badge *(API: spec 15)*
- [x] Edit badge requirements *(API: spec 15)*
- [x] Reorder rank ladder *(API: spec 15)*
- [x] Delete badge *(API: spec 15)*
- [x] Recompute badges for all users *(API: spec 15)*
- [x] Dry-run recomputation (preview changes) *(API: spec 15)*
- [x] Badge audit trail *(API: spec 15)*

### 16.8 Referrals
- [x] View referral signups *(API: spec 23)*
- [x] Track referral events *(API: spec 23)*

### 16.9 Statements Review
- [ ] View pending statements
- [ ] Review statement with original HTML
- [ ] Add review notes
- [ ] Approve statement
- [ ] Reject statement

### 16.10 Clans Management
- [ ] Search clans by name
- [ ] Edit clan tier
- [ ] Delete clan
- [ ] Ban clan

### 16.11 Demo Data & Testing
- [ ] Generate demo data
- [ ] Test runs administration
- [ ] Test artifacts

### 16.12 Ranking
- [x] View ranking config *(API: spec 21)*
- [x] Edit ranking parameters *(API: spec 21)*
- [x] Trigger ranking calculation *(API: spec 21)*

---

## 17. PWA & Offline

- [ ] "Add to Home Screen" prompt appears on mobile
- [ ] Install as PWA -> opens in standalone mode (no browser chrome)
- [ ] App icons display correctly on home screen
- [ ] Offline page (/offline) shows when no connection
- [ ] Reconnection works after going offline then online
- [ ] Status bar color matches theme (light/dark)

---

## 18. Invite Friend

- [ ] Invite dialog opens from top bar button (mobile) or settings
- [ ] Generates invite/referral link
- [ ] Link is shareable (copy to clipboard)
- [ ] Recipient clicking link -> lands on signup with referral code

---

## 19. Cross-Cutting Concerns

### 19.1 Theme (Test EVERY section above in both)
- [ ] Light mode: all text readable, no invisible elements
- [ ] Dark mode: all text readable, no invisible elements
- [ ] Toggle mid-session: no broken styles
- [ ] Theme persists after reload

### 19.2 Language (Test key flows in FA and EN)
- [ ] All UI labels translate when switching language
- [ ] No untranslated strings visible
- [ ] Date/number formatting respects locale
- [ ] Language persists after reload

### 19.3 Display Size (Spot-check at 150%)
- [ ] Home page readable and functional
- [ ] Chat usable: can type, send, scroll
- [ ] Clan page: all tabs accessible
- [ ] Settings: all forms usable
- [ ] No content cut off or inaccessible on mobile

### 19.4 Responsive Design
- [ ] Desktop (1440px+): sidebar visible, content fills space
- [ ] Tablet (768px-1024px): layout adapts, no overflow
- [ ] Mobile (375px-430px): hamburger menu, bottom nav, no horizontal scroll
- [ ] All modals/sheets usable on mobile (can close, scroll, interact)

### 19.5 Error Handling
- [ ] Invalid URL -> 404 page shown
- [x] Unauthorized action -> redirected to login *(API: spec 13)*
- [x] Forbidden action -> error message shown *(API: spec 13)*
- [ ] Network error -> toast/notification shown
- [ ] Form validation errors shown inline
- [x] Rate limit hit -> appropriate message shown *(API: spec 14)*

### 19.6 Loading States
- [ ] Pages show spinner/skeleton while loading
- [ ] Buttons disabled during async operations
- [ ] No flash of unstyled content

### 19.7 Image Uploads
- [ ] Avatar upload works (profile, clan)
- [ ] Chat image upload works (1-4 images)
- [ ] Post image upload works
- [ ] Large files handled gracefully (compressed or error)
- [ ] Invalid format rejected with message

---

## How to Report Issues

For each failed item, note:
1. **Item ID** (e.g., "6.1 Send text message")
2. **Device/Browser** (e.g., iPhone 14, Safari 17)
3. **Theme** (Light / Dark)
4. **Language** (EN / FA)
5. **Display Size** (100% / 125% / etc.)
6. **Steps to reproduce**
7. **Expected result**
8. **Actual result**
9. **Screenshot or screen recording** (if possible)
