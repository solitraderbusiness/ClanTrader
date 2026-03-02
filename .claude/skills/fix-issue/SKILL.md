---
name: fix-issue
description: Investigate and fix a GitHub issue by number
disable-model-invocation: true
argument-hint: [issue-number]
allowed-tools: Bash(gh *), Read, Grep, Glob, Edit, Write, Bash(npm run lint), Bash(npm run build)
---

Fix GitHub issue #$ARGUMENTS:

1. Read the issue: `gh issue view $ARGUMENTS`
2. Read any linked comments: `gh issue view $ARGUMENTS --comments`
3. Investigate the codebase to understand root cause
4. Implement the fix following ClanTrader conventions:
   - Validate inputs with Zod at API boundaries
   - Use Prisma for DB access (never raw SQL unless performance-critical)
   - Logical CSS properties (ms/me/ps/pe, NOT ml/mr/pl/pr)
   - i18n: add strings to both en.json and fa.json
   - Server Components by default, Client Components only when needed
5. Run `npm run lint` — must have 0 errors
6. Run `npm run build` — must compile cleanly
7. Summarize what was changed, which files were modified, and why
