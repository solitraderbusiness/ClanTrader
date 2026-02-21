# ClanTrader — Manual Testing Checklist

> **Purpose**: Step-by-step guide to manually test every feature of the platform.
> Open this file any time you want to verify features work correctly.
> Each section is self-contained — you can test in any order.
>
> **Test Accounts** (password for all: `password123`):
> | Email | Role | Clan Role | Tier |
> |---|---|---|---|
> | `admin@clantrader.ir` | ADMIN | — | Pro |
> | `trader1@clantrader.ir` | TRADER | LEADER (Golden Eagles) | Pro |
> | `trader2@clantrader.ir` | TRADER | CO_LEADER | Free |
> | `trader3@clantrader.ir` | TRADER | MEMBER | Free |
> | `spectator@clantrader.ir` | SPECTATOR | — | Free |
>
> **Legend**: ✅ = pass, ❌ = fail (note what went wrong), ⏭️ = skipped

---

## 1. Authentication

### 1A. Login
- [ ] Go to `/login`
- [ ] Login with `trader1@clantrader.ir` / `password123`
- [ ] Verify you are redirected to `/dashboard`
- [ ] Verify your name appears in the sidebar or top bar
- [ ] Logout (user menu → logout)
- [ ] Verify you are redirected to `/login`

### 1B. Quick Login (Test Accounts)
- [ ] On the login page, check if quick-login buttons appear for test accounts
- [ ] Click one — verify it logs you in without typing credentials

### 1C. Sign Up
- [ ] Go to `/signup`
- [ ] Fill in a new email, name, password
- [ ] Submit — verify success message or redirect
- [ ] (Optional) Check if email verification prompt appears

