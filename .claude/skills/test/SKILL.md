---
name: test
description: Write unit or integration tests for a source file. Use when adding test coverage.
argument-hint: [source-file-path]
---

Write tests for `$ARGUMENTS`:

**1. Determine test type and location:**
- Services (`src/services/*.ts`) → `src/services/__tests__/<name>.test.ts`
- Lib utilities (`src/lib/*.ts`) → `src/lib/__tests__/<name>.test.ts`
- API routes → Integration test mocking DB/Redis
- Components → Skip (use E2E via Playwright instead)

**2. Follow existing test patterns:**
- Read existing tests in `src/services/__tests__/` and `src/lib/__tests__/` for patterns
- Use Vitest: `import { describe, it, expect, vi, beforeEach } from "vitest"`

**3. Mock external dependencies:**
```typescript
vi.mock("@/lib/db", () => ({
  db: { model: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() } },
}));
vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn(), set: vi.fn(), exists: vi.fn(), del: vi.fn() },
}));
vi.mock("@/lib/socket-io-global", () => ({
  getIO: vi.fn(() => ({ to: vi.fn(() => ({ emit: vi.fn() })), emit: vi.fn() })),
}));
```

**4. Coverage targets:**
- Happy path for every exported function
- Edge cases: null/undefined inputs, empty arrays, boundary values
- Error handling: invalid inputs, DB errors, auth failures
- For trade services: test both LONG and SHORT directions
- For Redis-based logic: test lock acquired vs already locked

**5. Run and verify:**
- `npm run test:unit` — all tests must pass
- Report coverage for the tested file
