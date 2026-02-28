# ClanTrader - Claude Code Rules

## Project Overview
ClanTrader is a competitive social trading platform where verified traders form clans, compete in seasons, and share content. Iranian-first architecture: every feature must work without international APIs at runtime.

## Critical Rules
- Never deploy untested code to production
- Always validate inputs with Zod at API boundaries
- Always use Prisma for database access (no raw SQL unless needed for performance)
- Iranian-first: every feature must work without international APIs at runtime
- Run `npm run lint` and `npm run build` before considering any task complete
- Never commit .env files or secrets to git
- Use App Router patterns (not Pages Router)
- Use Server Components by default, Client Components only when needed (interactivity, hooks, browser APIs)
- Multilingual support: Persian (fa), English (en), Arabic (ar) — RTL support required
- Use logical CSS properties (ms/me/ps/pe) not physical (ml/mr/pl/pr) in new code
- All fonts are self-hosted in `src/fonts/` — never use external font CDNs

## Tech Stack
- Next.js 16.1 (App Router, TypeScript, Tailwind CSS 4)
- React 19
- shadcn/ui + Radix UI components
- Prisma ORM 7 + PostgreSQL 16
- Auth.js v5 (next-auth@beta) with Credentials provider, JWT sessions
- Redis (ioredis) for caching and Socket.io rate limiting
- Socket.io 4.8 for real-time chat (custom server in `server.ts`)
- Zod 4 for validation
- React Hook Form for forms
- Zustand for client state
- sharp for image processing
- Nodemailer for transactional emails
- Playwright for E2E testing
- PWA with custom service worker for offline support

## File Conventions
- API routes: `src/app/api/[resource]/route.ts`
- Pages: `src/app/(main)/[page]/page.tsx` (authenticated) or `src/app/(auth)/[page]/page.tsx`
- Components: `src/components/[feature]/[ComponentName].tsx`
- Services: `src/services/[name].service.ts`
- Lib utilities: `src/lib/[name].ts`
- Zustand stores: `src/stores/[name]-store.ts`
- Type definitions: `src/types/[name].ts`
- Self-hosted fonts: `src/fonts/`
- E2E tests: `e2e/`
- Custom Socket.io server: `server.ts` (wraps Next.js HTTP server)

## Database
- Schema: `prisma/schema.prisma` (26 models)
- Always run `npx prisma generate` after schema changes
- Always run `npx prisma migrate dev --name descriptive_name` for migrations
- Seed data: `npx tsx prisma/seed.ts`

## Socket.io
- Custom server in `server.ts` handles Socket.io alongside Next.js
- Auth middleware in `src/lib/socket-auth.ts` (JWT-based)
- All event handlers in `src/lib/socket-handlers.ts`
- Client connection in `src/lib/socket-client.ts`
- Event constants in `src/lib/chat-constants.ts`

## Infrastructure & Deployment

### Servers
- **Dev VPS (US)**: `31.97.211.86` (Hostinger, Phoenix) — user `root`, project at `/root/projects/clantrader`
- **Production VPS (Iran)**: `37.32.10.153` — user `ubuntu`, project at `/home/ubuntu/clantrader`
- **Domains**: `clantrader.com` (dev, US), `clantrader.ir` (production, Iran)

### Auth: Phone-First (Kavenegar SMS OTP)
- Primary identity: phone number with SMS OTP via Kavenegar (works over cellular during blackouts)
- Secondary (optional): email + password, added from settings
- Existing email-only users redirected to `/add-phone` to add phone
- Redis keys: `otp:{phone}`, `otp-limit:{phone}`, `login-token:{token}`, `signup-token:{token}`, `phone-verify-token:{token}`
- Dev mode: OTP codes logged to console (no KAVENEGAR_API_KEY needed)
- Env vars needed for production: `KAVENEGAR_API_KEY`, `KAVENEGAR_OTP_TEMPLATE`

### Staging + Production (Iran VPS)
- **Staging**: `/home/ubuntu/clantrader-staging` (port 3001, `staging.clantrader.ir`, DB: `clantrader_staging`, Redis DB 1)
- **Production**: `/home/ubuntu/clantrader` (port 3000, `clantrader.ir`, DB: `clantrader_prod`, Redis DB 0)

### Deployment Pipeline
- Build on US VPS, transfer pre-built tarball to Iran VPS (no npm install needed on Iran)
- Scripts in `scripts/`:
  - `setup-iran-vps.sh` — one-time Iran VPS setup (Node, PostgreSQL, Redis, nginx, PM2) with dual staging+production
  - `deploy-pack.sh` — builds app + creates `deploy.tar.gz` on US VPS
  - `deploy-staging.sh` — extracts tarball to staging, runs health check
  - `promote-to-prod.sh` — syncs staging to production with backup + auto-rollback
  - `deploy-unpack.sh` — (legacy) direct deploy to production
- Deploy flow: `deploy-pack.sh` (US) → scp to laptop → scp to Iran VPS → `deploy-staging.sh` → test → `promote-to-prod.sh`
- Blackout flow: same, but switch internet (Starlink for US VPS, Iranian ISP for Iran VPS)

### Claude Code on Iran VPS
- SSH tunnel: `ssh -D 1080 -N -f root@31.97.211.86` then `ALL_PROXY=socks5://127.0.0.1:1080 claude`
- Iran VPS Claude Code reads `CLAUDE.md` in staging dir (from `CLAUDE.iran.md`)
- Restrictions: no npm/git/build, staging-only edits, never touch production

### Runtime versions (match on both servers)
- Node 20, npm 10, PostgreSQL 16, Redis 7, nginx, PM2 6

## Current Progress (as of Feb 2026)
- Phase 1 (Auth & Profiles): COMPLETE
- Phase 2 (Statements & Verification): COMPLETE
- Phase 3 (Clans & Chat): COMPLETE
- Phase 4 (Leaderboards & Seasons): COMPLETE
- Phase 5 (Content & Channels): COMPLETE
- Phase 6 (AI / AIRouter): NOT STARTED
- Phase 7 (Payments / ZarinPal): NOT STARTED
- Phase 8 (Polish & Launch): IN PROGRESS (PWA, mobile responsive, testing infra done)
