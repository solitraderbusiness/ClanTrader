# ClanTrader — Site Rules Audit Report

> **Date:** 2026-03-10
> **Purpose:** Evidence-backed audit of actual platform behavior from code inspection
> **Authority:** Input document for `SOURCE_OF_TRUTH.md`

## 0. Audit Contract

- This report audits **actual current platform behavior** as verified from code, schema, config, and services.
- It is an evidence-backed working report — not marketing or aspirational documentation.
- It is an input into `SOURCE_OF_TRUTH.md`. Verified rules from here should be reflected there.
- Where something cannot be verified, it is marked `NEEDS VERIFICATION`.
- Where code and docs disagree, **code wins** unless the code is clearly unfinished.

## 1. Audit Method

### Files Inspected
- `prisma/schema.prisma` — all models, enums, constraints, indexes
- `src/lib/auth.ts` — NextAuth config, providers, callbacks
- `src/lib/auth-utils.ts` — password hashing, token generation
- `src/lib/validators.ts` — all Zod validation schemas
- `src/lib/rate-limit.ts` — rate limiting tiers
- `src/lib/reserved-usernames.ts` — reserved username list
- `src/lib/chat-constants.ts` — chat configuration constants
- `src/lib/socket-auth.ts` — socket authentication
- `src/lib/socket-handlers/` — chat, trade, DM handlers
- `src/lib/socket-handlers/shared.ts` — shared utilities
- `src/middleware.ts` — route protection
- `src/services/clan.service.ts` — clan CRUD, membership, switching
- `src/services/join-request.service.ts` — join request lifecycle
- `src/services/message.service.ts` — message CRUD, pinning, reactions
- `src/services/dm.service.ts` — DM CRUD, read receipts
- `src/services/topic.service.ts` — topic CRUD, archival
- `src/services/trade-card.service.ts` — trade card CRUD, versioning
- `src/services/trade-action.service.ts` — trade mutations
- `src/services/ea.service.ts` — EA bridge core
- `src/services/ea-signal-create.service.ts` — signal auto-creation
- `src/services/ea-signal-modify.service.ts` — signal modification sync
- `src/services/ea-signal-close.service.ts` — signal close sync
- `src/services/signal-qualification.service.ts` — 20s window
- `src/services/integrity.service.ts` — 7-condition contract
- `src/services/statement-calc.service.ts` — statement calculation
- `src/services/mt-statement.service.ts` — MT statement generation
- `src/services/live-risk.service.ts` — live risk overlay, staleness
- `src/services/ranking.service.ts` — leaderboard calculation
- `src/services/badge-engine.service.ts` — badge evaluation
- `src/services/price-pool.service.ts` — price caching
- `src/services/journal.service.ts` — journal analytics
- `src/services/sms.service.ts` — Kavenegar OTP
- `src/services/admin.service.ts` — admin functions
- `src/services/auto-post.service.ts` — channel auto-post
- `src/services/clan-digest.service.ts` — clan digest
- `src/services/event-reminder.service.ts` — calendar reminders
- `src/services/ea-action.service.ts` — pending action system
- `src/app/api/auth/` — all auth routes
- `src/app/api/ea/` — all EA routes
- `src/app/api/admin/` — all admin routes
- `src/app/api/clans/` — all clan routes
- `src/app/api/dms/` — DM routes
- `src/app/api/users/` — user routes
- `src/app/api/leaderboard/` — leaderboard routes
- `ecosystem.config.cjs` — PM2 config
- `sentry.server.config.ts` / `sentry.client.config.ts` — error tracking
- `server.ts` — socket.io setup, background workers
- `ea/MQL4/ClanTrader_EA.mq4` / `ea/MQL5/ClanTrader_EA.mq5` — EA source

---

## 2. Rule Domains

