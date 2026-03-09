# ClanTrader - Claude Implementation Plan

## How to Read This Plan

This document breaks the PROJECT_PLAN.md into concrete, buildable steps. Each step produces working, testable code. Steps are ordered so that each one builds on the previous — no step requires code that hasn't been built yet.

The plan follows the "Iranian-First" rule: every feature works on local infrastructure first, international enhancements are added on top.

---

## Pre-Development: Project Scaffolding

### Step 0.1 — Initialize the Next.js Project

- Run `npx create-next-app@latest` with TypeScript, Tailwind CSS, App Router, ESLint
- Install core dependencies:
  - `shadcn/ui` (component library — install via `npx shadcn-ui@latest init`)
  - `prisma` + `@prisma/client` (ORM for PostgreSQL)
  - `next-auth` (authentication)
  - `socket.io` + `socket.io-client` (realtime chat)
  - `redis` / `ioredis` (caching + sessions)
  - `zod` (input validation)
  - `react-hook-form` (form handling)
  - `zustand` (lightweight client state management)
  - `date-fns` (date utilities)
  - `sharp` (image processing for avatars/stories)
  - `nodemailer` (email)
- Set up folder structure:
  ```
  src/
    app/              # Next.js App Router pages
      (auth)/         # Auth pages (login, signup, verify, reset)
      (main)/         # Authenticated app shell
        dashboard/
        profile/
        clans/
        leaderboard/
        discover/
        stories/
        settings/
      api/            # API routes
        auth/
        users/
        clans/
        statements/
        leaderboard/
        content/
        ai/
        payments/
    components/       # Shared UI components
      ui/             # shadcn/ui components
      layout/         # App shell, sidebar, topbar
      clan/           # Clan-specific components
      trading/        # Trading/statement components
      chat/           # Chat components
      content/        # Stories, feed, channel components
    lib/              # Shared utilities
      db.ts           # Prisma client singleton
      auth.ts         # NextAuth config
      redis.ts        # Redis client
      socket.ts       # Socket.io setup
      ai-router.ts    # AI failover router (Phase 6)
      validators.ts   # Zod schemas
    services/         # Business logic layer
      user.service.ts
      clan.service.ts
      statement.service.ts
      leaderboard.service.ts
      content.service.ts
      ai.service.ts
      payment.service.ts
    types/            # TypeScript type definitions
  prisma/
    schema.prisma     # Database schema
    seed.ts           # Seed data for development
  public/
    uploads/          # User-uploaded files (statements, avatars, images)
  ```
- Create `.env.development` and `.env.production` templates (no secrets committed)
- Create `CLAUDE.md` with project rules for Claude Code sessions:
  - Never deploy untested code to production
  - Always validate inputs with Zod at API boundaries
  - Always use Prisma for database access (no raw SQL unless needed for performance)
  - Iranian-first: every feature must work without international APIs
  - Run `npm run lint` and `npm run build` before considering any task complete

### Step 0.2 — Set Up Prisma and Database Schema

