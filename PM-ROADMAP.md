# ClanTrader PM Roadmap

**Generated:** March 2, 2026
**Source:** Full codebase audit (30+ Prisma models, 110+ API routes, 36 services, 29 E2E tests)
**Status Model:** PLANNED → IMPLEMENTED → INTEGRATED → CONFIGURED → VERIFIED → HARDENED → OPERABLE

---

## Launch Blockers (Hard Gate for MVP Beta)

These items MUST reach at least CONFIGURED before any real user touches the platform:

| # | Item | Current Status | What's Missing |
|---|------|---------------|----------------|
| 1 | Phone OTP (Kavenegar) | INTEGRATED | Need `KAVENEGAR_API_KEY` env var on prod |
| 2 | Email verification (SMTP) | INTEGRATED | Need `SMTP_HOST/PORT/USER/PASS` on prod |
| 3 | Integrity contract | HARDENED | Unit-tested + 12 loopholes fixed. Ready. |
| 4 | Mobile responsive | IMPLEMENTED | Ongoing polish — critical for Iranian mobile-first users |
| 5 | Error monitoring | PLANNED | Zero error tracking. Need GlitchTip or equivalent. |
| 6 | Automated DB backups | PLANNED | Only manual snapshots during deploy. Need cron pg_dump. |
| 7 | Health check endpoint | PLANNED | No `/api/health`. Needed for monitoring. |
| 8 | Security audit | PLANNED | No OWASP review conducted. Financial platform risk. |

## MVP Beta Definition

MVP Beta = Platform usable by 10-15 alpha testers with real accounts:

- Users can sign up via phone OTP (**requires Kavenegar key**)
- Users can create/join clans, chat in real-time
- Trade cards work end-to-end (create → track → close)
- Integrity contract enforces deny-by-default
- Leaderboard shows rankings across 6 lenses
- Badges auto-award on milestones
- Admin panel fully operational
- Basic error monitoring captures crashes
- DB backups run automatically

## Can Wait (Post-Launch)

- AI features (Phase 6) — zero code exists, pure enhancement
- Payment/subscription (Phase 7) — platform works as free MVP
- Stories system — DB model only, no API/UI
- Season results page
- Channel marketplace
- Arabic language support
- Structured logging (Pino)
- SEO (OG images, sitemap)

---

## Workstream 1: Product Core Loop

### Epic: Authentication & Profiles (P1)

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Phone OTP auth (Kavenegar) | INTEGRATED | MVP Beta | `sms.service.ts`, `send-otp/route.ts`. Needs `KAVENEGAR_API_KEY`. |
| Email + password auth | VERIFIED | MVP Beta | Auth.js v5 Credentials. E2E tested. |
| Email verification | INTEGRATED | MVP Beta | `email.ts` with console fallback. Needs SMTP config. |
| Password reset | INTEGRATED | MVP Beta | 1h expiring token. Depends on SMTP. |
| User profiles & avatars | VERIFIED | MVP Beta | Sharp → WebP. E2E tested. |
| Username system | VERIFIED | MVP Beta | Debounced availability check. Reserved list. |
| JWT sessions | VERIFIED | MVP Beta | Extended token with role, isPro, phone. |
| i18n + RTL (en/fa) | VERIFIED | MVP Beta | 31 sections, logical CSS only. |
| EA/MetaTrader auth | VERIFIED | MVP Beta | Register + login + API key. E2E tested. |
| Referral tracking | VERIFIED | Public Launch | Event tracking + admin analytics. E2E tested. |

### Epic: Statements & Verification (P2)

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Statement upload + parsing | VERIFIED | MVP Beta | Cheerio HTML parser. Metrics → JSONB. |
| Admin statement review | VERIFIED | MVP Beta | Approve/reject with notes. |
| MT account linking | VERIFIED | MVP Beta | Multiple accounts, API key per account. |
| Auto-recalculate stats | VERIFIED | MVP Beta | Monthly/seasonal/all-time aggregation. |

