# ClanTrader

Competitive social trading platform — clans, seasons, leaderboards, real-time chat, MetaTrader EA bridge with integrity verification. Next.js 16.1 / React 19 / Prisma 7 / PostgreSQL 16 / Socket.io 4.8 / Redis / TypeScript strict.

## Commands

- `npm run dev` — Dev server (tsx watch)
- `npm run build` — Production build
- `npm run lint` — ESLint (next/core-web-vitals + typescript)
- `npm run type-check` — TypeScript noEmit
- `npm run test:unit` — Vitest unit tests (`src/**/__tests__/`)
- `npm run test:e2e` — Playwright full suite; `test:e2e:smoke` for quick subset
- `npm run db:push` — Schema push (dev); `db:migrate` for proper migrations
- `npm run db:generate` — Run after every schema change
- **Always run `npm run test:unit && npm run lint && npm run build` before considering any task complete**
- **Every bug fix MUST include a regression test** — add to the relevant `__tests__/` file

## Product Architecture — Single Statement Page

ClanTrader uses a **single public statement page** per trader with three conceptual layers:

### 1. Official Closed Performance (public statement)
- Based on **closed, verified, signal-qualified, statement-eligible** trades only
- Metrics: win rate, avg R, total R, profit factor, best/worst R, instrument/direction distribution
- Analysis-origin trades NEVER affect official performance

### 2. Live Open Risk (overlay on same page)
- Real-time floating PnL, floating R, equity drawdown, biggest open loser, unprotected trade count
- Prevents hiding floating losses behind a clean closed record
- Computed on-demand from MT heartbeat data (`live-risk.service.ts`)

### 3. Effective Rank (conservative ranking)
- Formula: `effectiveRankR = closedOfficialR + openLossPenaltyR`
- Open profits do NOT improve rank; open losses DO penalize
- Ranking status: RANKED / PROVISIONAL (stale heartbeat) / UNRANKED (lost tracking)

### Signal Qualification
- **20-second window**: Trade must have valid SL+TP at open OR within ~20s of MT open time
- Qualified trades get a **frozen official risk snapshot** (entry, SL, TP, risk abs, risk money) — immutable
- Missed window → analysis-origin forever (journal/digest only, never statements/leaderboard)
- Origin types: `AT_OPEN` (instant) or `WITHIN_WINDOW` (late but within deadline)

### Integrity Contract (deny-by-default)
All 7 conditions must pass for `statementEligible = true`:
1. MT-linked (`mtLinked = true`)
2. Not manually unverified
3. Resolution from EA or evaluator (not manual)
4. Signal card pre-existed MT trade open
5. Initial risk snapshot captured
6. No duplicate MT ticket
7. Official signal qualified

### Multiple MT Accounts
- Users can connect multiple MT4/MT5 accounts
- All eligible trades from all accounts feed ONE public trader statement per clan
- No separate public per-account statements (private journal can filter by account)
- Each account has independent heartbeat/tracking status

### What Is NOT in MVP
- No broker history import
- No manual statement file upload (route stub exists, not implemented)
- No public per-account statements
- No analysis card effect on public performance
- Statement upload API (`/api/statements/upload`) is empty — statements auto-generate from MT data

## Rules That Cause Bugs If Ignored

### CSS & RTL — IMPORTANT
- **Logical CSS properties only**: `ms-`/`me-`/`ps-`/`pe-` — NEVER `ml-`/`mr-`/`pl-`/`pr-`
- Fonts self-hosted in `src/fonts/` — never external CDNs

### i18n — IMPORTANT
- Client: `const { t } = useTranslation()` from `@/lib/i18n`
- Server: `import { t } from "@/lib/i18n-core"`
- **Every user-visible string must use `t()`** — add keys to BOTH `en.json` and `fa.json`
- Persian translations: proper Farsi, not transliteration
- **Always include `t` in `useCallback`/`useEffect` deps** when using `useTranslation()`