### 1D. Forgot / Reset Password
- [ ] Go to `/forgot-password`
- [ ] Enter a valid email and submit
- [ ] Verify success message (email may not actually send in dev — that's OK)

### 1E. Protected Routes
- [ ] Logout, then try going directly to `/dashboard`
- [ ] Verify you are redirected to `/login`
- [ ] Try `/clans` — same redirect
- [ ] Try `/statements` — same redirect

---

## 2. User Profile & Settings

### 2A. View Own Profile
- [ ] Login as `trader1@clantrader.ir`
- [ ] Navigate to your profile (sidebar or user menu)
- [ ] Verify: name, bio, avatar, trading style, session preference, preferred pairs all display
- [ ] Verify: trading metrics from statement show (if any verified statement exists)
- [ ] Verify: clan memberships list appears with role badges

### 2B. Edit Profile
- [ ] Go to `/settings/profile`
- [ ] Change your name — save — verify it updates
- [ ] Change bio — save — verify
- [ ] Upload a new avatar image — verify it displays
- [ ] Change trading style dropdown — save — verify
- [ ] Change session preference — save — verify
- [ ] Change preferred pairs — save — verify

### 2C. View Other User's Profile
- [ ] Go to `/profile/{userId}` of another test user
- [ ] Verify their info displays (read-only, no edit buttons)

---

## 3. Clan System

### 3A. Create a Clan
- [ ] Login as `trader1@clantrader.ir`
- [ ] Go to `/clans/create`
- [ ] Fill in: name, description, trading focus (e.g., EURUSD)
- [ ] Set public/private toggle
- [ ] Submit — verify redirect to the new clan page
- [ ] Verify you are listed as LEADER

### 3B. View Clan Page
- [ ] Go to `/clans/{clanId}` (e.g., Golden Eagles clan)
- [ ] Verify three tabs visible: **Channel**, **Members**, **Chat**
- [ ] Verify clan name, description, avatar, trading focus, tier badge display
- [ ] Verify member count and follower count display

### 3C. Clan Members Tab
- [ ] Click the **Members** tab
- [ ] Verify all members listed with: name, avatar, role badge (LEADER/CO_LEADER/MEMBER)
- [ ] Verify Trader Badge appears next to users with TRADER role

### 3D. Follow / Unfollow Clan
- [ ] Login as `spectator@clantrader.ir` (not a member of the clan)
- [ ] Visit a clan page
- [ ] Click Follow — verify follower count increments
- [ ] Click Unfollow — verify it decrements

### 3E. Join Clan
- [ ] As a non-member, visit a public clan page
- [ ] Click Join — verify you become a MEMBER
- [ ] Verify you now see the Chat tab

### 3F. Manage Clan (Leader Only)
- [ ] Login as `trader1@clantrader.ir` (LEADER of Golden Eagles)
- [ ] Go to clan page → click manage/settings icon
- [ ] Verify 4 tabs: **Settings**, **Members**, **Invites**, **Channel**

#### Settings Tab
- [ ] Change clan name — save — verify updated
- [ ] Change description — save — verify
- [ ] Upload clan avatar — verify

#### Members Tab
- [ ] See list of members with role badges
- [ ] Promote a MEMBER to CO_LEADER — verify badge changes
- [ ] Demote back to MEMBER — verify
- [ ] Remove a member — verify they disappear from list

#### Invites Tab
- [ ] Create a new invite link
- [ ] Set expiry and max uses
- [ ] Copy the invite link
- [ ] Verify the invite appears in the list

### 3G. Invite Link
- [ ] Copy an invite link from the manage page
- [ ] Open it in an incognito window / different browser
- [ ] Login as a different user
- [ ] Verify the invite page shows clan info
- [ ] Click Join — verify you become a member

---

## 4. Channel / Broadcast Feed (Phase 3B)

### 4A. View Channel Posts
- [ ] Go to a clan page → **Channel** tab
- [ ] Verify posts are listed (if any exist)
- [ ] Verify each post shows: author, date, content, images, view count

### 4B. Create a Post (Leader/Co-Leader)
- [ ] Login as `trader1@clantrader.ir` (LEADER)
- [ ] On the Channel tab, click create post
- [ ] Add a title, content text
- [ ] Upload an image
- [ ] Submit — verify the post appears in the feed

### 4C. Premium Post
- [ ] Create a post and mark it as premium
- [ ] Login as a non-member or free-tier user
- [ ] Visit the clan channel — verify the premium post shows a lock icon
- [ ] Verify the content is hidden behind "Premium Content" barrier

### 4D. Post Reactions
- [ ] View a post in the channel
- [ ] Click a reaction emoji (e.g., 👍)
- [ ] Verify the reaction count increments
- [ ] Click the same emoji again — verify it toggles off

### 4E. Post Detail Page
- [ ] Click on a post to open `/clans/{clanId}/posts/{postId}`
- [ ] Verify: full content, images, author info, date, view count, reactions

### 4F. Non-Leader Cannot Create Posts
- [ ] Login as `trader3@clantrader.ir` (MEMBER)
- [ ] Go to a clan's Channel tab
- [ ] Verify no "create post" button appears

---

## 5. Real-Time Chat (Phase 3C)

### 5A. Open Chat
- [ ] Login as `trader1@clantrader.ir`
- [ ] Go to Golden Eagles clan → **Chat** tab
- [ ] Verify the chat panel loads with messages
- [ ] Verify connection status indicator shows connected (green wifi icon)

### 5B. Send a Message
- [ ] Type a message in the input and press Enter
- [ ] Verify the message appears in the chat immediately
- [ ] Verify your name and avatar appear next to the message

### 5C. Real-Time Delivery
- [ ] Open two browser tabs/windows, both logged into the same clan (different users)
- [ ] Send a message from Tab A
- [ ] Verify the message appears in Tab B without refreshing

### 5D. Reply to Message
- [ ] Hover over a message → click the reply icon
- [ ] Verify the reply bar appears above the input showing the original message
- [ ] Type a reply and send
- [ ] Verify the reply shows a link/reference to the original message

### 5E. Edit Message
- [ ] Hover over your own message → click edit icon
- [ ] Verify the input pre-fills with the message content
- [ ] Change the text and send
- [ ] Verify the message updates and shows "(edited)" label

### 5F. React to Message
- [ ] Hover over a message → click the reaction icon
- [ ] Select an emoji
- [ ] Verify the reaction appears under the message
- [ ] Click the same reaction again — verify it toggles off

### 5G. Pin / Unpin Message (Leader Only)
- [ ] As LEADER, hover over a message → click pin icon
- [ ] Verify the message gets a pinned indicator
- [ ] Verify it appears in the pinned messages panel at the top
- [ ] Unpin it — verify it disappears from pinned panel

### 5H. Delete Message
- [ ] Hover over your own message → click delete icon
- [ ] Confirm deletion
- [ ] Verify the message disappears from the chat

### 5I. Typing Indicator
- [ ] Open two tabs with different users in the same clan chat
- [ ] Start typing in Tab A
- [ ] Verify Tab B shows "{username} is typing..." indicator

### 5J. Online Users
- [ ] Verify the online users bar shows currently connected users
- [ ] Close one tab — verify that user disappears from the online list in the other tab

### 5K. Message Pagination
- [ ] If the chat has many messages, scroll to the top
- [ ] Verify older messages load automatically (infinite scroll)

### 5L. @Mention Autocomplete
- [ ] Type `@` in the message input
- [ ] Verify a dropdown of clan members appears
- [ ] Select a member — verify `@name` is inserted
- [ ] The dropdown should filter as you type letters after `@`

---

## 6. Chat Topics (Phase 3D)

### 6A. View Topics
- [ ] Open a clan's Chat tab
- [ ] Verify topic pills appear at the top (e.g., "General", "Gold Signals")
- [ ] Verify "General" is selected by default

### 6B. Switch Topics
- [ ] Click on a different topic pill
- [ ] Verify the messages reload for that topic
- [ ] Verify the selected pill is highlighted
- [ ] Send a message — verify it stays in the selected topic
- [ ] Switch back to General — verify the new message is NOT there (it's in the other topic)

### 6C. Create Topic (Leader/Co-Leader Only)
- [ ] As LEADER, click the "+" button next to topic pills
- [ ] Fill in a topic name and optional description
- [ ] Submit — verify the new topic appears as a pill
- [ ] Verify you can switch to it and send messages

### 6D. Topic Permissions
- [ ] Login as `trader3@clantrader.ir` (MEMBER)
- [ ] Verify the "+" button for creating topics is NOT visible

### 6E. Topic in Real-Time
- [ ] Open two tabs in the same clan but different topics
- [ ] Send a message in Topic A from Tab 1
- [ ] Verify it does NOT appear in Topic B on Tab 2
- [ ] Switch Tab 2 to Topic A — verify the message IS there

---

## 7. Trade Cards (Phase 3D)

### 7A. Open Trade Card Composer
- [ ] In the chat, click the chart icon (📊) button next to the message input
- [ ] Verify a dialog opens with fields: Instrument, Direction, Entry, Stop Loss, Targets, Timeframe, Risk%, Tags, Note

### 7B. Create a Trade Card
- [ ] Fill in the form:
  - Instrument: `XAUUSD`
  - Direction: `LONG`
  - Entry: `2650.50`
  - Stop Loss: `2640.00`
  - TP1: `2670.00` (add TP2 if UI allows: `2690.00`)
  - Timeframe: `H4`
  - Risk%: `2`
  - Tags: `gold`, `breakout`
  - Note: `Testing trade card`
- [ ] Submit — verify a trade card message appears in the chat
- [ ] Verify the card shows: direction badge (green LONG), instrument, entry/SL/TP prices, R:R ratio, tags, note

### 7C. Trade Card Displays Correctly
- [ ] Verify the trade card has a distinct visual style (not a plain text message)
- [ ] Verify direction badge color: LONG = green, SHORT = red
- [ ] Verify all price levels are displayed
- [ ] Verify tags show as pills/chips
- [ ] Verify status badge shows "OPEN" initially

### 7D. Track a Trade
- [ ] On a trade card in the chat, click the "Track" button
- [ ] Verify the status changes to "OPEN" with a blue badge
- [ ] Verify the Track button disappears or changes

### 7E. Update Trade Status
- [ ] Click on a tracked trade card to open the detail sheet
- [ ] Verify the Trade Card Detail Sheet opens on the right
- [ ] Click a status button (e.g., "TP1 Hit")
- [ ] Verify the status badge updates on both the detail sheet and the inline card in chat
- [ ] Verify a status history entry appears in the detail sheet

### 7F. Trade Card Real-Time
- [ ] Open two tabs — send a trade card in Tab A
- [ ] Verify it appears in Tab B immediately
- [ ] Track the trade in Tab A — verify status updates in Tab B

---

## 8. Latest Trades Panel (Phase 3D)

### 8A. Open Panel
- [ ] Click the trades icon in the chat toolbar (or type `/trades` in the input)
- [ ] Verify the Latest Trades sheet opens on the right side

### 8B. Browse Trades
- [ ] Verify trade cards are listed
- [ ] Verify each shows: instrument, direction, entry/SL/TP, status badge

### 8C. Filter Trades
- [ ] Use the filter options: by instrument, direction, status
- [ ] Verify the list updates based on filters

### 8D. Jump to Message
- [ ] Click a "Jump to message" button on a trade in the panel
- [ ] Verify the chat scrolls to that message and it flashes/highlights briefly

---

## 9. Watchlist (Phase 3D)

### 9A. Open Watchlist
- [ ] Click the watchlist icon in the toolbar (or type `/watchlist`)
- [ ] Verify the Watchlist sheet opens on the right

### 9B. View Items
- [ ] Verify any seeded watchlist items appear (e.g., XAUUSD, EURUSD, GBPUSD)

### 9C. Add an Instrument
- [ ] Type an instrument name (e.g., `USDJPY`) and click Add
- [ ] Verify it appears in the list

### 9D. Remove an Instrument
- [ ] Click the remove/X button next to an instrument
- [ ] Verify it disappears from the list

### 9E. Per-User Isolation
- [ ] Login as a different user in the same clan
- [ ] Open watchlist — verify it shows THEIR items, not the first user's

---

## 10. Events Panel (Phase 3D)

### 10A. Open Events
- [ ] Click the events icon in the toolbar (or type `/events`)
- [ ] Verify the Events sheet opens on the right

### 10B. View Events
- [ ] Verify seeded events appear (NFP, FOMC, ECB Rate Decision)
- [ ] Verify each shows: title, description, date/time, impact level badge
- [ ] Verify impact badges are color-coded (HIGH = red, MEDIUM = yellow, LOW = green)

---

## 11. Summary Panel (Phase 3D)

### 11A. Open Summary
- [ ] Click the summary icon in the toolbar (or type `/summary`)
- [ ] Verify the Summary sheet opens on the right

### 11B. Generate Summary
- [ ] Select a time range (e.g., "Today" or "7 days")
- [ ] Wait for it to generate
- [ ] Verify stats appear: total messages, total trade cards
- [ ] Verify instrument breakdown (if trade cards exist in that time range)
- [ ] Verify direction split (LONG vs SHORT counts)
- [ ] Verify trade outcomes (status counts)
- [ ] Verify top tags list

### 11C. Summary Saved as Message
- [ ] After generating a summary, go back to the chat
- [ ] Verify a SYSTEM_SUMMARY message appeared in the topic
- [ ] Verify it has a distinct system-style rendering (not a regular user message)

---

## 12. Slash Commands (Phase 3D)

### 12A. Slash Command Autocomplete
- [ ] In the chat input, type `/`
- [ ] Verify a dropdown menu appears with: `/trades`, `/watchlist`, `/events`, `/summary`
- [ ] Type `/tr` — verify it filters to show `/trades`

### 12B. Execute Slash Command
- [ ] Type `/trades` and press Enter (or click from dropdown)
- [ ] Verify the Latest Trades panel opens (NOT sent as a text message)
- [ ] Type `/watchlist` → verify Watchlist panel opens
- [ ] Type `/events` → verify Events panel opens
- [ ] Type `/summary` → verify Summary panel opens

### 12C. Escape Slash Menu
- [ ] Type `/` then press Escape
- [ ] Verify the dropdown closes

---

## 13. Trader Badges (Phase 3D)

### 13A. Badge in Chat
- [ ] Send a message as a TRADER role user
- [ ] Verify a "T" badge appears next to the username
- [ ] Login as admin — verify "A" badge appears next to admin messages

### 13B. Badge in Members List
- [ ] Go to clan page → Members tab
- [ ] Verify TRADER users show a Trader badge
- [ ] Verify ADMIN users show an Admin badge

### 13C. Badge Tooltip
- [ ] Hover over a badge — verify a tooltip appears ("Verified Trader" or "Admin")

---

## 14. Discover Page

### 14A. Discover Clans
- [ ] Go to `/discover`
- [ ] Click the **Clans** tab
- [ ] Verify public clans are listed with: name, description, member count, tier badge
- [ ] Use filters (trading focus, tier) — verify results update

### 14B. Discover Free Agents
- [ ] Click the **Free Agents** tab
- [ ] Verify traders not in a clan are listed
- [ ] Use filters (trading style, pairs) — verify results update

---

## 15. Trading Statements (Phase 2)

### 15A. Upload Statement
- [ ] Login as a TRADER user
- [ ] Go to `/statements/upload`
- [ ] Upload an MT4 or MT5 HTML statement file
- [ ] Verify it processes and shows extracted metrics
- [ ] Verify status shows as PENDING

### 15B. View My Statements
- [ ] Go to `/statements`
- [ ] Verify your uploaded statements are listed
- [ ] Verify status badges display correctly

### 15C. Admin Review (Admin Only)
- [ ] Login as `admin@clantrader.ir`
- [ ] Go to `/admin/statements`
- [ ] Verify pending statements appear
- [ ] Click Approve on one — verify status changes to VERIFIED
- [ ] Click Reject on another — verify status changes to REJECTED

---

## 16. Admin Features

### 16A. Impersonate User
- [ ] Login as `admin@clantrader.ir`
- [ ] Go to `/admin/impersonate`
- [ ] Verify all users are listed
- [ ] Click impersonate on a user
- [ ] Verify you are now seeing the app as that user
- [ ] Verify you can navigate and see their data

### 16B. Non-Admin Denied
- [ ] Login as a non-admin user
- [ ] Try to go to `/admin/impersonate` — verify access denied / redirect
- [ ] Try to go to `/admin/statements` — verify access denied / redirect

---

## 17. Responsive Design

### 17A. Mobile Layout
- [ ] Open the app on mobile (or browser dev tools → mobile viewport)
- [ ] Verify the sidebar collapses into a mobile nav
- [ ] Verify the chat panel is usable on mobile
- [ ] Verify trade card composer dialog is scrollable on mobile
- [ ] Verify sheets open full-width on mobile

### 17B. RTL Check (if applicable)
- [ ] If you switch to Persian/Arabic locale
- [ ] Verify layout mirrors correctly (text right-to-left)
- [ ] Verify chat bubbles align correctly

---

## 18. Edge Cases & Error Handling

### 18A. Empty States
- [ ] Visit a clan with no messages — verify "No messages yet" empty state in chat
- [ ] Visit a new topic with no messages — verify topic-aware empty state
- [ ] Open Latest Trades with no trades — verify empty state
- [ ] Open Watchlist with no items — verify empty state
- [ ] Open Events with no events — verify empty state

### 18B. Character Limits
- [ ] Try sending a very long message (over the max limit)
- [ ] Verify the character counter shows and input is limited
- [ ] Try creating a topic with a very long name — verify validation

### 18C. Network Disconnect
- [ ] While in chat, disconnect your internet briefly
- [ ] Verify the connection status indicator turns to disconnected (red wifi icon)
- [ ] Reconnect — verify it reconnects and indicator turns green

### 18D. Permission Boundaries
- [ ] As a MEMBER, try to pin a message — verify not allowed
- [ ] As a MEMBER, try to create a topic — verify not allowed
- [ ] As a non-member, verify the Chat tab is not accessible
- [ ] As a SPECTATOR, verify limited functionality

---

## Notes & Issues Log

Use this section to record any issues found during testing:

| # | Feature | Issue Description | Severity | Status |
|---|---------|------------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

**Severity levels**: Critical (blocks usage), High (feature broken), Medium (partial issue), Low (cosmetic)
**Status**: Open, Fixed, Won't Fix