### Epic: Clans & Chat (P3)

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Clan CRUD + settings | VERIFIED | MVP Beta | Full CRUD. LEADER/CO_LEADER/MEMBER roles. E2E tested. |
| Real-time chat (Socket.io) | VERIFIED | MVP Beta | JWT auth, rooms, rate limiting. E2E tested. |
| Chat topics | VERIFIED | MVP Beta | Default topics, archive, sort order. E2E tested. |
| Signal & analysis cards | VERIFIED | MVP Beta | SIGNAL + ANALYSIS types. Version history. E2E tested. |
| Trade lifecycle tracking | VERIFIED | MVP Beta | Full state machine. Immutable history. E2E tested. |
| Direct messages | VERIFIED | MVP Beta | 1:1 DMs, typing, read receipts, images. E2E tested. |
| Join requests + invites | VERIFIED | MVP Beta | Invite codes with expiry. E2E tested. |
| Reactions, pinning, images | VERIFIED | MVP Beta | Emoji reactions, pin/unpin, image uploads. |

### Epic: Leaderboards & Badges (P4)

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Season management | VERIFIED | MVP Beta | UPCOMING/ACTIVE/COMPLETED/ARCHIVED. |
| Multi-lens rankings | VERIFIED | MVP Beta | 6 lenses. Configurable weights. E2E tested. |
| Badge system | VERIFIED | MVP Beta | 3 categories. Auto-eval, dry-run, recompute. E2E tested. |
| Season results page | PLANNED | Post-Launch | Final standings page not built. |

### Epic: Content & Discovery (P5)

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Channel feed & posts | VERIFIED | MVP Beta | Telegram-style. View counts. Reactions. E2E tested. |
| Auto-post from trades | VERIFIED | MVP Beta | Feature-flag gated. Tag matching. |
| Discover page + filters | VERIFIED | MVP Beta | Clans + Free Agents tabs. E2E tested. |
| Follow system | VERIFIED | MVP Beta | User/clan follows with counts. |
| Calendar + event reminders | VERIFIED | MVP Beta | EA sync, Socket.io reminders. |
| Stories system | PLANNED | Post-Launch | DB model only. No API or UI. |

### Epic: Onboarding (P8)

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Onboarding intent + missions | IMPLEMENTED | MVP Beta | Intent modal works. Missions checklist exists. |

### Epic: AI Features (P6)

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| AIRouter (failover chain) | PLANNED | Post-Launch | Zero code. OpenRouter → Ollama → Cache. |
| Spectator AI chatbot | PLANNED | Post-Launch | Not implemented. |
| Clan AI assistant | PLANNED | Post-Launch | Not implemented. |

---

## Workstream 2: Trust & Integrity

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Integrity contract (deny-by-default) | HARDENED | MVP Beta | 6 conditions, 12+ loopholes. Unit tested. |
| Admin override governance | VERIFIED | MVP Beta | Auditable via TradeEvent. API returns 422. |
| EA bridge (two-way) | VERIFIED | MVP Beta | Heartbeat, trade-event, calendar, actions. E2E tested. |
| Trade integrity evaluator | VERIFIED | MVP Beta | 60s background job. Feature-flag gated. |
| Feature flags system | VERIFIED | MVP Beta | Redis cache. 2 runtime-gated features. |

---

## Workstream 3: Platform & Operations

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Deploy scripts (US → Iran) | VERIFIED | MVP Beta | 3 scripts with auto-rollback + health checks. |
| PM2 process management | VERIFIED | MVP Beta | Auto-restart, 1GB memory limit. |
| Staging environment | VERIFIED | MVP Beta | Port 3001, Redis DB 1. |
| E2E test suite (Playwright) | VERIFIED | MVP Beta | 29 specs covering all major features. |
| PWA + offline | VERIFIED | MVP Beta | Service worker, cache strategies, offline page. |
| Rate limiting | IMPLEMENTED | MVP Beta | OTP (3/10m), chat (5/60s), EA heartbeat. Missing: other endpoints. |
| Error monitoring (GlitchTip) | PLANNED | MVP Beta | **BLOCKER** — no error tracking at all. |
| Automated DB backups | PLANNED | MVP Beta | **BLOCKER** — manual only during deploy. |
| Health check endpoint | PLANNED | MVP Beta | **BLOCKER** — no `/api/health`. |
| Security audit (OWASP) | PLANNED | MVP Beta | **BLOCKER** — no formal review. |
| Mobile responsive polish | IMPLEMENTED | MVP Beta | **BLOCKER** — partially complete. |
| CI/CD (GitHub Actions) | PLANNED | Public Launch | No workflows exist. |
| Structured logging (Pino) | PLANNED | Post-Launch | 150+ console.log calls. |
| Uptime monitoring | PLANNED | Public Launch | No external monitoring. |
| SEO | PLANNED | Public Launch | Basic metadata only. |
| Blackout resilience test | PLANNED | Public Launch | Not tested. |

