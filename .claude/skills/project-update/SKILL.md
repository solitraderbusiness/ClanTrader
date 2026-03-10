---
name: project-update
description: Update ClanTrader documentation truth after completed work, and optionally run a deep rules audit
disable-model-invocation: true
---

You are running the `project-update` skill for the ClanTrader repository.

Your job is to keep the repo documentation aligned with the real current state of the product, rules, infrastructure, and launch scope.

==================================================
PRIMARY AUTHORITY
==================================================

`SOURCE_OF_TRUTH.md` is the documentation authority for this repository.

If any other markdown file conflicts with `SOURCE_OF_TRUTH.md`, prefer `SOURCE_OF_TRUTH.md` unless the actual codebase clearly proves that `SOURCE_OF_TRUTH.md` is stale and must be corrected.

==================================================
COMMAND MODES
==================================================

This skill supports 2 modes:

### 1) Normal mode
Default behavior when I run:

`/project-update`
or
`/project-update <short context>`

Use this after finishing a task.

Goal:
- inspect what changed
- decide whether project truth changed
- update docs if needed
- keep `SOURCE_OF_TRUTH.md` current

### 2) Deep audit mode
If my arguments include any of these terms:
- `full-audit`
- `rules-audit`
- `deep-audit`
- `truth-audit`

then run a deeper documentation audit.

Goal:
- inspect the real site rules from code and relevant docs
- create or refresh `SITE_RULES_AUDIT_REPORT.md`
- then improve `SOURCE_OF_TRUTH.md` from that verified audit
- update misleading old doc banners if needed

==================================================
GENERAL PRINCIPLES
==================================================

- Do NOT invent rules.
- Do NOT assume old docs are correct.
- Prefer actual code, schema, migrations, configs, routes, services, and current behavior over stale markdown.
- Separate:
  - implemented behavior
  - intended behavior
  - planned work
  - deferred work
  - unknown / needs verification
- Be explicit about certainty:
  - VERIFIED IN CODE
  - VERIFIED IN CONFIG / SCHEMA
  - INFERRED FROM DOCS
  - NEEDS VERIFICATION
- Do not hide uncertainty behind vague wording.

==================================================
NORMAL MODE WORKFLOW
==================================================

When running in normal mode, do all of the following:

1. Inspect the current work session
   - review changed files
   - review new files
   - review deleted files
   - review migrations, configs, routes, services, UI flow changes, and docs touched by the task
   - review my command arguments if provided for extra context

2. Decide whether the completed task changed project truth

A change is material by default if it affects any of these:
- feature added, removed, or materially changed
- auth / onboarding / access behavior
- clan creation / join / switch / leave / delete / ownership / permissions
- chat / DM / moderation / visibility rules
- trade card / journal / statement / leaderboard / badge behavior
- EA bridge / sync / integrity / freshness / closing / snapshot behavior
- admin panel / review queues / moderation tools
- launch scope
- MVP vs post-MVP boundary
- blockers added, removed, or downgraded
- infra / deploy / backups / PM2 / health endpoint / monitoring / error tracking
- testing rules or release criteria
- monetization / access / pricing / entitlement logic
- any decision that changes user value in money, time, risk, or status

3. Update `SOURCE_OF_TRUTH.md` if needed

Maintain these sections as current:
- Executive Snapshot
- Active Product Truth
- Active Operational Truth
- Active Business / Scope Decisions
- Launch Blockers
- Known Contradictions Resolved
- Document Registry
- Change Log
- Core Platform Rules
- Open Verification Queue

4. Update old doc status banners if needed

At minimum inspect when relevant:
- `CLAUDE.md`
- `MVP.md`
- `PM-ROADMAP.md`
- `PLATFORM_REPORT.md`
- `PRODUCTION-PLAN.md`
- `TESTING-CHECKLIST.md`

Use one of:
- ACTIVE
- HISTORICAL
- ARCHIVED
- REPLACED

Banner format:

> Status: HISTORICAL
> Last reviewed: YYYY-MM-DD
> Authority: SOURCE_OF_TRUTH.md
> Notes: This file contains useful context but may not reflect the latest project truth.

5. Append a dated change-log entry to `SOURCE_OF_TRUTH.md` if you updated it

Newest first.

Each entry must include:
- date in ISO format: YYYY-MM-DD
- what changed
- why
- affected files
- verification level:
  - verified in code
  - inferred from project docs
  - needs verification

==================================================
DEEP AUDIT MODE WORKFLOW
==================================================