### A. Auth & Access Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| AUTH-01 | Signup requires name (2-50 chars), username (3-30, lowercase, starts with letter), email, password (min 8) | ACTIVE | VERIFIED IN CODE | `validators.ts`, `auth/signup/route.ts` | |
| AUTH-02 | 42 reserved usernames blocked (admin, support, system, clantrader, etc.) | ACTIVE | VERIFIED IN CODE | `reserved-usernames.ts` | |
| AUTH-03 | Email verification required for email login | ACTIVE | VERIFIED IN CODE | `auth.ts` lines 26-31 | Auto-verified in dev if no SMTP_HOST |
| AUTH-04 | Phone OTP: 6-digit code, 5-min TTL, max 5 failed attempts, 3 sends per 10 min | ACTIVE | VERIFIED IN CODE | `sms.service.ts`, `send-otp/route.ts` | Iranian mobile format only: `09xxxxxxxxx` |
| AUTH-05 | Phone signup creates account without email or password | ACTIVE | VERIFIED IN CODE | `phone-signup/route.ts` | User gets `phoneVerified` timestamp |
| AUTH-06 | Signup rate limit: 5 req/60s per IP (AUTH_STRICT tier) | ACTIVE | VERIFIED IN CODE | `rate-limit.ts` | |
| AUTH-07 | Password reset token expires in 1 hour | ACTIVE | VERIFIED IN CODE | `forgot-password/route.ts` | |
| AUTH-08 | Session strategy: JWT (not database sessions) | ACTIVE | VERIFIED IN CODE | `auth.ts` | |
| AUTH-09 | Session contains: id, email, name, role, isPro, username, phone, phoneVerified, onboardingComplete | ACTIVE | VERIFIED IN CODE | `auth.ts` callbacks | |
| AUTH-10 | Three roles: SPECTATOR (default), TRADER (EA login), ADMIN (manual) | ACTIVE | VERIFIED IN CONFIG | `schema.prisma` UserRole enum | |
| AUTH-11 | SPECTATOR auto-upgraded to TRADER on first EA login | ACTIVE | VERIFIED IN CODE | `ea.service.ts` line 162 | |
| AUTH-12 | No country/IP restrictions exist | ACTIVE | VERIFIED IN CODE | No geo checks found anywhere | Phone format is Iranian but no geo-block |
| AUTH-13 | Email verification resend: 1 per 60s per email | ACTIVE | VERIFIED IN CODE | `verify-email/route.ts` | |
| AUTH-14 | Unverified email users cannot log in (hard block) | ACTIVE | VERIFIED IN CODE | `auth.ts` credential provider | EA-only and phone-only users bypass this |

### B. Onboarding Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| ONB-01 | Single modal shown when `onboardingComplete === false` | ACTIVE | VERIFIED IN CODE | `OnboardingIntentModal.tsx` | |
| ONB-02 | Intent options: LEARN, COMPETE, SHARE, RECRUIT (or skip) | ACTIVE | VERIFIED IN CODE | `onboarding-intent/route.ts` | |
| ONB-03 | No features are gated by onboarding completion | ACTIVE | VERIFIED IN CODE | No feature checks on `onboardingComplete` found | Modal is informational only |
| ONB-04 | 5 missions: explore, follow, join-clan, metatrader, post | ACTIVE | VERIFIED IN CODE | `missions/route.ts` | MetaTrader mission requires TRADER/ADMIN role |

