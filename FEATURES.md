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
- [ ] Session persists across page reload
- [ ] Sign out from user menu -> redirected to login

### 1.2 Email + Password (Secondary)
- [ ] Add email + password from Settings > Security
- [ ] Login with email + password works
- [ ] Forgot password -> receives reset email
- [ ] Reset password with valid link -> can login with new password
- [ ] Reset password with expired/invalid link -> error

### 1.3 MetaTrader EA Auth
- [ ] Signup via EA registration token (token=xxx in URL)
- [ ] Login via EA token
- [ ] Download MT4 EA (.mq4) button works
- [ ] Download MT5 EA (.mq5) button works

### 1.4 Signup Form Validation
- [ ] Username: min 3 chars enforced
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
- [ ] Edit bio -> saves
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
- [ ] Submit -> clan created, redirected to clan page
- [ ] Creator has LEADER role

### 5.2 Discover & Join Clans
- [ ] Explore page shows clan cards
- [ ] Search clans by name
- [ ] Filter by trading focus
- [ ] Clan card shows: name, avatar, member count, followers, description
- [ ] Follow button works (toggle follow/unfollow)
- [ ] Join public clan -> instant membership
- [ ] Request to join private clan -> request sent
- [ ] Cannot join if clan is full (member limit reached)
- [ ] Free Agents tab shows verified traders without clan
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
- [ ] **Performance tab**: win rate, profit factor, avg R, total R
- [ ] **Performance tab**: top providers list, recent signals, instrument breakdown
- [ ] **Statements tab**: clan trading statements

### 5.4 Clan Settings (Leader Only)
- [ ] Edit clan name
- [ ] Edit description
- [ ] Change avatar
- [ ] Change trading focus
- [ ] Toggle public/private
- [ ] Enable/disable join requests
- [ ] Member limit display (based on tier)
- [ ] Create invite link
- [ ] Share invite link
- [ ] Approve/reject join requests
- [ ] Remove member
- [ ] Promote member to co-leader
- [ ] Demote co-leader to member
- [ ] Ban member
- [ ] Delete clan (with confirmation)

### 5.5 Topics
- [ ] Default topic exists on clan creation
- [ ] Create new topic (name, description)
- [ ] Edit topic name and description
- [ ] Archive topic
- [ ] Reorder topics
- [ ] Max 20 topics enforced
- [ ] Switch between topics in chat

### 5.6 Invite Links
- [ ] Generate invite link
- [ ] Join clan via invite link (/invite/[code])
- [ ] Expired/invalid invite shows error
- [ ] Invite tracks referral code

### 5.7 Edge Cases
- [ ] User can only be in one clan at a time (enforced)
- [ ] Cannot join a full clan
- [ ] Leader cannot leave without promoting another leader first
- [ ] Last member leaving -> clan handled gracefully

---

## 6. Clan Chat (Real-Time)

### 6.1 Messaging
- [ ] Send text message -> appears instantly
- [ ] Other members see message in real-time
- [ ] Message shows sender name, avatar, timestamp
- [ ] Edit own message -> updated text shown with "edited" indicator
- [ ] Delete own message -> removed from chat
- [ ] Reply to a message -> shows quoted original
- [ ] Message max 2000 characters enforced
- [ ] Rate limiting: cannot send more than 5 messages in 10 seconds

### 6.2 Images
- [ ] Attach 1 image -> uploads and displays inline
- [ ] Attach up to 4 images -> grid layout
- [ ] Image preview/lightbox on tap
- [ ] Large image files handled (compressed/rejected)

### 6.3 Reactions
- [ ] React to message with emoji (available: thumbs up, heart, laugh, wow, sad, fire)
- [ ] Reaction count updates in real-time
- [ ] Remove own reaction
- [ ] Multiple users can react to same message

### 6.4 Pinning
- [ ] Pin message (leader/co-leader only)
- [ ] Pinned message indicator shown
- [ ] Unpin message
- [ ] Max 10 pinned messages per topic enforced
- [ ] View pinned messages list

