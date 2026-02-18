# ClanTrader - Claude Code Rules

## Project Overview
ClanTrader is a competitive social trading platform. Iranian-first architecture: every feature must work without international APIs.

## Critical Rules
- Never deploy untested code to production
- Always validate inputs with Zod at API boundaries
- Always use Prisma for database access (no raw SQL unless needed for performance)
- Iranian-first: every feature must work without international APIs at runtime
- Run `npm run lint` and `npm run build` before considering any task complete
- Never commit .env files or secrets to git
- Use App Router patterns (not Pages Router)
- Use Server Components by default, Client Components only when needed (interactivity, hooks, browser APIs)

## Tech Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS)
- shadcn/ui components
- Prisma ORM + PostgreSQL 16
- Auth.js v5 (next-auth@beta) with Credentials provider, JWT sessions
- Redis (ioredis) for caching
- Socket.io for real-time chat (Phase 3)
- Zod for validation
- React Hook Form for forms
- Zustand for client state
- sharp for image processing

## File Conventions
- API routes: `src/app/api/[resource]/route.ts`
- Pages: `src/app/(main)/[page]/page.tsx` (authenticated) or `src/app/(auth)/[page]/page.tsx`
- Components: `src/components/[feature]/[ComponentName].tsx`
- Services: `src/services/[name].service.ts`
- Lib utilities: `src/lib/[name].ts`

## Database
- Always run `npx prisma generate` after schema changes
- Always run `npx prisma migrate dev --name descriptive_name` for migrations
- Seed data: `npx tsx prisma/seed.ts`