### C. Clan Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| CLAN-01 | One clan per user enforced (DB unique + service check) | ACTIVE | VERIFIED IN CODE | `schema.prisma` `@@unique([userId, clanId])`, `clan.service.ts` | 409 ALREADY_IN_CLAN |
| CLAN-02 | Clan name: 3-30 chars, alphanumeric + spaces/hyphens, must start/end alphanumeric | ACTIVE | VERIFIED IN CODE | `validators.ts` lines 201-208 | |
| CLAN-03 | Clan name unique (DB + service check) | ACTIVE | VERIFIED IN CODE | `schema.prisma`, `clan.service.ts` | 409 NAME_TAKEN |
| CLAN-04 | Creator auto-joins as LEADER | ACTIVE | VERIFIED IN CODE | `clan.service.ts` line 61 | |
| CLAN-05 | Member limits: FREE tier = 3, PRO tier = 6 | ACTIVE | VERIFIED IN CODE | `clan-constants.ts` | 403 CLAN_FULL |
| CLAN-06 | Public clans: direct join. Private clans: join request approval | ACTIVE | VERIFIED IN CODE | `join-request.service.ts` | |
| CLAN-07 | Only LEADER/CO_LEADER can approve/reject join requests | ACTIVE | VERIFIED IN CODE | `join-request.service.ts` lines 99, 151 | |
| CLAN-08 | Rejected join requests can be re-submitted (resets to PENDING) | ACTIVE | VERIFIED IN CODE | `join-request.service.ts` lines 63-74 | |
| CLAN-09 | Only one pending join request per user per clan | ACTIVE | VERIFIED IN CONFIG | `schema.prisma` `@@unique([clanId, userId])` on ClanJoinRequest | |
| CLAN-10 | Switch: leave current + join target in single transaction | ACTIVE | VERIFIED IN CODE | `clan.service.ts` lines 391-474 | |
| CLAN-11 | Switch to private clan: leave current, create pending join request | ACTIVE | VERIFIED IN CODE | `clan.service.ts` lines 450-461 | User is clanless until approved |
| CLAN-12 | Leader with members cannot leave or switch without transferring leadership first | ACTIVE | VERIFIED IN CODE | `clan.service.ts` lines 329-333, 414-419 | 400 LEADER_CANNOT_LEAVE |
| CLAN-13 | Solo leader leaving: clan auto-dissolved (hard delete) | ACTIVE | VERIFIED IN CODE | `clan.service.ts` lines 316-326 | Cascade deletes all data |
| CLAN-14 | Clan deletion: LEADER only, hard delete, cascades all data | ACTIVE | VERIFIED IN CODE | `clan.service.ts` line 141-150 | Members, messages, trades, topics all deleted |
| CLAN-15 | Leadership transfer: LEADER only, target must be existing member, atomic | ACTIVE | VERIFIED IN CODE | `clan.service.ts` lines 342-389 | |
| CLAN-16 | LEADER can remove anyone; CO_LEADER can remove MEMBERs only | ACTIVE | VERIFIED IN CODE | `clan.service.ts` lines 245-258 | |
| CLAN-17 | Only LEADER can change member roles | ACTIVE | VERIFIED IN CODE | `clan.service.ts` line 276 | |
| CLAN-18 | Clan settings: only LEADER/CO_LEADER can edit | ACTIVE | VERIFIED IN CODE | `settings/route.ts` | |
| CLAN-19 | Public clan search returns only `isPublic: true` clans | ACTIVE | VERIFIED IN CODE | `clan.service.ts` line 529 | |
| CLAN-20 | Non-members can view public clan basic info (no auth check on getClan) | ACTIVE | VERIFIED IN CODE | `clan.service.ts` lines 72-95 | |

### D. Chat & DM Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| CHAT-01 | Only clan members can send messages | ACTIVE | VERIFIED IN CODE | `message.service.ts` line 47-59 | 403 NOT_MEMBER |
| CHAT-02 | Message max length: 2000 chars | ACTIVE | VERIFIED IN CODE | `chat-constants.ts` MESSAGE_CONTENT_MAX | |
| CHAT-03 | Rate limit: 5 messages per 10 seconds per user (global across all chats/DMs) | ACTIVE | VERIFIED IN CODE | `chat-constants.ts`, `shared.ts` lines 223-230 | |
| CHAT-04 | Max images per message: 4 | ACTIVE | VERIFIED IN CODE | `chat-constants.ts` CHAT_IMAGES_MAX | |
| CHAT-05 | Message editing: author only, no time limit, sets isEdited flag | ACTIVE | VERIFIED IN CODE | `message.service.ts` lines 82-109 | |
| CHAT-06 | Message deletion: author OR LEADER/CO_LEADER, permanent hard delete | ACTIVE | VERIFIED IN CODE | `message.service.ts` lines 111-138 | |
| CHAT-07 | Pinning: LEADER/CO_LEADER only, max 10 pinned per topic | ACTIVE | VERIFIED IN CODE | `message.service.ts` lines 222-270 | |
| CHAT-08 | Reactions: fixed set of 6 emojis only, toggle on/off | ACTIVE | VERIFIED IN CODE | `chat-constants.ts` line 18 | `["👍", "❤️", "😂", "😮", "😢", "🔥"]` |
| CHAT-09 | Topics: LEADER/CO_LEADER can create, max 20 per clan | ACTIVE | VERIFIED IN CODE | `topics/route.ts` | |
| CHAT-10 | Default topic "General" auto-created per clan, cannot be renamed or archived | ACTIVE | VERIFIED IN CODE | `topic.service.ts` lines 42-69, 101-123 | |
| CHAT-11 | Topic archival is soft-delete (status: ARCHIVED) | ACTIVE | VERIFIED IN CODE | `topic.service.ts` lines 101-123 | |
| CHAT-12 | All clan members can see and post in all active topics (no per-topic ACL) | ACTIVE | VERIFIED IN CODE | No topic-level permission checks found | |
| CHAT-13 | DMs: any user can DM any other user (no clan/mutual requirement) | ACTIVE | VERIFIED IN CODE | `dm.service.ts` lines 18-43 | |
| CHAT-14 | DMs: cannot message yourself (400 SELF_MESSAGE) | ACTIVE | VERIFIED IN CODE | `dm.service.ts` | |
| CHAT-15 | DM editing/deletion: sender only, permanent | ACTIVE | VERIFIED IN CODE | `dm.service.ts` lines 154-197 | |
| CHAT-16 | DM read receipts: auto-marked on conversation open | ACTIVE | VERIFIED IN CODE | `dm.service.ts` lines 138-145 | |
| CHAT-17 | Typing indicator: 3-second timeout, broadcast to room | ACTIVE | VERIFIED IN CODE | `chat-handlers.ts` lines 365-378 | |
| CHAT-18 | Presence tracking: Redis hash per clan, 5-min TTL | ACTIVE | VERIFIED IN CODE | `shared.ts` lines 24, 213-221 | |
| CHAT-19 | No user blocking, muting, or reporting exists | ACTIVE | VERIFIED IN CODE | No models/routes/services for block/mute/report | **Gap for launch** |
| CHAT-20 | No content filtering or profanity filter exists | ACTIVE | VERIFIED IN CODE | No filtering logic found | |
| CHAT-21 | No message retention policy — messages stored indefinitely | ACTIVE | VERIFIED IN CODE | No archival/TTL mechanism found | |

