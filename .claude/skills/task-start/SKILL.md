---
name: task-start
description: Rebuild working context for a task — create or refresh task brief and test plan
disable-model-invocation: true
---

You are running the `task-start` skill for ClanTrader.

Your job is to rebuild working context when the founder starts or reopens a serious task.

## Required argument

The user must provide a task name as argument. If not provided, ask for one.

The task name becomes the slug used for file paths:
- `docs/tasks/<task-name>.md`
- `docs/testing/<task-name>-test-plan.md`

## Workflow

### Phase 1 — Gather context

Read these files (in priority order):

1. `.claude/FOUNDER_LOOP.md` — workflow rules
2. `SOURCE_OF_TRUTH.md` — project truth authority
3. `SITE_RULES_AUDIT_REPORT.md` — evidence-backed rules
4. `docs/DECISION_LOG.md` — recent decisions
5. `docs/tasks/<task-name>.md` — existing task brief (if any)
6. `docs/testing/<task-name>-test-plan.md` — existing test plan (if any)

Then inspect relevant repo files:
- Prisma schema, services, routes, components, types, configs
- Use the user's arguments and task name to determine what's relevant
- Prefer code truth over stale docs

### Phase 2 — Create or refresh task brief

Write or update `docs/tasks/<task-name>.md` with this structure:

```markdown
# Task Brief — <Task Name>

> Started: YYYY-MM-DD
> Status: IN_PROGRESS / PAUSED / DONE

## 1. Goal
What this task accomplishes.

## 2. Why it exists
Business/product motivation.

## 3. Current decisions
Key decisions made so far. Reference DECISION_LOG if applicable.

## 4. Rules touched
Which product rules, integrity conditions, or platform behaviors are affected.

## 5. Files / systems involved
Key files, services, routes, models, components.

## 6. Edge cases
Known edge cases and how they should be handled.

## 7. Manual test scenarios
Quick list of things to verify manually.

## 8. Done definition
What "done" means for this task.

## 9. Open questions
Unresolved items that need answers.

## 10. Change notes
Log of updates to this brief (date + what changed).
```

### Phase 3 — Create or refresh test plan (if appropriate)

If the task involves user-facing behavior, API changes, or rule changes, write or update `docs/testing/<task-name>-test-plan.md`:

```markdown
# Test Plan — <Task Name>

> Last updated: YYYY-MM-DD

## Scope
What this test plan covers.

## Preconditions
What must be true before testing.

## Site scenarios
Browser/UI test cases.

## MetaTrader scenarios
EA/bridge test cases (if applicable).

## Edge-case scenarios
Unusual conditions to test.

## Expected results
What success looks like for each scenario.

## Not yet tested
Items deferred or not yet covered.
```

Skip the test plan if the task is purely internal (refactoring, docs, config).

### Phase 4 — Report

Summarize:
- What context was gathered
- What files were created or updated
- Key decisions and open questions
- Suggested next steps

## Rules

- Prefer `SOURCE_OF_TRUTH.md` over stale docs
- Prefer code over prose when they conflict
- Do NOT update `SOURCE_OF_TRUTH.md` — that's for `/project-update`
- Do NOT make product decisions — surface open questions instead
- Keep briefs practical, not fluffy
- If refreshing an existing brief, preserve prior decisions and add new context
