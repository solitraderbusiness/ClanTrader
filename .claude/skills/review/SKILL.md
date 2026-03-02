---
name: review
description: Review code for bugs, security issues, and ClanTrader convention violations
disable-model-invocation: true
argument-hint: [file-or-directory]
context: fork
agent: Explore
---

Review `$ARGUMENTS` for issues across these categories:

**1. Security**
- Missing auth checks (session or Bearer token)
- Missing Zod validation at API boundaries
- SQL injection (raw queries without parameterization)
- XSS (unsanitized user input in JSX)
- Exposed secrets or .env values in client code

**2. Bugs**
- Race conditions in Socket.io handlers or Redis lock patterns
- Null/undefined access on optional fields
- Redis key collisions (check key naming: `ea-mod-lock:`, `ea-signal-lock:`, etc.)
- Fire-and-forget promises that swallow errors (`.catch(() => {})`)
- Prisma `select` missing fields that are accessed later via unsafe casts

**3. ClanTrader Conventions**
- Physical CSS properties (`ml-`, `mr-`, `pl-`, `pr-`) instead of logical (`ms-`, `me-`, `ps-`, `pe-`)
- Hardcoded strings instead of i18n `t()` calls
- Missing Persian translations in `fa.json`
- Client Components without `"use client"` directive
- Raw SQL instead of Prisma
- Business logic in route handlers instead of service layer

**4. Performance**
- N+1 queries (Prisma `findMany` in a loop without `include`)
- Missing database indexes for frequent query patterns
- Unnecessary re-renders (missing `useMemo`/`useCallback` for expensive computations)
- Missing Redis caching for repeated expensive queries

**5. Iranian-First**
- Features that depend on international APIs at runtime without fallback
- External CDN dependencies (fonts, scripts)

For each issue found:
- State the file and line number
- Explain the problem concisely
- Suggest a specific fix
- Rate severity: CRITICAL / WARNING / INFO