Write the initial `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  name              String?
  bio               String?
  avatar            String?
  role              UserRole  @default(SPECTATOR)
  tradingStyle      String?
  sessionPreference String?
  preferredPairs    String[]
  emailVerified     DateTime?
  verifyToken       String?
  resetToken        String?
  resetTokenExpiry  DateTime?
  isPro             Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  statements        TradingStatement[]
  clanMemberships   ClanMember[]
  createdClans      Clan[]            @relation("ClanCreator")
  followsGiven      Follow[]          @relation("Follower")
  stories           Story[]
  channelPosts      ChannelPost[]
  messages          Message[]

  @@index([email])
}

enum UserRole {
  SPECTATOR
  TRADER
  ADMIN
}

model TradingStatement {
  id                 String              @id @default(cuid())
  userId             String
  user               User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  filePath           String
  originalFilename   String
  verificationStatus VerificationStatus  @default(PENDING)
  verificationMethod VerificationMethod  @default(SELF_REPORTED)
  extractedMetrics   Json?
  reviewNotes        String?
  uploadedAt         DateTime            @default(now())
  verifiedAt         DateTime?
  expiresAt          DateTime?

  @@index([userId])
  @@index([verificationStatus])
}

enum VerificationStatus {
  PENDING
  VERIFIED
  REJECTED
  EXPIRED
}

enum VerificationMethod {
  SELF_REPORTED
  BROKER_VERIFIED
}

model Clan {
  id           String       @id @default(cuid())
  name         String       @unique
  description  String?
  avatar       String?
  tradingFocus String?
  isPublic     Boolean      @default(true)
  tier         ClanTier     @default(FREE)
  settings     Json?
  createdById  String
  createdBy    User         @relation("ClanCreator", fields: [createdById], references: [id])
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  members      ClanMember[]
  messages     Message[]
  channelPosts ChannelPost[]
  inviteLinks  ClanInvite[]

  @@index([name])
}

enum ClanTier {
  FREE
  PRO
}

model ClanMember {
  id       String         @id @default(cuid())
  userId   String
  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  clanId   String
  clan     Clan           @relation(fields: [clanId], references: [id], onDelete: Cascade)
  role     ClanMemberRole @default(MEMBER)
  joinedAt DateTime       @default(now())

  @@unique([userId, clanId])
  @@index([clanId])
}

enum ClanMemberRole {
  LEADER
  CO_LEADER
  MEMBER
}

model ClanInvite {
  id        String   @id @default(cuid())
  clanId    String
  clan      Clan     @relation(fields: [clanId], references: [id], onDelete: Cascade)
  code      String   @unique
  expiresAt DateTime?
  maxUses   Int?
  uses      Int      @default(0)
  createdAt DateTime @default(now())

  @@index([code])
}

model Follow {
  id            String     @id @default(cuid())
  followerId    String
  follower      User       @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)
  followingType FollowType
  followingId   String
  createdAt     DateTime   @default(now())

  @@unique([followerId, followingType, followingId])
  @@index([followingType, followingId])
}

enum FollowType {
  USER
  CLAN
}

model Season {
  id               String             @id @default(cuid())
  name             String
  startDate        DateTime
  endDate          DateTime
  status           SeasonStatus       @default(UPCOMING)
  createdAt        DateTime           @default(now())

  leaderboardEntries LeaderboardEntry[]

  @@index([status])
}

enum SeasonStatus {
  UPCOMING
  ACTIVE
  COMPLETED
  ARCHIVED
}

model LeaderboardEntry {
  id         String          @id @default(cuid())
  seasonId   String
  season     Season          @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  entityType LeaderboardType
  entityId   String
  rank       Int?
  metrics    Json
  updatedAt  DateTime        @updatedAt

  @@unique([seasonId, entityType, entityId])
  @@index([seasonId, entityType, rank])
}

enum LeaderboardType {
  TRADER
  CLAN
}

model Message {
  id        String   @id @default(cuid())
  clanId    String
  clan      Clan     @relation(fields: [clanId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content   String
  isPinned  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([clanId, createdAt])
}

model ChannelPost {
  id         String   @id @default(cuid())
  clanId     String
  clan       Clan     @relation(fields: [clanId], references: [id], onDelete: Cascade)
  authorId   String
  author     User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  title      String?
  content    String
  images     String[]
  isPremium  Boolean  @default(false)
  viewCount  Int      @default(0)
  reactions  Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([clanId, createdAt])
  @@index([isPremium])
}

model Story {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  imageUrl  String
  textOverlay String?
  viewCount Int      @default(0)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([expiresAt])
}
```

Run `npx prisma migrate dev --name init` to create the database.
Write `prisma/seed.ts` with sample users, clans, and statements for development.

### Step 0.3 — Configure Dev Environment Tooling

- Set up ESLint + Prettier with consistent rules
- Add `lint-staged` + `husky` for pre-commit checks (lint + type-check)
- Create npm scripts:
  - `dev` — Next.js dev server
  - `build` — Production build
  - `start` — Production server
  - `db:migrate` — Run Prisma migrations
  - `db:seed` — Seed database
  - `db:studio` — Open Prisma Studio
  - `lint` — ESLint
  - `type-check` — `tsc --noEmit`

---

## Phase 1: Foundation (Authentication & Profiles)

### Step 1.1 — App Shell Layout

Build the Telegram-inspired responsive layout before any features:

- **Desktop:** Two-panel layout
  - Left sidebar (280px): Navigation, clan list, search, user avatar
  - Right content area: Main page content
- **Mobile:** Single-panel with bottom tab navigation and slide-in navigation
- **Top bar:** Season countdown, user's clan rank badge, leaderboard quick link
- Components to build:
  - `components/layout/AppShell.tsx` — outer wrapper, manages sidebar state
  - `components/layout/Sidebar.tsx` — left panel navigation
  - `components/layout/TopBar.tsx` — season info, notifications, user menu
  - `components/layout/MobileNav.tsx` — bottom tab bar for mobile
- Use `zustand` store for sidebar open/close state
- All pages inside `(main)/` layout use this shell; `(auth)/` pages do not

### Step 1.2 — Authentication System

- Configure NextAuth.js in `src/lib/auth.ts`:
  - Credentials provider (email + password)
  - Use `bcrypt` for password hashing
  - JWT session strategy (stateless, works without external session store)
  - Session includes `userId`, `email`, `name`, `role`, `isPro`