### 6.5 Typing Indicator
- [ ] Typing indicator appears when other user is typing
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
- [ ] Submit -> signal card appears in chat
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
- [ ] Track trade button -> creates trade record
- [ ] Edit trade card (own cards only)
- [ ] Delete trade card

### 7.4 Trade Actions
- [ ] Set break even -> SL moves to entry
- [ ] Move stop loss -> SL updates
- [ ] Change targets -> TP list updates
- [ ] Close trade -> enter close price, trade marked closed
- [ ] Add/edit note on trade
- [ ] System messages appear in chat for each action
- [ ] MT-linked trades: action sent to EA as pending action
- [ ] Pending action shows expiry timer
- [ ] Manual trades update immediately

### 7.5 Trade Status Updates
- [ ] PENDING -> OPEN -> TP_HIT / SL_HIT / BE / CLOSED
- [ ] Status updates reflected on card in real-time
- [ ] Integrity: VERIFIED vs UNVERIFIED badge

### 7.6 Auto-Post to Channel
- [ ] Signal cards auto-post to channel (if enabled)
- [ ] Only SIGNAL type auto-posts (not ANALYSIS)
- [ ] Auto-posted messages marked with badge

---

## 8. Direct Messages (DMs)

### 8.1 Conversations
- [ ] DM list shows all conversations
- [ ] Last message preview shown
- [ ] Sorted by most recent
- [ ] Unread count badge on unread conversations
- [ ] Start new DM from user profile ("Message" button)

### 8.2 Messaging
- [ ] Send text message -> appears instantly
- [ ] Receive message in real-time
- [ ] Edit own message
- [ ] Delete own message
- [ ] Reply to message
- [ ] Max 2000 characters enforced
- [ ] Attach images (up to 4)

### 8.3 Read Receipts & Typing
- [ ] Mark conversation as read -> unread badge clears
- [ ] Typing indicator when other user types
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
- [ ] Create post with title and content
- [ ] Attach images
- [ ] Include signal trade card (optional)
- [ ] Publish post
- [ ] Edit own post
- [ ] Delete own post

### 9.3 Reactions
- [ ] React to post with emoji
- [ ] Remove reaction
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
- [ ] Filter: all clans vs specific clan
- [ ] Time period: all time, this month, last 3 months, last 6 months, this year
- [ ] Filters update all charts and stats in real-time

---

## 11. Leaderboard & Rankings

- [ ] Navigate to Leaderboard from Explore
- [ ] Users ranked by: win rate, profit factor, total R
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
- [ ] Missions section shows pending missions
- [ ] Progress checkmarks for completed missions
- [ ] Completion count (X of Y)
- [ ] All-complete message when done

---

## 14. Watchlist

- [ ] Open watchlist in clan chat
- [ ] Add instrument to watchlist
- [ ] Remove instrument from watchlist
- [ ] Watchlist displays added instruments
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
- [ ] Create flag
- [ ] Enable / disable flag
- [ ] Edit flag
- [ ] Delete flag

### 16.5 Paywall Rules
- [ ] Create rule
- [ ] Edit rule
- [ ] Delete rule

### 16.6 Plans
- [ ] View plans
- [ ] Create plan
- [ ] Edit plan (name, price, features)
- [ ] Activate / deactivate plan
- [ ] Delete plan

### 16.7 Badges
- [ ] View all badges (filter by category, enabled/disabled)
- [ ] Create badge
- [ ] Edit badge requirements
- [ ] Reorder rank ladder
- [ ] Delete badge
- [ ] Recompute badges for all users
- [ ] Dry-run recomputation (preview changes)
- [ ] Badge audit trail

### 16.8 Referrals
- [ ] View referral signups
- [ ] Track referral events

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
- [ ] View ranking config
- [ ] Edit ranking parameters
- [ ] Trigger ranking calculation

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
- [ ] Unauthorized action -> redirected to login
- [ ] Forbidden action -> error message shown
- [ ] Network error -> toast/notification shown
- [ ] Form validation errors shown inline
- [ ] Rate limit hit -> appropriate message shown

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