---

## Workstream 4: Monetization & Growth

| Feature | Status | Milestone | Evidence |
|---------|--------|-----------|----------|
| Landing page | VERIFIED | MVP Beta | Hero, features, CTA, stats sections. |
| Referral tracking | VERIFIED | Public Launch | Event tracking. Admin analytics. E2E tested. |
| ZarinPal payment | PLANNED | Public Launch | Zero code. No SDK. |
| Subscription checkout | IMPLEMENTED | Public Launch | Plan CRUD exists. No checkout flow. |
| Paywall enforcement | IMPLEMENTED | Public Launch | `applyPaywall()` exists. **NEVER called** in routes. |
| Channel marketplace | PLANNED | Post-Launch | Not implemented. |

---

## Recommended First 10 Tasks to Reach MVP Beta

1. **Get Kavenegar API key** → set `KAVENEGAR_API_KEY` in prod .env → test real SMS
2. **Get SMTP credentials** → set `SMTP_HOST/PORT/USER/PASS` → test real email verification
3. **Create `/api/health` endpoint** → check DB + Redis + Socket.io connectivity
4. **Set up automated pg_dump** → daily cron to backup dir → test restore
5. **Install GlitchTip** → self-hosted on Iranian server → add `SENTRY_DSN` to .env
6. **Finish mobile responsive** → audit all critical flows on 375px viewport
7. **Conduct OWASP security review** → check auth, SQL injection, XSS, CSRF, rate limiting
8. **Extend rate limiting** → add to signup, login, image upload, admin actions
9. **Complete onboarding** → guided first-time experience → test with naive user
10. **Run full E2E suite on staging** → fix any failures → mark VERIFIED

---

## Implementation Log

### Files Created
- `prisma/schema.prisma` — Added `PmItem` model + enums (`PmStatus`, `PmPriority`, `PmWorkstream`, `PmMilestone`)
- `prisma/seed/pm-roadmap.seed.json` — 53 roadmap items with evidence-based status
- `src/app/api/admin/pm/route.ts` — GET all items with filters + stats
- `src/app/api/admin/pm/[itemId]/route.ts` — PATCH item (status/owner/notes/priority/lastVerifiedAt)
- `src/app/api/admin/pm/seed/route.ts` — POST to upsert seed data (idempotent)
- `src/app/(main)/admin/pm/page.tsx` — Full PM page with 4 views, filters, detail drawer
- `src/lib/validators.ts` — Added `updatePmItemSchema`, `pmItemQuerySchema`
- `src/locales/en.json` — Added 44 `admin.pm*` keys
- `src/locales/fa.json` — Added 44 matching Persian translations

### Files Modified
- `src/components/admin/AdminSidebar.tsx` — Added "Project Management" nav entry with ClipboardList icon

### How to View
1. Navigate to `/admin/pm` in the admin panel
2. Click "Seed / Sync" button to populate items from the seed JSON

### How to Seed Data
- **Via UI**: Click "Seed / Sync" button on the PM page
- **Via API**: `POST /api/admin/pm/seed` (admin auth required)
- Seeding is idempotent — structural fields update, operational fields (status, owner, notes) are preserved

### How to Update Items
- Click any item row to open the detail drawer
- Edit: status, priority, owner, notes
- Click "Mark Verified Now" to set `lastVerifiedAt` to current timestamp
- Changes are saved to the database and audited

### How to Test
```bash
npm run lint     # 0 errors expected
npm run build    # Should compile all PM routes
# Navigate to /admin/pm → click "Seed / Sync" → verify items appear
```