### E. Trade Card & Statement Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| TRADE-01 | SIGNAL cards: LEADER/CO_LEADER only (enforced via socket handler) | ACTIVE | VERIFIED IN CODE | `trade-handlers.ts` lines 55-62 | Role check in socket handler, not in service |
| TRADE-02 | ANALYSIS cards: any clan member | ACTIVE | VERIFIED IN CODE | `trade-handlers.ts` | |
| TRADE-03 | Card fields: instrument (uppercase), direction, entry, stopLoss, targets[], timeframe required | ACTIVE | VERIFIED IN CODE | `validators.ts` lines 372-404 | |
| TRADE-04 | Card editing: author only, version history saved, no time limit | ACTIVE | VERIFIED IN CODE | `trade-card.service.ts` lines 97-124 | |
| TRADE-05 | Cards can be edited even after trade closes (no restriction) | ACTIVE | VERIFIED IN CODE | No `closedAt` check in edit logic | Frozen snapshots protect statement integrity |
| TRADE-06 | Version history: up to 10 versions tracked per card | ACTIVE | VERIFIED IN CODE | `trade-card.service.ts` | |
| TRADE-07 | Statement eligibility: 7 integrity conditions (deny-by-default) | ACTIVE | VERIFIED IN CODE | `integrity.service.ts` | See CLAUDE.md for full list |
| TRADE-08 | Signal qualification: 20s window from MT open time | ACTIVE | VERIFIED IN CODE | `signal-qualification.service.ts` | AT_OPEN or WITHIN_WINDOW |
| TRADE-09 | Frozen risk snapshot: immutable after qualification | ACTIVE | VERIFIED IN CODE | `signal-qualification.service.ts` | officialEntry/SL/TP/RiskAbs/RiskMoney |
| TRADE-10 | Statement metrics: win rate, avg R, total R, profit factor, best/worst R | ACTIVE | VERIFIED IN CODE | `statement-calc.service.ts` | |
| TRADE-11 | Statement is per-user-per-clan (not global) | ACTIVE | VERIFIED IN CONFIG | `schema.prisma` `@@unique([userId, clanId, periodType, periodKey])` | |
| TRADE-12 | MT statement auto-generation: min 5 closed trades required | ACTIVE | VERIFIED IN CODE | `mt-statement.service.ts` line 5 | |
| TRADE-13 | Journal shows tracked (official) and analysis trades in separate tabs | ACTIVE | VERIFIED IN CODE | `journal.service.ts` | |
| TRADE-14 | Journal equity curve: downsampled by day if >500 trades | ACTIVE | VERIFIED IN CODE | `journal.service.ts` | |
| TRADE-15 | Journal streaks: win/loss streaks tracked, break-even excluded | ACTIVE | VERIFIED IN CODE | `journal.service.ts` | |
| TRADE-16 | Close price 0 treated as valid (R calculated from it) | ACTIVE | VERIFIED IN CODE | `trade-r.ts` line 42 | Edge case — could produce misleading R |
| TRADE-17 | Entry equals SL (zero risk): fails qualification, never eligible | ACTIVE | VERIFIED IN CODE | `signal-qualification.service.ts` line 73-74 | |