### API Routes
- Auth: `const session = await auth(); if (!session?.user?.id) return 401`
- EA routes: Bearer token via `extractApiKey()` → `authenticateByApiKey()` (not session)
- Validate with Zod: `schema.safeParse(body)` → 400 on failure
- Errors: `{ error: message, code: "ERROR_CODE" }` with appropriate status

### Database
- Prisma 7 with **PrismaPg adapter** (not default connector) — cursor pagination is broken, use `createdAt`-based pagination instead
- Dev: `db push`; Prod: `prisma migrate dev --name descriptive_name`
- Never edit `prisma/migrations/` files directly (blocked by hook)

## Gotchas

- After `npm run build`, must `pm2 restart clantrader` — stale chunks cause 500s
- `broadcastMessages` in `ea-signal.service.ts` **must be awaited** — never fire-and-forget
- `messageInclude` must include ALL fields used by `serializeMessageForSocket`
- **Iranian-first**: no external CDNs, fonts, or international API deps at runtime
- Never commit `.env` — reference `.env.example`

## Key Services Map

| System | Primary Files |
|--------|--------------|
| EA Bridge | `ea.service.ts`, `ea-signal-create.service.ts`, `ea-signal-modify.service.ts`, `ea-signal-close.service.ts` |
| Signal Qualification | `signal-qualification.service.ts` (20s window, frozen snapshots) |
| Integrity | `integrity.service.ts` (7-condition deny-by-default) |
| Statement Calc | `statement-calc.service.ts` (closed official metrics) |
| MT Statements | `mt-statement.service.ts` (auto-generate from MT data) |
| Ranking | `ranking.service.ts` (6 lenses + composite) |
| Live Risk | `live-risk.service.ts` (floating PnL, drawdown, effective rank) |
| Journal | `journal.service.ts` (equity curve, calendar, streaks, breakdowns) |
| Digest | `clan-digest.service.ts` (per-member clan aggregates) |
| Trade Evaluation | `trade-evaluator.service.ts` (candle-based auto-evaluation) |
| Badges | `badge-engine.service.ts` (rank/perf/trophy badges) |
| Price Data | `price-pool.service.ts` (Redis-cached from EA heartbeat) |

## Vocabulary

Use these terms consistently — do not invent synonyms:

| Term | Meaning |
|------|---------|
| official signal-qualified trade | Trade with SL+TP within 20s, frozen snapshot, eligible for statements |
| analysis-origin trade | Trade that missed qualification window — journal/digest only |
| official closed performance | Public statement metrics from closed official trades |
| live open risk | Real-time floating PnL/R/drawdown overlay |
| effective rank | `closedOfficialR + openLossPenaltyR` — conservative ranking |
| MT account | MetaTrader 4/5 account connected via EA bridge |
| statement-eligible | Passes all 7 integrity conditions |
| frozen risk snapshot | Immutable `officialEntry/SL/TP/RiskAbs/RiskMoney` set at qualification |

## Infrastructure

- **Dev**: `31.97.211.86`, `root`, `/root/projects/clantrader`, `clantrader.com`
- **Prod/Stage (Germany)**: TBD — staging port 3001 (Redis DB 1), prod port 3000 (Redis DB 0)
- Deploy: `deploy-pack.sh` (dev) → scp → `deploy-staging.sh` → `promote-to-prod.sh`
- Services: PostgreSQL 16, Redis 7, Sentry (error tracking) + Telegram alerts, PM2

## Docs Map

Canonical docs live in `docs/`. Stale/historical docs are in `docs/archive/` with deprecation headers.

