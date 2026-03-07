# ClanTrader

Competitive social trading platform — clans, seasons, leaderboards, real-time chat. Next.js 16.1 / React 19 / Prisma 7 / PostgreSQL 16 / Socket.io 4.8 / Redis / TypeScript strict.

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

## Infrastructure

- **Dev**: `31.97.211.86`, `root`, `/root/projects/clantrader`, `clantrader.com`
- **Prod/Stage (Germany)**: TBD — staging port 3001 (Redis DB 1), prod port 3000 (Redis DB 0)
- Deploy: `deploy-pack.sh` (dev) → scp → `deploy-staging.sh` → `promote-to-prod.sh`

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
- **Skills** (`.claude/skills/`): `api`, `component`, `i18n`, `test`, `deploy`, `ea-debug`, `fix-issue`, `review`, `migrate`, `board` — invoke with `/skill-name`
- **Hooks**: pre-commit runs eslint via lint-staged; Claude Code runs eslint after every Edit/Write
- When compacting, always preserve the full list of modified files and any test commands that were run