### F. EA Bridge & Integrity Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| EA-01 | Heartbeat: full open-trade snapshot every 30s | ACTIVE | VERIFIED IN CODE | `ea/MQL4/ClanTrader_EA.mq4` | Timer = 3s, heartbeat every 10th tick |
| EA-02 | Heartbeat rate limit: 1 per 10s per account | ACTIVE | VERIFIED IN CODE | `ea.service.ts` line 222 | |
| EA-03 | Trade events: immediate on open/close/modify | ACTIVE | VERIFIED IN CODE | EA MQL source | MT5 via OnTradeTransaction, MT4 via OnTick |
| EA-04 | Close detection: DB open trades not in heartbeat = closed | ACTIVE | VERIFIED IN CODE | `ea.service.ts` lines 284-348 | |
| EA-05 | Close price fallback: same-trade → same-account → same-source-group (never cross-source) | ACTIVE | VERIFIED IN CODE | `price-pool.service.ts` getVerifiedPrice | |
| EA-06 | Tracking status: ACTIVE (<60s), STALE (60-120s), TRACKING_LOST (>120s) | ACTIVE | VERIFIED IN CODE | `live-risk.service.ts` lines 245-282 | |
| EA-07 | Ranking degrades: RANKED → PROVISIONAL → UNRANKED based on tracking status | ACTIVE | VERIFIED IN CODE | `live-risk.service.ts` lines 288-327 | |
| EA-08 | Pending actions: 5-min expiry, max 10 per heartbeat response | ACTIVE | VERIFIED IN CODE | `ea-action.service.ts` | |
| EA-09 | API key: 32-byte hex (64 chars), stored plaintext in DB | ACTIVE | VERIFIED IN CODE | `ea.service.ts` line 25 | Not hashed — used for direct lookup |
| EA-10 | Signal creation dedup: Redis lock + DB matchedTradeId check | ACTIVE | VERIFIED IN CODE | `ea-signal-create.service.ts` lines 19, 23 | |
| EA-11 | Modification dedup: Redis lock on tradeId+SL+TP combo | ACTIVE | VERIFIED IN CODE | `ea-signal-modify.service.ts` line 24 | |
| EA-12 | SL removal: CRITICAL severity event, trade marked UNPROTECTED | ACTIVE | VERIFIED IN CODE | `ea-signal-modify.service.ts` lines 66-102 | |
| EA-13 | ANALYSIS → SIGNAL upgrade: only within 20s window, eligibility stays false (anti-cheat) | ACTIVE | VERIFIED IN CODE | `ea-signal-modify.service.ts` lines 163-200 | |
| EA-14 | Pending orders NOT tracked (filtered out in EA: `OrderType() > OP_SELL` skipped) | ACTIVE | VERIFIED IN CODE | EA MQL source | Only market orders synced |
| EA-15 | No explicit reconnect handshake — reconciliation is implicit via heartbeat snapshot | ACTIVE | VERIFIED IN CODE | `ea.service.ts` | |
| EA-16 | No gap audit logging exists | ACTIVE | VERIFIED IN CODE | No gap event model or logging | **Gap for launch** |
| EA-17 | Account uniqueness: one account per broker per user | ACTIVE | VERIFIED IN CONFIG | `schema.prisma` `@@unique([accountNumber, broker])` | |

### G. Leaderboard & Badge Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| LDR-01 | 6 ranking lenses: composite, profit, low_risk, consistency, risk_adjusted, activity | ACTIVE | VERIFIED IN CODE | `ranking-constants.ts` | |
| LDR-02 | Composite weights: profit 0.3, consistency 0.25, risk_adjusted 0.2, low_risk 0.15, activity 0.1 | ACTIVE | VERIFIED IN CODE | `ranking-constants.ts` | Admin-configurable |
| LDR-03 | Minimum 10 trades for ranking (admin-configurable) | ACTIVE | VERIFIED IN CODE | `ranking.service.ts` line 56 | |
| LDR-04 | Effective rank: closedOfficialR + openLossPenaltyR (open profits ignored) | ACTIVE | VERIFIED IN CODE | `live-risk.service.ts` | |
| LDR-05 | Leaderboard is per-season, not per-clan | ACTIVE | VERIFIED IN CODE | `ranking.service.ts` | |
| LDR-06 | Leaderboard requires authentication (no anonymous access) | ACTIVE | VERIFIED IN CODE | `leaderboard/route.ts` | |
| BDG-01 | 4 badge categories: RANK, PERFORMANCE, TROPHY, OTHER | ACTIVE | VERIFIED IN CONFIG | `schema.prisma` BadgeCategory enum | |
| BDG-02 | Valid trade for badges: closed + VERIFIED + statementEligible + SIGNAL | ACTIVE | VERIFIED IN CODE | `badge-engine.service.ts` lines 39-49 | |
| BDG-03 | Entry/SL edits invalidate badge eligibility (except SET_BE/MOVE_SL) | ACTIVE | VERIFIED IN CODE | `badge-engine.service.ts` lines 79-104 | |
| BDG-04 | Badges can be revoked automatically when user no longer qualifies | ACTIVE | VERIFIED IN CODE | `badge-engine.service.ts` line 200-206 | |
| BDG-05 | Admin can recompute badges (all users, single user, or single badge) | ACTIVE | VERIFIED IN CODE | `admin/badges/recompute/route.ts` | |
| BDG-06 | Badges are public on user profile | ACTIVE | VERIFIED IN CODE | `users/[userId]/badges` — public GET | |

