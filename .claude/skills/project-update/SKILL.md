---
name: project-update
description: Update ClanTrader source-of-truth documentation after a completed task
disable-model-invocation: true
---

You are running the `project-update` skill for the ClanTrader repository.

Your job is to update the project documentation after a task has been completed, so the repo always has one reliable and current source of truth.

## Main rule

`SOURCE_OF_TRUTH.md` is the documentation authority for this repo.

If any other markdown file conflicts with `SOURCE_OF_TRUTH.md`, prefer `SOURCE_OF_TRUTH.md` unless the current codebase clearly proves that the source-of-truth file is stale and needs correction.

## What this command does

When I run `/project-update`, you must:

1. Inspect what changed in the current work session.
2. Review any relevant edited files, new files, deleted files, migrations, routes, UI flows, rules, infra config, and docs.
3. Determine whether the change is material enough to affect project truth.
4. Update `SOURCE_OF_TRUTH.md` if needed.
5. Update status banners in old docs if they became misleading.
6. Append a dated entry to the change log in `SOURCE_OF_TRUTH.md`.
7. Give me a concise summary of what was updated and what was intentionally not updated.

## Material changes that REQUIRE documentation update

Treat these as material by default:

- feature added, removed, or materially changed
- auth / onboarding / membership logic changes
- clan rules, switching, leaving, deleting, or permissions changes
- chat / DM / social behavior changes
- trade card / journal / statement / leaderboard / badge logic changes
- EA bridge / sync / integrity / freshness / closing / snapshot logic changes
- admin panel or moderation changes
- launch scope changes
- MVP vs post-MVP boundary changes
- blocker added, removed, or downgraded
- infra / deploy / backups / PM2 / health endpoint / monitoring / error tracking changes
- testing rules or release criteria changes
- monetization / access / paywall / pricing logic changes
- any decision that changes user value in money, time, risk, or status

## What to read before editing docs

At minimum, inspect these if relevant:

- `SOURCE_OF_TRUTH.md`
- `CLAUDE.md`
- `MVP.md`
- `PM-ROADMAP.md`
- `PLATFORM_REPORT.md`
- `PRODUCTION-PLAN.md`
- `TESTING-CHECKLIST.md`

Also inspect the actual changed source files, configs, migrations, and routes from the task that was just completed.

## How to decide what to update

### If the completed task changed reality
Update `SOURCE_OF_TRUTH.md`.

### If the completed task only added internal refactoring
Usually do not update project truth, unless it changed:
- behavior
- rules
- launch readiness
- testing requirements
- operational risk

### If an older doc is now misleading
Do not rewrite its full history unless necessary.
Instead:
- keep useful history
- add or revise a status banner at the top
- make clear that `SOURCE_OF_TRUTH.md` is authoritative

## Required sections to maintain inside SOURCE_OF_TRUTH.md

Make sure these stay current:

- Executive Snapshot
- Active Product Truth
- Active Operational Truth
- Active Business / Scope Decisions
- Launch Blockers
- Known Contradictions Resolved
- Document Registry
- Change Log

## Change log rules

When you update `SOURCE_OF_TRUTH.md`, append a new change-log entry with:

- date in ISO format: YYYY-MM-DD
- what changed
- why
- affected files
- verification level:
  - verified in code
  - inferred from project docs
  - needs verification

Newest entries should appear first.

## Status banner format for older docs

Use this exact style at the top when needed:

> Status: HISTORICAL
> Last reviewed: YYYY-MM-DD
> Authority: SOURCE_OF_TRUTH.md
> Notes: This file contains useful context but may not reflect the latest project truth.

Use one of:
- ACTIVE
- HISTORICAL
- ARCHIVED
- REPLACED

## Output format after running this command

After finishing, respond with:

### Project update result
- Source-of-truth updated: yes/no
- Other docs updated: list
- Main truth changes: short bullets
- Items left as-is: short bullets
- Needs verification: short bullets

## Important discipline

Do not just summarize the task.
Actually update the documentation files when needed.

If no documentation update is needed, explicitly say why:
- what changed
- why it does not affect project truth
- why `SOURCE_OF_TRUTH.md` was left untouched
