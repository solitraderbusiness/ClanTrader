---
name: api
description: Scaffold a new API route following ClanTrader conventions. Use when creating or modifying API routes.
argument-hint: [resource-path] [methods]
---

Create API route at `src/app/api/$0/route.ts` with methods: $1

Follow these ClanTrader API conventions:

**Authentication:**
- Authenticated routes: `import { auth } from "@/lib/auth"` then `const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`
- EA routes: Bearer token via `authenticateByApiKey()` from `src/services/ea.service.ts`

**Validation:**
- Add Zod schemas to `src/lib/validators.ts`
- Parse with `schema.safeParse(body)`, return first issue on failure

**Service layer:**
- Business logic goes in `src/services/*.service.ts`, NOT in the route handler
- Use Prisma via `import { db } from "@/lib/db"` — never raw SQL

**Error format:**
- Always `{ error: string }` with appropriate HTTP status codes
- Wrap handler in try/catch, log with `console.error("[route-name]", error)`

**Response format:**
- GET list: `{ items: T[] }` or `{ resource: T[] }`
- GET single: `{ resource: T }`
- POST/PUT: `{ ok: true, ...data }`

After creating the route:
1. Add Zod schemas to `src/lib/validators.ts` with exported types
2. Create/update the relevant service file in `src/services/`
3. Run `npm run lint` to verify