### H. Admin & Moderation Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| ADM-01 | All admin routes require `role === "ADMIN"` | ACTIVE | VERIFIED IN CODE | All `/api/admin/` routes | |
| ADM-02 | Cron routes accept `x-cron-secret` header as alternative to admin role | ACTIVE | VERIFIED IN CODE | `stale-check/route.ts` | |
| ADM-03 | Admin can impersonate any user (creates new JWT, sets cookie) | ACTIVE | VERIFIED IN CODE | `impersonate/route.ts` | |
| ADM-04 | Impersonation does NOT log to audit trail | ACTIVE | VERIFIED IN CODE | No audit call in impersonate route | **Security gap** |
| ADM-05 | Feature flags: CRUD, cached, invalidated on change | ACTIVE | VERIFIED IN CODE | `admin/feature-flags/` routes | |
| ADM-06 | Audit log: action, entityType, entityId, actorId, level, category | ACTIVE | VERIFIED IN CONFIG | `schema.prisma` AuditLog model | |
| ADM-07 | No user-facing moderation exists (no blocking, muting, reporting, content filtering) | ACTIVE | VERIFIED IN CODE | No moderation models/routes/services | **Gap for launch** |
| ADM-08 | Badge admin changes tracked separately in BadgeAdminChange table | ACTIVE | VERIFIED IN CODE | `badge-engine.service.ts` | |

### I. Notification & Digest Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| NTF-01 | Calendar event reminders: 1-hour and 1-minute before, via socket | ACTIVE | VERIFIED IN CODE | `event-reminder.service.ts` | Dedup via Redis 2h TTL |
| NTF-02 | Daily/evening digests: manual scripts with suggested cron times | PARTIAL | VERIFIED IN CODE | `scripts/daily-digest.ts`, `scripts/evening-digest.ts` | Not auto-scheduled |
| NTF-03 | Digest delivery: Telegram (if bot token configured) | ACTIVE | VERIFIED IN CODE | Telegram integration in digest scripts | |
| NTF-04 | Clan digest: on-demand, 90s Redis cache, timezone-aware | ACTIVE | VERIFIED IN CODE | `clan-digest.service.ts` | |
| NTF-05 | No in-app notification system exists (no Notification model) | ACTIVE | VERIFIED IN CODE | No notification model in schema | |
| NTF-06 | No push notifications (no service worker push setup) | ACTIVE | VERIFIED IN CODE | No push notification code found | |
| NTF-07 | No email notifications (beyond auth verification emails) | ACTIVE | VERIFIED IN CODE | No notification email service | |

### J. Monetization & Access Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| MON-01 | `isPro` field on User (default false), no active way to set it | PARTIAL | VERIFIED IN CODE | `schema.prisma` User model | No payment flow |
| MON-02 | PaywallRule model exists but rules are NOT enforced in any route | PARTIAL | VERIFIED IN CODE | Model exists, no middleware/check uses it | Admin can create rules but they do nothing |
| MON-03 | SubscriptionPlan model exists, admin can CRUD plans | PARTIAL | VERIFIED IN CODE | `admin/plans/` | No checkout/subscription flow |
| MON-04 | Referral system: tracks LINK_COPIED, LINK_SHARED, LINK_CLICKED, SIGNUP events | ACTIVE | VERIFIED IN CODE | `ReferralEvent` model, admin page | |
| MON-05 | Default currency: IRR (Iranian Rial) | ACTIVE | VERIFIED IN CONFIG | `schema.prisma` SubscriptionPlan | |
| MON-06 | No payment processor integration (ZarinPal folder empty) | ACTIVE | VERIFIED IN CODE | `src/app/api/payments/` empty | |

