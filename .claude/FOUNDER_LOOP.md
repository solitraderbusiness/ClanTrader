# Founder Loop — ClanTrader

This is your personal workflow memory. When confused, read this file or run `/my-rules`.

## My Commands

### /my-rules [context]
When you forgot the workflow or need help choosing the right command.
Pass optional context like `/my-rules I want to start a task` for targeted guidance.

### /task-start <task-name>
When you start or reopen a serious task.
Claude rebuilds working context, creates/refreshes task brief and test plan.
Output: `docs/tasks/<task-name>.md` and optionally `docs/testing/<task-name>-test-plan.md`.

### /task-update [task-name]
While a task is in progress — when decisions, edge cases, or scenarios changed.
Claude updates the task brief, test plan, and appends to `docs/DECISION_LOG.md`.

### /project-update [context]
When the task is finished.
Claude inspects changes, updates `SOURCE_OF_TRUTH.md`, `SITE_RULES_AUDIT_REPORT.md`, task docs, and doc banners if needed.

### /weekly-pm
Once a week. PM cleanup pass.
Claude finds stale briefs, missing decisions, source-of-truth drift, and suggests cleanup actions.

## When I Feel Confused

Tell Claude:
> Read `.claude/FOUNDER_LOOP.md`, `SOURCE_OF_TRUTH.md`, `SITE_RULES_AUDIT_REPORT.md`, the current task brief, test plan, and `docs/DECISION_LOG.md`. Summarize what matters.

Or just run `/my-rules I feel lost`.

## File Map

| File | Purpose |
|------|---------|
| `.claude/FOUNDER_LOOP.md` | This file. Workflow memory. |
| `SOURCE_OF_TRUTH.md` | Project truth authority. Updated after finished tasks. |
| `SITE_RULES_AUDIT_REPORT.md` | Evidence-backed rules audit. Updated when rules change. |
| `docs/DECISION_LOG.md` | Running log of in-progress decisions. |
| `docs/tasks/<name>.md` | Per-task brief with goal, decisions, edge cases, done definition. |
| `docs/testing/<name>-test-plan.md` | Per-task test plan with scenarios and expected results. |

## Rule

Do not rely on memory alone for serious tasks. Write it down or lose it.