- Build auth pages:
  - `(auth)/login/page.tsx` — email + password form
  - `(auth)/signup/page.tsx` — name, email, password, confirm password
  - `(auth)/verify-email/page.tsx` — token verification page
  - `(auth)/forgot-password/page.tsx` — request reset link
  - `(auth)/reset-password/page.tsx` — set new password with token
- Build API routes:
  - `api/auth/[...nextauth]/route.ts` — NextAuth handler
  - `api/auth/signup/route.ts` — create account, send verification email
  - `api/auth/verify-email/route.ts` — verify email token
  - `api/auth/forgot-password/route.ts` — send reset email
  - `api/auth/reset-password/route.ts` — reset password with token
- Email: use `nodemailer` with a configurable SMTP provider. During dev, use Ethereal (fake SMTP) or log emails to console. For production, configure an Iranian SMTP service or a transactional email provider.
- Middleware: `src/middleware.ts` protects all `(main)` routes — redirect to login if unauthenticated.

### Step 1.3 — User Profiles

- Build profile page `(main)/profile/[userId]/page.tsx`:
  - Display name, avatar, bio, trading style, preferred pairs, session preference
  - Verified badge (if has verified statement)
  - Trading stats summary (from latest verified statement)
  - Clan membership
  - Season history (badges — populated later in Phase 4)
- Build profile edit page `(main)/settings/profile/page.tsx`:
  - Form: name, bio, avatar upload, trading style dropdown, preferred pairs multi-select, session preference
  - Avatar upload: POST to `api/users/avatar` → save to `public/uploads/avatars/[userId].[ext]` → process with `sharp` (resize to 256x256, compress)
- API routes:
  - `GET api/users/[userId]` — public profile data
  - `PATCH api/users/me` — update own profile
  - `POST api/users/avatar` — upload avatar

### Step 1.4 — Landing Page

- Build `app/page.tsx` (public, unauthenticated):
  - Hero section: tagline "The platform that never goes dark", brief explanation
  - How it works: Verify → Join a Clan → Compete → Rise
  - Feature highlights: verified trading, clan competition, seasons, content
  - CTA: Sign up button
- Keep it simple and fast-loading. No heavy animations. SSR for SEO.

---

## Phase 2: Trading Verification

### Step 2.1 — Statement Upload UI

- Build `(main)/statements/upload/page.tsx`:
  - Drag-and-drop file upload zone (accept `.html`, `.htm` files only)
  - File size validation (max 10MB)
  - Upload progress indicator
  - After upload: show parsing status, then display extracted metrics
- API route: `POST api/statements/upload`
  - Validate file type and size
  - Save to `public/uploads/statements/[userId]/[timestamp]_[filename]`
  - Trigger parsing (inline or via background job)
  - Return parsed metrics or parsing error

### Step 2.2 — MT4/MT5 Statement Parser

This is a critical piece. MT4/MT5 export HTML statements in a known table format.

- Create `src/services/statement-parser.ts`:
  - Parse HTML using `cheerio` (install: `npm install cheerio`)
  - MT4 format: look for the "Summary" table. Extract:
    - Total Net Profit
    - Gross Profit / Gross Loss
    - Profit Factor
    - Total Trades
    - Win Rate (Short Positions won % + Long Positions won %)
    - Max Drawdown (absolute and %)
    - Trading Period (first trade date to last trade date)
    - Pairs traded (extract from the trade history table)
  - MT5 format: similar but different table structure. Handle separately.
  - Return a typed `StatementMetrics` object:
    ```typescript
    interface StatementMetrics {
      totalNetProfit: number;
      grossProfit: number;
      grossLoss: number;
      profitFactor: number;
      totalTrades: number;
      winRate: number;
      maxDrawdown: number;
      maxDrawdownPercent: number;
      tradingPeriodStart: string;
      tradingPeriodEnd: string;
      pairsTraded: string[];
      sharpeRatio: number | null; // calculated if sufficient data
    }
    ```
- Write unit tests for the parser with sample MT4/MT5 HTML files

### Step 2.3 — Verification Flow

- Verification status system:
  - Upload → status: `PENDING`
  - Admin reviews → status: `VERIFIED` or `REJECTED` (with notes)
  - After 90 days → status: `EXPIRED` (cron job or check on access)
- Build verified profile display:
  - On `profile/[userId]`: show latest verified statement metrics
  - Badge: "Verified Trader" with verification method indicator
  - Stats cards: win rate, profit factor, max drawdown, total trades, trading period
- API routes:
  - `GET api/statements/me` — list own statements
  - `GET api/statements/[id]` — get statement details (owner or admin only)

### Step 2.4 — Admin Verification Dashboard