When my arguments include `full-audit`, `rules-audit`, `deep-audit`, or `truth-audit`, do all of the following:

### Step A — perform a real rules audit
Create or refresh:

`SITE_RULES_AUDIT_REPORT.md`

This report must be evidence-backed and should audit the current real site rules from code and supporting documentation.

Use this structure:

# ClanTrader — Site Rules Audit Report

## 0. Audit Contract
Explain:
- this is a current-state rules audit
- it is evidence-backed
- it is an input into `SOURCE_OF_TRUTH.md`
- if something cannot be verified, it must be marked clearly

## 1. Audit Method
List:
- files/folders/configs/migrations/routes/services/docs inspected
- how rules were verified
- what could not be fully verified

## 2. Rule Domains Covered
Cover at minimum:

### A. Auth & Access Rules
### B. Onboarding Rules
### C. Clan Rules
### D. Social / Chat / DM Rules
### E. Trade Journal / Trade Card / Statement Rules
### F. EA Bridge / Sync / Integrity Rules
### G. Leaderboard / Badge / Reputation Rules
### H. Admin / Moderation Rules
### I. Notifications / Digest / Reminder Rules
### J. Monetization / Access Tier Rules
### K. Infrastructure / Operational Rules
### L. Security / Data Handling Rules
### M. Product Scope Rules

Inside each domain, use a table:

| Rule ID | Rule Statement | Status | Verification Level | Source Files / Evidence | Notes |
|---|---|---|---|---|---|

Where:
- Status = ACTIVE / PARTIAL / DEFERRED / UNKNOWN
- Verification Level = VERIFIED IN CODE / VERIFIED IN CONFIG / INFERRED FROM DOCS / NEEDS VERIFICATION

## 3. Hidden / Edge-Case Rules
Capture easy-to-miss rules and edge cases.

## 4. Contradictions Found
List:
- old claim
- actual current truth
- evidence
- action needed

## 5. Rules Missing From SOURCE_OF_TRUTH.md
Explicitly list important rules currently absent from the authority file.

## 6. Needs Verification Queue
Create a clean list of items not fully provable from code.

### Step B — upgrade `SOURCE_OF_TRUTH.md`
After the audit report is created/refreshed, update `SOURCE_OF_TRUTH.md` so it becomes more precise and complete without becoming unreadable.

Make sure it includes:
- clear high-level truth
- core platform rules by domain
- operational truth with stronger precision
- contradiction resolution
- open verification queue
- corrected ambiguous status language
- exact or date-stamped summary counts where relevant

### Step C — update old doc banners
If the deep audit proves older docs are misleading, update their status banners.

### Step D — strengthen `CLAUDE.md` if needed
If repo instructions are missing enforcement, add or refine a lightweight rule so that after any material project change Claude must check whether `SOURCE_OF_TRUTH.md` needs updating.

==================================================
HOW TO DECIDE WHAT NOT TO UPDATE
==================================================

If the completed task was only:
- internal refactoring
- code cleanup
- comment cleanup
- type cleanup
- non-behavioral file moves
- implementation detail changes with no user-facing, rule, infra, or scope impact

then usually do NOT update `SOURCE_OF_TRUTH.md`.

But if you decide no documentation update is needed, you must explicitly say:
- what changed
- why it does not affect project truth
- why `SOURCE_OF_TRUTH.md` was left untouched

==================================================
STYLE REQUIREMENTS
==================================================

- Be blunt, precise, and evidence-driven.
- Do not write marketing fluff.
- Do not confuse “implemented” with “verified”.
- Do not confuse “verified in code” with “deployed”.
- If something is uncertain, label it `NEEDS VERIFICATION`.
- Preserve readability.
- Do not turn `SOURCE_OF_TRUTH.md` into a giant dump. Keep deep details in `SITE_RULES_AUDIT_REPORT.md`.

==================================================
OUTPUT FORMAT
==================================================

After finishing, respond with:

### Project update result
- Mode: normal / deep audit
- Source-of-truth updated: yes/no
- Audit report updated: yes/no
- Other docs updated: list
- Main truth changes: short bullets
- Contradictions resolved: short bullets
- Items left as-is: short bullets
- Needs verification: short bullets

==================================================
DISCIPLINE
==================================================

Do not merely summarize the task.
Actually update the documentation files when needed.

Task completion is not complete until:
- relevant code/doc review is done
- `SOURCE_OF_TRUTH.md` is updated if required
- `SITE_RULES_AUDIT_REPORT.md` is updated if deep-audit mode was requested
- the final report clearly states what changed and what did not
