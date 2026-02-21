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

## Current Progress (as of Feb 2026)
- Phase 1 (Auth & Profiles): COMPLETE
- Phase 2 (Statements & Verification): COMPLETE
- Phase 3 (Clans & Chat): COMPLETE
- Phase 4 (Leaderboards & Seasons): COMPLETE
- Phase 5 (Content & Channels): COMPLETE
- Phase 6 (AI / AIRouter): NOT STARTED
- Phase 7 (Payments / ZarinPal): NOT STARTED
- Phase 8 (Polish & Launch): IN PROGRESS (PWA, mobile responsive, testing infra done)
