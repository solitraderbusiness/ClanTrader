# ClanTrader — Platform Report

## What Is ClanTrader?

ClanTrader is a **competitive social trading platform** where forex, gold, oil, and crypto traders form teams ("clans"), share live trading signals, track performance transparently, and compete on seasonal leaderboards. Think of it as **Discord for traders + verified performance tracking + MetaTrader integration**, all in one app.

**Website**: clantrader.com (development) / clantrader.ir (production, Iran-focused)
**Languages**: English + Persian (full RTL support)
**Target market**: Iranian forex/crypto traders (primary), global traders (secondary)

---

## Who Is This For?

| Audience | What They Get |
|----------|---------------|
| **Forex/Crypto Traders** | Join a clan, share signals, get verified performance stats, build reputation |
| **Signal Providers / Analysts** | Post trade signals, get tracked automatically, prove win rate on leaderboard |
| **Trading Group Leaders** | Create a clan, manage members, moderate chat, see team performance |
| **Spectators / Learners** | Follow clans and traders, watch signals in real-time, learn from top performers |
| **Admins** | Full dashboard for user management, badges, feature flags, project tracking |

---

## Core Features

### 1. Clan System (Teams)

Traders organize into **clans** — private or public groups focused on specific markets.

- **Create a clan**: Choose a name, trading focus (forex, crypto, commodities, etc.), and public/private visibility
- **Roles**: Leader, Co-Leader, Member — each with different permissions
- **Tiers**: Free and Pro (Pro clans have higher member limits)
- **Discovery**: Browse public clans, filter by trading focus, see member count and follower stats
- **Invite system**: Share invite links (with optional expiry and usage limits) or enable join requests for approval
- **One-clan rule**: Each user belongs to one clan at a time — must leave before joining another

### 2. Real-Time Chat & Channels

Every clan has **two communication layers**:

