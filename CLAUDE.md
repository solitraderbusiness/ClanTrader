# ClanTrader

Competitive social trading platform — clans, seasons, leaderboards, real-time chat. Next.js 16.1 / React 19 / Prisma 7 / PostgreSQL 16 / Socket.io 4.8 / Redis / TypeScript strict.

## Key Directories

- `server.ts` — Custom HTTP server wrapping Next.js + Socket.io + background intervals
- `src/services/` — All business logic (35 services); routes are thin wrappers
- `src/lib/validators.ts` — All Zod schemas; every API boundary validates with these
- `src/lib/auth.ts` — Auth.js v5 (Credentials, JWT sessions)
- `src/lib/chat-constants.ts` — Socket.io event constants — never use raw event strings
- `src/lib/socket-handlers.ts` — All Socket.io event handlers
- `src/stores/` — Zustand stores (chat, dm, locale, nav, sidebar, font, zoom, trade-panel)
- `src/locales/{en,fa}.json` — i18n translations (31 sections)
- `src/types/` — Shared types + `next-auth.d.ts` augmentation
- `scripts/` — Deploy scripts, cron jobs, backfills (excluded from TSConfig/ESLint)
- `e2e/` — Playwright tests (smoke, simulator, full suites)

## Commands

- `npm run dev` — Dev server (tsx watch + tsconfig-paths)
- `npm run build` — Production build (Turbopack)
- `npm run lint` — ESLint (next/core-web-vitals + typescript)
- `npm run type-check` — TypeScript noEmit
- `npm run test:unit` — Vitest unit tests (`src/**/__tests__/`)
- `npm run test:e2e` — Playwright full suite; `test:e2e:smoke` for quick subset
- `npm run db:push` — Schema push (dev); `db:migrate` for proper migrations
- `npm run db:generate` — Run after every schema change
- `npm run db:seed` — Seed database; `db:studio` for GUI
- **Always run `npm run lint && npm run build` before considering any task complete**

## Code Style & Conventions

### Components & Files
- Server Components by default; `"use client"` only for hooks/browser APIs/interactivity
- Components: `src/components/[feature]/PascalCase.tsx`
- Pages: `src/app/(main)/[page]/page.tsx` (authenticated) or `src/app/(auth)/[page]/page.tsx`
- Services: `src/services/kebab-case.service.ts`; Stores: `src/stores/kebab-case-store.ts`

### CSS & RTL
- **Logical CSS properties only**: `ms-`/`me-`/`ps-`/`pe-` — never `ml-`/`mr-`/`pl-`/`pr-`
- Tailwind CSS 4 (PostCSS plugin); fonts self-hosted in `src/fonts/` — never external CDNs

### i18n
- Client: `import { useTranslation } from "@/lib/i18n"` → `const { t } = useTranslation()`
- Server: `import { t } from "@/lib/i18n-core"` (no hook)
- Keys: camelCase under nested sections — `t("events.noUpcoming")`; `{{var}}` for interpolation
- **Every user-visible string must use `t()`** — add keys to both `en.json` and `fa.json`
- Persian translations: proper Farsi, not transliteration

### API Routes
- Thin handlers → delegate to service functions
- Auth: `const session = await auth(); if (!session?.user?.id) return 401`
- EA routes: Bearer token via `extractApiKey()` → `authenticateByApiKey()` (not session)
- Validate with Zod: `schema.safeParse(body)` → 400 on failure
- Errors: `{ error: message, code: "ERROR_CODE" }` with appropriate status

### Services
- Pure functions — typed args in, data out (or throw custom error class)
- DB: `import { db } from "@/lib/db"`; Redis: `import { redis } from "@/lib/redis"`

### State Management
- Zustand + `persist` for user preferences (locale, font, zoom)
- Zustand without persist for transient state (chat, sidebar)
- Socket.io events update stores directly in `socket-handlers.ts`

## Architecture

### Auth
- Primary: phone + SMS OTP via Kavenegar; Secondary: email + password (optional)
- EA/MT5: username + password (no email verification)
- JWT sessions via Auth.js v5, extended in `src/types/next-auth.d.ts`
- Dev mode: OTP codes logged to console; Redis keys: `otp:{phone}`, `otp-limit:{phone}`

### Socket.io
- Path `/api/socketio`; auth in `src/lib/socket-auth.ts` (JWT)
- Rooms: `clan:{id}`, `topic:{clanId}:{topicId}`, `dm:{sortedUserIds}`
- Client: `getSocket()` from `src/lib/socket-client.ts` (lazy singleton)

### EA (MetaTrader) Integration
- EA → Server: heartbeat, trade-event, calendar-events (Bearer auth)
- Signal flow: `ea.service.ts` → `ea-signal.service.ts` → Socket.io broadcast
- Redis locks: `ea-signal-lock:`, `ea-mod-lock:`, `ea-heartbeat:`, `calendar-sync-limit:`

### Database
- Prisma 7 with PrismaPg adapter (not default connector); singleton `db` in `src/lib/db.ts`
- Schema: `prisma/schema.prisma` (~1000 lines, 30+ models)
- Dev: `db push --accept-data-loss`; Prod: `prisma migrate dev --name descriptive_name`

## Testing

- **Unit**: Vitest — `src/services/__tests__/*.test.ts`
- **E2E**: Playwright — `e2e/` (smoke, simulator, full)
- Mocks: `vi.mock("@/lib/db")`, `vi.mock("@/lib/redis")`, `vi.mock("@/lib/socket-io-global")`
- Trade services: test both LONG/SHORT; Redis logic: test lock-acquired vs already-locked

## Infrastructure

- **Dev (US)**: `31.97.211.86`, `root`, `/root/projects/clantrader`, `clantrader.com`
- **Prod (Iran)**: `37.32.10.153`, `ubuntu`, `/home/ubuntu/clantrader`, `clantrader.ir`
- **Staging**: `/home/ubuntu/clantrader-staging` (port 3001, Redis DB 1)
- Deploy: `deploy-pack.sh` (US) → scp → `deploy-staging.sh` → `promote-to-prod.sh`
- Runtime: Node 20, PostgreSQL 16, Redis 7, PM2 6, nginx

## Gotchas

- After `npm run build`, must `pm2 restart clantrader` — stale chunks cause 500s
- `prisma migrate dev` may fail on broken migrations — use `db push` for dev instead
- Always include `t` in `useCallback`/`useEffect` deps when using `useTranslation()`
- `broadcastMessages` in `ea-signal.service.ts` must be awaited — never fire-and-forget
- `messageInclude` must include ALL fields used by `serializeMessageForSocket`
- Iranian-first: no external CDNs, fonts, or international API deps at runtime
- Never commit `.env` — reference `.env.example`

## Commit Style

- Imperative verb prefix: `Fix`, `Add`, `Update`, `Refactor`, `Remove`
- Multi-change: `Fix live R:R + weekend price persistence`