### K. Infrastructure & Operational Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| OPS-01 | PM2 single fork instance, 1GB memory limit, auto-restart | ACTIVE | VERIFIED IN CODE | `ecosystem.config.cjs` | |
| OPS-02 | Error tracking: Sentry + Telegram error forwarding | ACTIVE | VERIFIED IN CODE | `sentry.*.config.ts`, `src/lib/telegram.ts` | |
| OPS-03 | Rate limiting: 6 Redis-backed tiers, fail-open | ACTIVE | VERIFIED IN CODE | `rate-limit.ts` | |
| OPS-04 | No /api/health endpoint | ACTIVE | VERIFIED IN CODE | No health route file exists | |
| OPS-05 | No automated database backups | ACTIVE | VERIFIED IN CODE | No backup scripts in repo | |
| OPS-06 | Deploy scripts exist but reference wrong paths (/home/ubuntu/) | ACTIVE | VERIFIED IN CODE | `scripts/deploy-*.sh` | Need update for Germany VPS |
| OPS-07 | Background workers: trade evaluator (60s, feature-flagged), event reminder (30s) | ACTIVE | VERIFIED IN CODE | `server.ts` | |
| OPS-08 | Stale-check: API endpoint, needs external cron (not in-process) | ACTIVE | VERIFIED IN CODE | `admin/stale-check/route.ts` | NEEDS VERIFICATION: is cron configured? |
| OPS-09 | Socket.io: JWT auth, WebSocket + polling, 10 reconnect attempts | ACTIVE | VERIFIED IN CODE | `server.ts`, `socket-client.ts` | |

### L. Security & Data Handling Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| SEC-01 | Passwords: bcrypt 10 rounds, min 8 chars, no complexity rules | ACTIVE | VERIFIED IN CODE | `auth-utils.ts` | |
| SEC-02 | API keys: 64-char hex, stored plaintext (not hashed) | ACTIVE | VERIFIED IN CODE | `ea.service.ts` | Used for fast DB lookup |
| SEC-03 | File uploads: JPEG/PNG/WebP only, 5MB max, resized to 256x256 WebP | ACTIVE | VERIFIED IN CODE | `users/avatar/route.ts` | |
| SEC-04 | CORS: scoped to NEXT_PUBLIC_APP_URL (not wildcard) | ACTIVE | VERIFIED IN CODE | `server.ts` socket.io config | |
| SEC-05 | No HTML sanitization — relies on React JSX escaping | ACTIVE | VERIFIED IN CODE | No sanitization library found | |
| SEC-06 | Prisma prevents SQL injection (parameterized queries) | ACTIVE | VERIFIED IN CODE | Framework-level | |
| SEC-07 | No content moderation or input filtering beyond length limits | ACTIVE | VERIFIED IN CODE | No filter logic | |
| SEC-08 | Admin impersonation: no audit log, no expiry limit (30-day cookie) | ACTIVE | VERIFIED IN CODE | `impersonate/route.ts` | **Security concern** |

### M. Product Scope Rules

| Rule ID | Rule Statement | Status | Verification | Source | Notes |
|---------|---------------|--------|-------------|--------|-------|
| MVP-01 | In MVP: auth, clans, chat, DMs, trade cards, EA bridge, integrity, statements, leaderboards, badges, admin, i18n | ACTIVE | VERIFIED IN CODE | All services exist | |
| MVP-02 | Deferred: AI features, payment processing, channel post UI, broker import, CI/CD | ACTIVE | VERIFIED IN CODE | Empty folders / stubs | |
| MVP-03 | Deferred: user blocking/muting, content moderation, push notifications | ACTIVE | VERIFIED IN CODE | No implementation exists | |
| MVP-04 | Deferred: pending order tracking | ACTIVE | VERIFIED IN CODE | EA filters out pending orders | |

---

## 3. Hidden / Edge-Case Rules