- Build `(main)/admin/statements/page.tsx` (admin-only, check role in middleware):
  - List of pending statements with user info
  - Click to review: see parsed metrics, view original uploaded HTML file
  - Approve / Reject buttons with optional notes field
  - Filter by status: pending, verified, rejected, expired
- API routes:
  - `GET api/admin/statements` — list statements (filterable)
  - `PATCH api/admin/statements/[id]` — update verification status

### Step 2.5 — Myfxbook Enhancement (International Layer)

- Only build this after core verification is solid
- Create `src/services/myfxbook.service.ts`:
  - OAuth flow: redirect to Myfxbook, receive callback, store refresh token
  - Fetch account data: total return, drawdown, win rate, etc.
  - Periodic sync: cron job runs every 6 hours when API is reachable
  - Cache data locally in the `TradingStatement` with `verificationMethod: BROKER_VERIFIED`
- Wrap in a try-catch that gracefully fails if Myfxbook is unreachable
- UI shows "Broker-Verified" vs "Self-Reported" badge

---

## Phase 3: Clan System (Make-or-Break Phase)

### Step 3.1 — Clan CRUD

- Build clan creation: `(main)/clans/create/page.tsx`
  - Form: name (unique), description, avatar upload, trading focus, privacy (public/private)
  - Creator automatically becomes `LEADER`
  - Size limits: FREE = 3 max members, PRO = 6 max members
- Build clan profile page: `(main)/clans/[clanId]/page.tsx`
  - Header: avatar, name, description, trading focus, member count, tier badge
  - Members list with roles and verified badges
  - Combined clan stats (aggregate of member stats)
  - Join button / Request to Join button (based on privacy setting)
- Build clan management: `(main)/clans/[clanId]/manage/page.tsx` (leader/co-leader only)
  - Edit details (name, description, avatar, trading focus, privacy)
  - Manage members: promote to co-leader, demote, remove
  - Invite links: generate, expire, set max uses
- API routes:
  - `POST api/clans` — create clan
  - `GET api/clans/[clanId]` — get clan profile
  - `PATCH api/clans/[clanId]` — update clan (leader/co-leader)
  - `DELETE api/clans/[clanId]` — delete clan (leader only)
  - `POST api/clans/[clanId]/invite` — generate invite link
  - `POST api/clans/[clanId]/join` — join via invite code or request
  - `PATCH api/clans/[clanId]/members/[userId]` — change role / remove

### Step 3.2 — Free Agents Discovery

- Build `(main)/discover/free-agents/page.tsx`:
  - List of verified traders not in a clan
  - Filters: trading style, preferred pairs, performance tier, risk level, session preference
  - Each card shows: name, avatar, verified badge, key stats (win rate, profit factor), trading style
  - "Invite to Clan" button (for clan leaders viewing free agents)
- API route:
  - `GET api/users/free-agents` — filtered list of unaffiliated verified traders

### Step 3.3 — Clan Chat (Socket.io)

This is architecturally critical. Chat must work entirely on the Iranian server.

- Set up Socket.io server:
  - Create a custom Next.js server (`server.ts`) that wraps the Next.js app and adds Socket.io
  - Or: use a separate Socket.io server process managed by PM2 alongside the Next.js app
  - **Recommended approach:** Separate Socket.io server in `src/socket-server.ts` running on a different port (e.g., 3001), proxied through Nginx. This keeps concerns separated and allows independent scaling.
- Socket.io authentication:
  - On connection, validate JWT token from NextAuth
  - Reject unauthorized connections