| Doc | Purpose |
|-----|---------|
| `docs/README.md` | Docs index and navigation guide |
| `docs/MVP.md` | Launch scope, timeline, feature status |
| `docs/FEATURES.md` | QA feature test checklist |
| `docs/TESTING-CHECKLIST.md` | Full QA test matrix (light/dark/mobile/desktop) |
| `docs/E2E-INTEGRITY-TEST.md` | 41 E2E test scenarios for integrity + single-statement arch |
| `docs/INTEGRITY-CONTRACT-CHECKLIST.md` | 12 integrity loopholes and their fixes |
| `docs/ANALYSIS-CARD-REPORT.md` | Analysis vs signal card system |
| `docs/BADGES.md` | Badge system spec |
| `docs/MT_LINKED_SIGNAL_ACTIONS_NOTES.md` | MT-linked trade action routing |
| `docs/PRODUCTION-PLAN.md` | Ops plan, runbooks, CI/CD |
| `docs/price-system-report.md` | Price data flow architecture |
| `docs/price-system-review-response.md` | Price system review + improvements |
| `docs/archive/*` | 12 archived docs with deprecation banners |

When docs conflict with code, **code wins** for implemented behavior. When planning future work, **latest PM decisions win** over older docs. When any doc conflicts with `SOURCE_OF_TRUTH.md`, the source of truth wins.

## Commit Style

- Imperative verb prefix: `Fix`, `Add`, `Update`, `Refactor`, `Remove`
- Multi-change: `Fix live R:R + weekend price persistence`

## Project Board — IMPORTANT

The project board (`/admin/kanban`) tracks all work. Column flow: **BACKLOG → TODO → IN_PROGRESS → TESTING → DONE**

**The user does NOT move cards — that is always my job.** Follow this workflow for every task:

1. **Start of task**: Run `/board check` to see overdue items, today's tasks, and what's in progress. If the user's request matches an existing board task, move it to IN_PROGRESS.
2. **Code complete**: Move task to TESTING. In the result/note field, write **step-by-step testing instructions** the user should follow to verify the work (what to configure, what to click, what results to expect).
3. **User confirms it works**: Move to DONE. Write a **result summary** of what was accomplished in the result field.
4. **Testing fails**: Move back to IN_PROGRESS, fix the issue, then back to TESTING with updated instructions.
5. **New work not on board**: Create a new task and follow the same flow.

## Agentic Workflow

- **Subagents** (`.claude/agents/`): `security-reviewer`, `test-writer`, `ea-debugger` — use these for isolated review, testing, and EA debugging without filling main context
- **Skills** (`.claude/skills/`): `api`, `component`, `i18n`, `test`, `deploy`, `ea-debug`, `fix-issue`, `review`, `migrate`, `board`, `project-update` — invoke with `/skill-name`
- **Hooks**: pre-commit runs eslint via lint-staged; Claude Code runs eslint after every Edit/Write
- Run `/project-update` after any material task to update `SOURCE_OF_TRUTH.md` and reconcile docs
- When compacting, always preserve the full list of modified files and any test commands that were run

## Source of Truth Maintenance — IMPORTANT

`SOURCE_OF_TRUTH.md` is the repo's documentation authority. Follow these rules:

### After Any Material Change, Update SOURCE_OF_TRUTH.md

"Material" includes:
- Feature added, removed, or significantly changed
- Rule changed (integrity, qualification, membership, auth)
- Launch scope changed (blocker added/removed/resolved)
- Infrastructure or deployment changes
- Auth changes
- Pricing / paywall / membership logic changes
- Major UX flow changes

### Task Completion Checklist

A task is not done until:
1. Code is updated
2. Tests pass (`npm run test:unit && npm run lint && npm run build`)
3. `SOURCE_OF_TRUTH.md` is updated if the change is material
4. If an older doc became misleading, its status banner is updated

If a change does NOT require updating SOURCE_OF_TRUTH.md, briefly justify that in the task summary (e.g., "CSS-only fix, no product/scope/rule change").

### Status Banners

All major docs must have a status banner at the top:
```
> Status: ACTIVE | HISTORICAL | ARCHIVED | REPLACED
> Last reviewed: YYYY-MM-DD
> Authority: SOURCE_OF_TRUTH.md
```