| Case | Behavior | Source |
|------|----------|--------|
| User switches from clan A to public clan B | Leave A + join B in single transaction. Trades stay in clan A's context. | `clan.service.ts` lines 464-469 |
| User switches to private clan B | Leave A, create pending join request for B. User is clanless until approved. | `clan.service.ts` lines 450-461 |
| Solo leader switches clans | Current clan auto-dissolved (hard deleted), then join target | `clan.service.ts` lines 439-445 |
| Leader with team tries to switch | 400 error: must transfer leadership first | `clan.service.ts` lines 414-419 |
| User's trades when they leave clan | Trades remain in original clan (not deleted). User loses access to view them in chat. | Cascade is on ClanMember, not Trade |
| EA sends 0 open trades | All DB-open trades for that account marked as closed | `ea.service.ts` close detection |
| Close price is 0 | Treated as valid. R calculated from `(0 - entry) / risk`. | `trade-r.ts` line 42 |
| Entry equals SL | Fails signal qualification. Trade never eligible for statement. | `signal-qualification.service.ts` line 73 |
| Trade has TP but no SL | Fails qualification (both SL>0 and TP>0 required). Card type = ANALYSIS. | `signal-qualification.service.ts` line 70-71 |
| Two MT accounts same ticket | Integrity condition 6 prevents double-counting. Second trade ineligible. | `integrity.service.ts` |
| Disconnecting MT account | `isActive = false`. Tracking degrades. Open trades remain as-is. | `ea.service.ts` disconnectAccount |
| Redis restart | Price cache lost. Dedup locks reset. DB-level checks prevent actual duplication. | Architectural |
| Unverified email user | Cannot log in at all. Must verify first. | `auth.ts` credential provider |
| Phone-only user | Can log in, has `phoneVerified`, no email or password. | `phone-signup/route.ts` |
| Admin impersonation | Creates full JWT. No audit trail. No way to detect impersonated session. | `impersonate/route.ts` |

---

## 4. Contradictions Found

| Old Claim | Actual Truth | Evidence | Action |
|-----------|-------------|----------|--------|
| SOURCE_OF_TRUTH says "SIGNAL cards: leader/co-leader only" | Role check exists in socket handler only, not in trade-card service | `trade-handlers.ts` lines 55-62 vs `trade-card.service.ts` | Clarify: enforced via socket (primary path), service has no role check (secondary concern) |
| SOURCE_OF_TRUTH doesn't mention member limits | FREE=3, PRO=6 enforced in code | `clan-constants.ts` | Add to SOT |
| SOURCE_OF_TRUTH doesn't mention moderation gap | No blocking, muting, reporting, or content filtering exists | No models/routes found | Add to SOT launch blockers or known gaps |
| CLAUDE.md says "GlitchTip (error tracking)" | Already fixed to "Sentry" in current SOT | Previous audit | Already resolved |
| SOURCE_OF_TRUTH says "Digest: clan-digest.service.ts" | Clan digest exists but project digests are manual scripts | `scripts/daily-digest.ts` | Already captured in SOT |

---

## 5. Rules Missing From SOURCE_OF_TRUTH.md

1. **Clan member limits** (FREE=3, PRO=6) — not mentioned
2. **Chat constraints** (2000 char max, 5 msg/10s, 4 images, 6 emoji reactions, 10 max pinned, 20 max topics)
3. **DM rules** (any-to-any, no clan requirement, no blocking)
4. **Moderation gap** (no blocking/muting/reporting/content filtering)
5. **Notification gap** (no in-app notifications, no push, no email notifications)
6. **Admin impersonation** lacks audit logging
7. **Username rules** (3-30 chars, lowercase, 42 reserved names)
8. **Signup auto-verification** in dev mode (no SMTP_HOST)
9. **Phone format** restricted to Iranian mobile (`09xxxxxxxxx`)
10. **Paywall rules exist but are not enforced** (admin can create rules that have no effect)
11. **API keys stored plaintext** (not hashed — deliberate for fast lookup)
12. **Cards can be edited after trade closes** (frozen snapshots protect integrity)
13. **Leaderboard is per-season not per-clan**
14. **Journal vs statement difference** (journal includes analysis tab, statement does not)
15. **Composite ranking weights** (specific numbers)

---

## 6. Needs Verification Queue

1. **Is the stale-check cron actually configured on dev server?** — Check `crontab -l` on 31.97.211.86
2. **Are daily/evening digest scripts scheduled?** — `pg-backup.log` suggests something runs, but no crontab in repo
3. **Is auto-post actually enabled for any clan?** — Feature flag dependent, unclear if any flag is set
4. **Do trade cards have a REST API creation path (not just socket)?** — If so, the SIGNAL role check is bypassable
5. **Is there a route for public/anonymous statement viewing?** — Auth check on statement route needs verification
6. **Are PaywallRule checks enforced anywhere in middleware?** — Currently they appear unused
7. **Is admin impersonation ever logged anywhere outside the route?** — No audit call found
8. **What happens to user's statement data when they leave a clan?** — ClanMember cascade doesn't affect Trade or TraderStatement