**Clan Chat** (members only):
- Real-time messaging with Socket.io (instant delivery, no page refresh)
- Multiple **topics/channels** per clan (e.g., #general, #signals, #analysis)
- Message replies (threads), emoji reactions, pinning (up to 50 per clan)
- Image uploads (up to 4 per message, auto-compressed to WebP)
- Typing indicators and online presence (green dots)
- Slash commands: `/trade` to post a signal, `/analyze` for analysis cards
- @mention autocomplete for clan members

**Channel** (public announcements):
- Clan leaders post announcements visible to followers and members
- Premium posts (paywall-gated for future monetization)
- Auto-posted signal cards when traders share signals in chat
- Reactions on posts

**Direct Messages**:
- 1:1 private conversations between any two users
- Same features as clan chat: replies, editing, images, read receipts
- Conversation list sorted by last message

### 3. Trade Signals & Tracking

The core differentiator — **every signal posted gets tracked and verified**:

**Signal Cards**: Traders post structured trade ideas:
- Instrument (e.g., XAUUSD, EURUSD)
- Direction (Long/Short)
- Entry price, Stop Loss, Take Profit targets (multiple targets supported)
- Timeframe, risk percentage, tags, notes

**Automatic Tracking**: Once a signal is posted, the system:
- Creates an immutable **risk snapshot** (initial entry, SL, TP — can never be retroactively changed)
- Tracks status: PENDING → OPEN → TP_HIT / SL_HIT / BREAKEVEN / CLOSED
- Logs every modification (SL moved, TP changed, etc.) with timestamps
- Calculates live R:R (risk-to-reward) ratio in real-time
- Determines **integrity status**: Was the trade modified fairly? Did the trader move SL after the fact?

**Trade Events**: Full audit trail of every action — who changed what, when, and why. Severity levels: INFO, WARNING, CRITICAL.

**Trade Actions**: Leaders and traders can:
- Set breakeven (move SL to entry)
- Modify SL/TP
- Close trade manually
- Add notes

### 4. MetaTrader EA Bridge (Expert Advisor Integration)

ClanTrader connects directly to **MetaTrader 4 and MetaTrader 5** trading terminals:

**How it works**:
1. Trader installs the ClanTrader EA (Expert Advisor) on their MT4/MT5
2. EA registers with the platform and gets an API key
3. Every 10 seconds, the EA sends a **heartbeat**: open trades, account balance, equity
4. ClanTrader auto-creates signal cards from real MT trades
5. When a trade is modified in MT → the signal card updates automatically
6. When a trade closes in MT → final R:R and P&L are calculated

**Two-way communication**:
- **EA → Server**: Trade opens, modifications, closes, account balance updates
- **Server → EA**: Pending actions (e.g., leader requests "set breakeven" → EA executes on MT)

**Live R:R Broadcasting**: Every heartbeat, the system calculates and broadcasts:
- Current R:R for every open trade
- Price P&L in real-time
- Risk status (Protected, Breakeven, Locked Profit, Unprotected)

This data flows via Socket.io to all clan members viewing the chat — they see **live, updating trade cards**.

**MT Account Management**:
- Register multiple MT4/MT5 accounts (demo or live)
- Track balance, equity, margin, leverage per account
- Regenerate API keys
- View connection status and last heartbeat

### 5. Leaderboards & Seasons

Performance is measured in **seasons** (time-bounded competition periods):

- **Seasonal rankings**: Traders and clans ranked by configurable metrics
- **Multiple lenses**: Win rate, profit factor, composite score, total R:R, etc.
- **Minimum trade threshold**: Must have enough trades to qualify
- **Trader Statements**: Monthly and seasonal performance reports per trader per clan
  - Trade count, win rate, profit factor, average R:R, net profit
  - Calculated from verified trades only (integrity-checked)

**Free Agents**: Traders not in any clan are listed in the "Free Agents" directory with their stats — clans can recruit top performers.

### 6. Badge & Achievement System

Gamification layer to reward performance:

- **Badge categories**: Rank (Bronze→Diamond ladder), Performance, Trophy, Other
- **Automated evaluation**: Badges awarded based on configurable criteria (min win rate, trade count, months active, etc.)
- **Admin tools**: Create custom badges, set requirements, dry-run evaluation before enabling
- **Audit trail**: Every badge award/revocation is logged

### 7. Referral System

Users can invite others to the platform:

- **Invite link**: Each user gets a unique referral URL (clantrader.com/join?ref=username)
- **Referral page**: Shows the referrer's profile card with "invited you to join" message
- **Tracking**: Link copies, clicks, signups, and subscriptions are all logged
- **Admin analytics**: Referral conversion rates and top referrers dashboard

### 8. User Profiles & Social

- **Profile**: Name, username, bio, avatar, trading style, preferred pairs, session preference
- **Roles**: Spectator (default) → Trader (active trading) → Admin
- **Follow system**: Follow users or clans to see their channel posts
- **Stories**: User stories with image + text overlay (Instagram-style, with expiry)
- **Watchlists**: Per-clan instrument watchlists

### 9. Geo-News Page

Current implementation links to **Liveuamap** for geopolitical event tracking:
- Regions: Iran, Ukraine, Middle East, Trade Wars
- Interactive map cards by country/region
- **Planned upgrade**: In-house live news aggregation with AI categorization (BACKLOG on project board)

### 10. Journal

Personal trade tracking dashboard:
- View all your trades across every clan you've been in
- Performance metrics over time
- Trade history with full event logs

---

## Admin Tools

ClanTrader has a comprehensive admin panel at `/admin`:

| Tool | Purpose |
|------|---------|
| **Kanban Board** | Project management — 5-column workflow (Backlog → Done), 3 views (board, timeline, calendar), phase filtering |
| **Product Roadmap** | Epics, workstreams, milestones, launch blockers, dependency tracking |
| **Badges Manager** | Create/edit badges, set requirements, dry-run evaluation, drag-drop rank ordering |
| **Statements Review** | Approve/reject uploaded trading statements with extracted metrics |
| **Clan Management** | Edit visibility, featured status, tier, admin notes |
| **Feature Flags** | Toggle features on/off dynamically (no deploy needed) |
| **Paywall Rules** | Configure free preview limits for premium content |
| **Subscription Plans** | Manage pricing tiers and entitlements |
| **Ranking Config** | Configure leaderboard metrics, weights, and minimum thresholds |
| **Referral Analytics** | Track referral conversion funnel |
| **Audit Logs** | Complete activity log filterable by action, entity, level, category |
| **User Impersonation** | Switch to any user's session for support/debugging |
| **Test Runner** | Queue and run E2E tests with multi-worker support |

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.1, React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, full RTL support (logical properties) |
| UI Components | Radix UI + shadcn/ui |
| State | Zustand 5 |
| Real-time | Socket.io 4.8 (WebSocket + polling fallback) |
| Database | PostgreSQL 16 + Prisma 7 (PrismaPg adapter) |
| Cache | Redis 7 (sessions, presence, rate limiting, price cache) |
| Auth | Auth.js (NextAuth v5) with JWT |
| Email | Nodemailer (SMTP) |
| Process Manager | PM2 (auto-restart, 1GB memory limit) |
| Reverse Proxy | Nginx + Let's Encrypt SSL |
| Testing | Vitest (unit) + Playwright (E2E) |
| i18n | Custom system — English + Persian, server + client |

### Infrastructure

- **Development server** (US): clantrader.com — primary development and testing
- **Production server** (Iran): clantrader.ir — not yet deployed, prepared for Iranian users
- **Deployment pipeline**: Build on US server → tarball → transfer to Iran → deploy to staging → promote to production
- All external API calls happen **server-side on the US server** — the Iranian frontend never makes external calls directly (sanctions-safe)
- Fonts are self-hosted, no external CDNs at runtime

### Real-Time Architecture

- Socket.io server runs alongside Next.js on a custom HTTP server
- Room-based architecture: users join clan rooms and topic rooms
- Redis-backed presence tracking (who's online in each clan)
- Redis-backed rate limiting (prevent spam)
- Live trade PnL updates broadcast every 10 seconds (from EA heartbeat)
- Economic calendar event reminders via Socket.io

### Database

30+ models covering:
- Users, clans, memberships, follows
- Messages, DMs, conversations, topics, channel posts
- Trade cards, trades, trade events, status history
- MT accounts, MT trades, pending EA actions
- Leaderboard entries, trader statements, seasons
- Badges, feature flags, paywall rules, subscription plans
- Audit logs, referral events, trading events (economic calendar)
- Project tasks (kanban), product roadmap items

---

## Current Status

- **Development phase**: Active development on clantrader.com
- **Core features complete**: Clans, chat, trade signals, MT bridge, leaderboards, badges, referrals, admin tools
- **In testing**: Signup validation, referral flow
- **In progress**: Mobile responsive polish, onboarding flow
- **Backlog**: Live news feed (AI-powered), subscription/payments, Persian news sources

---

## Key Differentiators

1. **Verified performance**: Unlike Telegram groups where signal providers can lie about results, ClanTrader tracks every trade immutably with integrity checks
2. **MetaTrader integration**: Direct bridge to MT4/MT5 — trades sync automatically, no manual entry
3. **Real-time everything**: Live R:R, typing indicators, presence, trade updates — all via WebSocket
4. **Iran-first design**: Self-hosted fonts, server-side API calls, no external CDN dependencies, full Persian/RTL support
5. **Transparent leaderboards**: Rankings based on verified trades only, configurable metrics, seasonal competition
6. **Clan competition model**: Teams compete against each other, creating engagement and accountability