- Chat features:
  - Join/leave clan rooms
  - Send messages (text, basic markdown formatting)
  - Pin/unpin messages (leader/co-leader)
  - Message history: load last 50 messages on join, paginate older messages via REST API
  - Real-time presence indicators (who's online in the clan)
  - Typing indicators
- Store messages in PostgreSQL (`Message` model) for persistence
- Use Redis pub/sub if running multiple Socket.io instances (horizontal scaling later)
- Client component: `components/chat/ClanChat.tsx`
  - Message list with virtual scrolling (for performance with many messages)
  - Message input with formatting toolbar
  - Member list sidebar (online/offline)
- API routes (REST, for history):
  - `GET api/clans/[clanId]/messages` — paginated message history

### Step 3.4 — Clan Channels (Public Broadcast Feed)

- Each clan has one public channel (created automatically when clan is created)
- Channel is a broadcast feed (like Telegram channels):
  - Only leader/co-leader can post
  - Anyone can follow the channel
  - Posts support: text, images, embedded charts
  - Reactions on posts (emoji reactions with counts)
  - View count per post
- Build channel page: `(main)/clans/[clanId]/channel/page.tsx`
  - Post feed (infinite scroll)
  - Follow/unfollow button
  - Subscriber count
  - Each post shows: author name + verified stats, content, images, reactions, view count, timestamp
- Premium posts:
  - Posts can be marked as `isPremium: true`
  - Non-subscribers see a blurred preview + "Subscribe to read" CTA
  - Daily peek: non-subscribers get 3 free premium post views per day (tracked in Redis with daily TTL)
- API routes:
  - `POST api/clans/[clanId]/channel/posts` — create post (leader/co-leader)
  - `GET api/clans/[clanId]/channel/posts` — list posts (with premium gating)
  - `POST api/clans/[clanId]/channel/posts/[postId]/react` — add reaction
  - `POST api/clans/[clanId]/channel/follow` — follow/unfollow

### Step 3.5 — Clan Aggregated Stats

- Create a service that aggregates individual member stats into clan stats:
  - Combined total trades
  - Average win rate (weighted by trade count)
  - Average profit factor
  - Best/worst performer
  - Clan trading focus (most common pairs)
- Recalculate on: member join/leave, statement verification
- Store in `Clan.settings` JSON or a dedicated `ClanStats` model
- Display on clan profile page

---

## Phase 4: Seasons & Leaderboard

### Step 4.1 — Season System

- Seasons are monthly (configurable):
  - Auto-create: a cron job (or a scheduled function) checks daily. If no active season exists and it's the first of the month, create one.
  - Status transitions: `UPCOMING` → `ACTIVE` → `COMPLETED` → `ARCHIVED`
  - On season end: freeze standings, calculate awards, archive
- Build season display:
  - Top bar always shows: "Season 3 — 12 days remaining" (countdown)
  - Season history page: `(main)/seasons/page.tsx` — list of past seasons
  - Season detail: `(main)/seasons/[seasonId]/page.tsx` — final standings, awards

### Step 4.2 — Ranking Algorithm

Implement the scoring formula:

```typescript
function calculateScore(metrics: TraderMetrics): number {
  const returnScore = metrics.returnPercent * 0.40;
  const sharpeScore = Math.min(metrics.sharpeRatio, 3) / 3 * 100 * 0.25;
  const drawdownPenalty = Math.max(0, 100 - metrics.maxDrawdownPercent * 2) * 0.20;
  const activityScore = Math.min(metrics.tradeCount / MINIMUM_TRADES, 1) * 100 * 0.15;
  return returnScore + sharpeScore + drawdownPenalty + activityScore;
}
```

- Run ranking calculation daily (cron job or scheduled task)
- Store in `LeaderboardEntry` with rank position
- Track rank changes (compare to previous day's rank)

### Step 4.3 — Leaderboard Pages

- Build `(main)/leaderboard/page.tsx`:
  - Tabs: Traders | Clans
  - Trader leaderboard: rank, name, avatar, verified badge, return %, win rate, drawdown, score
  - Clan leaderboard: rank, name, avatar, member count, combined score
  - Filters: by instrument/pair, trading style, time period
  - Sort by: overall rank, return %, win rate, consistency, risk score
  - Rank movement arrows (up/down/same compared to previous period)
- API routes:
  - `GET api/leaderboard/traders` — filterable, sortable, paginated
  - `GET api/leaderboard/clans` — same

### Step 4.4 — Badges & Awards

- Badge/tier system based on cumulative performance:
  - Bronze: Complete first verified season
  - Silver: Top 50% for 2 seasons
  - Gold: Top 25% for 3 seasons
  - Diamond: Top 10% for 5 seasons
  - Legendary: Top 3 for any season
- Competition categories (end-of-season awards):
  - Overall Champion
  - Most Consistent (lowest variance in daily returns)
  - Best Risk Manager (lowest drawdown in top 20)
  - Rising Star (biggest rank improvement)
  - Specialist Awards (best per instrument)
- Store badges on user profile. Display on profile page as a "trophy wall."

### Step 4.5 — Notifications for Ranking Events

- Build a notification system:
  - Database model: `Notification (id, userId, type, title, body, data JSON, read, createdAt)`
  - Types: `RANK_CHANGE`, `SEASON_START`, `SEASON_END`, `BADGE_EARNED`, `CLAN_INVITE`
  - Deliver via: in-app notification bell (real-time via Socket.io) + optional email
- Trigger notifications on:
  - Rank change > 5 positions
  - Season start/end
  - Badge earned
  - Clan invite received

---

## Phase 5: Content & Stories

### Step 5.1 — Stories System

- Build `components/content/StoriesBar.tsx`:
  - Horizontal scrollable row at top of home feed (like Instagram stories)
  - Each circle: user avatar, name, verified badge, unread indicator (ring)
  - Click to open story viewer
- Build story creation: `(main)/stories/create/page.tsx`:
  - Upload image/chart screenshot
  - Add text overlay (position, color, size)
  - Process with `sharp`: resize, compress, apply text overlay
  - Save to `public/uploads/stories/[userId]/[timestamp].webp`
  - Set `expiresAt` to 24 hours from creation
- Build story viewer: `components/content/StoryViewer.tsx`:
  - Full-screen tap-through format
  - Show verified badge + win rate on every story
  - View count tracking
  - Auto-advance after 5 seconds, tap to advance/go back
- Cleanup: cron job deletes expired stories (files + DB records) daily
- API routes:
  - `POST api/stories` — create story
  - `GET api/stories/feed` — stories from followed users/clans
  - `POST api/stories/[id]/view` — track view

### Step 5.2 — Home Feed

- Build `(main)/dashboard/page.tsx` (the main home page after login):
  - Stories bar at top
  - Feed: posts from followed clan channels, ordered by recency
  - Trending/discovery section: popular posts from clans you don't follow
  - Each post card shows: clan avatar, clan name, author name + verified stats, content preview, reactions, view count
  - Infinite scroll pagination
- API route:
  - `GET api/feed` — personalized feed (followed channels + trending)

### Step 5.3 — Clan Content Library

- Permanent content section on each clan's channel:
  - Tutorials, strategy guides, trade breakdowns
  - Organized by category/tags
  - Separate from the broadcast feed (persistent, not time-sorted)
- Content creation editor:
  - Rich text editor (use `tiptap` or a similar lightweight editor)
  - Image embedding
  - Chart markup (annotate uploaded chart images)
- Premium content gating:
  - Same mechanism as premium channel posts
  - Daily peek: 3 free premium content views per day for non-subscribers

---

## Phase 6: AI System (AIRouter)

### Step 6.1 — Build the AIRouter Service

This is the failover abstraction. Every AI feature goes through this one service.

- Create `src/lib/ai-router.ts`:
  ```typescript
  class AIRouter {
    async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
      // 1. Try OpenRouter (3-second timeout)
      // 2. Try local Ollama
      // 3. Try cached response
      // Return response + metadata (which provider answered, latency)
    }
  }
  ```
- Provider chain implementation:
  - **OpenRouter:** HTTP call to `https://openrouter.ai/api/v1/chat/completions`. Model selection based on query type (e.g., Claude Sonnet for analysis, GPT-4o-mini for simple queries). 3-second timeout.
  - **Ollama:** HTTP call to local Ollama API (`http://localhost:11434/api/generate`). Use Mistral 7B as default.
  - **Cache:** Redis lookup by prompt hash. Every successful AI response is cached with 1-hour TTL.
- Health check: ping OpenRouter every 60 seconds. If 3 consecutive failures, skip OpenRouter entirely for 5 minutes (circuit breaker pattern).
- Admin toggle: force local-only mode via environment variable or admin setting.
- Logging: log every AI query (provider used, latency, success/failure) for monitoring.

### Step 6.2 — Ollama Setup Instructions

Document the Ollama setup (this will go in deployment docs, but list the commands):

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download models
ollama pull mistral:7b-instruct-v0.3-q4_K_M
ollama pull llama3:8b-instruct-q4_K_M

# Configure Ollama to listen on internal network
# Edit /etc/systemd/system/ollama.service
# Set OLLAMA_HOST=0.0.0.0:11434
# Firewall: only allow access from the app server IP
```

### Step 6.3 — AI Chat Feature (Spectator Chatbot)

- Build `(main)/ai/page.tsx`:
  - Chat interface: message input, message history, streaming responses
  - System prompt: "You are ClanTrader's AI assistant. You help users understand the platform, find clans, analyze trading performance, and answer questions about forex trading."
  - Database query access: the AI can query the database for:
    - Top clans this season
    - Trending instruments
    - Trader search by criteria
    - Platform statistics
  - Rate limiting: 3 free queries/day for non-pro users, unlimited for pro
  - UI indicator: green dot (cloud AI), yellow dot (local AI), gray dot (cached)
- API route:
  - `POST api/ai/chat` — send message, get streaming response via SSE

### Step 6.4 — Clan AI Assistant

- In clan chat, mention `@ai` to trigger the clan AI
- Pro-only feature
- Clan-specific context injected into prompt:
  - Clan members and their stats
  - Clan ranking and recent performance
  - Season status
- Capabilities:
  - "Find us a free agent who trades gold with low drawdown" → queries free agents DB
  - "How do we compare to Clan X?" → queries leaderboard
  - "Summarize our week" → aggregates recent member activity
- Implementation: intercept `@ai` messages in the Socket.io handler, route through AIRouter, post the response as a bot message in the chat

### Step 6.5 — Blackout Optimization

- Pre-compute top 50 queries every hour:
  - Top clans, top traders, trending pairs, season status, platform stats
  - Store in Redis with descriptive keys
- Daily "Platform Intelligence Snapshot":
  - JSON blob with all aggregated stats
  - Local Ollama can reference this without making database queries
  - Reduces load on the database during high-traffic blackout periods
- Simplified system prompts for Ollama:
  - Shorter context, more structured output format
  - Reduces token count, improves speed on smaller models

---

## Phase 7: Monetization (Iranian Payment)

### Step 7.1 — ZarinPal Integration

- Install ZarinPal SDK or use their REST API directly
- Create `src/services/payment.service.ts`:
  - `createPayment(amount, description, callbackUrl)` → returns payment URL
  - `verifyPayment(authority)` → confirms payment was successful
- Flow:
  1. User clicks "Upgrade to Pro" or "Subscribe to Channel"
  2. Backend creates ZarinPal payment request
  3. User is redirected to ZarinPal gateway
  4. After payment, ZarinPal redirects back to callback URL
  5. Backend verifies payment, activates subscription

### Step 7.2 — Pro Plan

- Build `(main)/settings/billing/page.tsx`:
  - Current plan display
  - Upgrade to Pro button (monthly/annual options)
  - Payment history
  - Cancel/resume subscription
- Pro features unlock:
  - Clan size: 6 members instead of 3
  - Unlimited AI queries
  - Story analytics
  - Clan AI assistant
  - Premium channel posting

### Step 7.3 — Channel Subscription Marketplace

- Build `(main)/discover/channels/page.tsx`:
  - Browse clan channels
  - Preview free posts, see premium post count
  - Subscribe button with price (set by clan in Toman)
- Clan revenue:
  - Platform takes 20-30% commission
  - Build revenue dashboard for clans: `(main)/clans/[clanId]/revenue/page.tsx`
  - Show: subscriber count, earnings this month, payout history
- Subscription management:
  - Monthly recurring (manual renewal or auto-renew prompt)
  - Daily/weekly pass options (future enhancement)

### Step 7.4 — Featured Placement

- Clans can pay for boosted visibility on the discover page
- Simple implementation: featured flag + expiry date on clan
- Featured clans appear at the top of discover/browse pages with a "Featured" badge

---

## Phase 8: Polish, Testing & Launch

### Step 8.1 — Mobile Responsive Audit

- Test every page at 375px, 414px, 768px, 1024px, 1440px breakpoints
- Priority mobile fixes:
  - Bottom tab navigation works smoothly
  - Chat is usable on small screens (keyboard doesn't overlap)
  - Stories viewer is full-screen on mobile
  - Leaderboard tables are horizontally scrollable
  - All forms are thumb-friendly

### Step 8.2 — Performance Optimization

- Image optimization:
  - All uploaded images processed with `sharp` (resize, compress, convert to WebP)
  - Lazy loading for images in feeds and stories
- Database:
  - Add indexes on all frequently queried columns (already in schema, but verify with `EXPLAIN ANALYZE`)
  - Connection pooling via Prisma
- Frontend:
  - Code splitting (Next.js App Router does this automatically)
  - Virtual scrolling for long lists (chat messages, leaderboard)
  - Redis caching for hot data (leaderboard, season info, trending content)

### Step 8.3 — Security Hardening

- Input validation: Zod schemas on every API route
- Rate limiting: use `express-rate-limit` or similar middleware on API routes
  - Auth routes: 5 requests/minute
  - AI routes: based on plan (3/day free, unlimited pro)
  - General API: 100 requests/minute per user
- CSRF protection: NextAuth handles this for auth routes; add CSRF tokens for mutations
- File upload validation: check MIME types, file size limits, sanitize filenames
- SQL injection: Prisma parameterizes all queries (safe by default)
- XSS: React escapes output by default; sanitize any user HTML content with `DOMPurify`
- Helmet-style HTTP headers via Next.js config

### Step 8.4 — Error Handling & UX States

- Every page and component must handle:
  - Loading state (skeleton loaders, not spinners)
  - Empty state (helpful message + CTA)
  - Error state (friendly error message + retry button)
  - Offline indicator (banner when connection lost, auto-reconnect for Socket.io)

### Step 8.5 — SEO & Meta Tags

- Next.js metadata API for every page
- Open Graph tags for sharing (clan profiles, trader profiles, channel posts)
- `sitemap.xml` generation
- `.ir` domain SEO considerations

### Step 8.6 — Blackout Resilience Test

Before launch, perform a full blackout simulation:

1. Block all international traffic on the production server
2. Test every feature:
   - Login/signup: works (NextAuth + local PostgreSQL)
   - Statement upload/parse: works (local file storage + Node.js parser)
   - Clan chat: works (Socket.io on local server)
   - Stories: works (local file storage)
   - Leaderboard: works (local PostgreSQL)
   - AI: falls back to Ollama → cached responses
   - Payments: works (ZarinPal is Iranian, operates on NIN)
3. Run a 24-hour simulated blackout test with beta users
4. Document any issues found and fix them

### Step 8.7 — Deployment Pipeline

Set up the push-based deployment:

```bash
# On dev server: build and deploy to production
npm run build
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env*' \
  --exclude='public/uploads' \
  .next/ package.json prisma/ public/ \
  user@prod-server:/var/www/clantrader/

# On prod server (via SSH):
cd /var/www/clantrader
npm install --production
npx prisma migrate deploy
pm2 restart clantrader
```

- Create deployment scripts in `scripts/deploy-dev.sh` and `scripts/deploy-prod.sh`
- PM2 ecosystem config for zero-downtime restarts

### Step 8.8 — Staged Launch

1. **Internal testing:** Developer uses every feature, stress-tests edge cases
2. **Alpha (10-15 users):** Trusted traders test on dev server. Collect feedback via a simple feedback form.
3. **Founding clans (5-10 clans):** Help alpha testers form clans on production. First real competition.
4. **Beta (100-200 users):** Expand access. Monitor database performance, Socket.io connections, error rates.
5. **Public soft launch:** Announce to Telegram communities first, then Instagram/YouTube.

---

## Implementation Order Summary

| Order | Step | What You Get |
|-------|------|-------------|
| 1 | Step 0.1-0.3 | Project scaffolding, DB schema, dev tooling |
| 2 | Step 1.1 | App shell (Telegram-style layout) |
| 3 | Step 1.2 | Auth (signup, login, email verify, password reset) |
| 4 | Step 1.3 | User profiles (view, edit, avatar) |
| 5 | Step 1.4 | Landing page |
| 6 | Step 2.1-2.2 | Statement upload + MT4/MT5 parser |
| 7 | Step 2.3-2.4 | Verification flow + admin dashboard |
| 8 | Step 3.1 | Clan CRUD (create, manage, invite) |
| 9 | Step 3.2 | Free agents discovery |
| 10 | Step 3.3 | Clan chat (Socket.io) |
| 11 | Step 3.4 | Clan channels (broadcast posts, premium, peeks) |
| 12 | Step 3.5 | Clan aggregated stats |
| 13 | Step 4.1-4.2 | Seasons + ranking algorithm |
| 14 | Step 4.3 | Leaderboard pages |
| 15 | Step 4.4-4.5 | Badges, awards, notifications |
| 16 | Step 5.1 | Stories |
| 17 | Step 5.2 | Home feed |
| 18 | Step 5.3 | Content library |
| 19 | Step 6.1-6.2 | AIRouter + Ollama setup |
| 20 | Step 6.3-6.4 | AI chatbot + clan AI assistant |
| 21 | Step 6.5 | Blackout AI optimization |
| 22 | Step 7.1-7.2 | ZarinPal + Pro plan |
| 23 | Step 7.3-7.4 | Channel subscriptions + featured placement |
| 24 | Step 8.1-8.5 | Polish, performance, security, SEO |
| 25 | Step 8.6 | Blackout resilience test |
| 26 | Step 8.7-8.8 | Deployment pipeline + staged launch |

---

## Key Technical Decisions

1. **Prisma over raw SQL:** Type-safe database access, automatic migrations, great DX with Claude Code. Trade-off: slightly less control over complex queries, but Prisma supports raw SQL when needed.

2. **Separate Socket.io server:** Keeps real-time chat independent from the Next.js app. Easier to scale and debug. Both processes managed by PM2.

3. **Redis for caching + rate limiting + daily peek tracking:** Fast, simple, TTL-based expiry handles most temporal data needs.

4. **File storage on disk (not S3/cloud):** Iranian-first requirement. Files stored in `public/uploads/` on the server. Backed up via daily rsync to a secondary location.

5. **JWT sessions (not database sessions):** Stateless, no session store dependency. Works even if Redis is down. Trade-off: can't revoke individual sessions (acceptable for this use case).

6. **App Router (not Pages Router):** Next.js App Router is the current standard. Better layouts, loading states, and server components. Claude Code handles App Router well.

7. **Zustand over Redux:** Minimal client state needs. Zustand is simpler, smaller, and sufficient for sidebar state, UI toggles, and client-side cache.

---

## Notes for Claude Code Sessions

When working on this project with Claude Code, start each session by reading `CLAUDE.md` for project rules. Build one step at a time. After each step:

1. Run `npm run lint` and `npm run build` to verify no errors
2. Test the feature manually in the browser
3. Commit with a clear message describing what was built
4. Move to the next step

Never skip ahead. Each step is designed to build on the previous one. If a step feels too large, break it into sub-steps within a single session.
