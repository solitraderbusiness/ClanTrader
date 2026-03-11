---
name: weekly-pm
description: Weekly PM cleanup pass — find stale docs, missing decisions, source-of-truth drift
disable-model-invocation: true
---

You are running the `weekly-pm` skill for ClanTrader.

Your job is to do a weekly PM health check and identify cleanup actions.

## Workflow

### Step 1 — Inspect everything

Read these files:

1. `.claude/FOUNDER_LOOP.md`
2. `SOURCE_OF_TRUTH.md`
3. `SITE_RULES_AUDIT_REPORT.md`
4. `docs/DECISION_LOG.md`
5. All files in `docs/tasks/`
6. All files in `docs/testing/`
7. `CLAUDE.md`
8. Recent git log (last 1-2 weeks of commits)
9. Active docs in `docs/` if relevant

### Step 2 — Identify issues

Check for:

**Stale task briefs:**
- Task briefs with status IN_PROGRESS but no recent git activity
- Task briefs that reference outdated rules or deleted files
- Task briefs with unresolved open questions that are now answerable

**Stale test plans:**
- Test plans that reference changed behavior
- Test plans with "Not yet tested" items that have since been implemented
- Test plans for tasks already marked DONE

**Missing decision capture:**
- Recent commits that changed product rules but have no DECISION_LOG entry
- Changes to integrity, qualification, ranking, or statement logic without documentation
- Feature flag changes without documentation

**Source-of-truth drift:**
- `SOURCE_OF_TRUTH.md` claims that conflict with current code
- New features implemented but not listed in source-of-truth
- Resolved blockers still listed as open
- Changed rules not reflected in the audit report

**General hygiene:**
- Orphaned docs (referenced nowhere, no longer relevant)
- Contradictions between docs
- Missing status banners on active docs

### Step 3 — Optionally fix small issues

You may update:
- Task briefs — mark stale ones with updated status
- Test plans — add notes about changed behavior
- Decision log — capture obviously missing decisions

You should NOT casually rewrite:
- `SOURCE_OF_TRUTH.md` — only if clear, verifiable drift exists
- `SITE_RULES_AUDIT_REPORT.md` — only if rules clearly changed

### Step 4 — Report

Output this format:

```markdown
### Weekly PM Result — YYYY-MM-DD

#### Stale task briefs
- list or "None found"

#### Stale test plans
- list or "None found"

#### Missing decision captures
- list or "None found"

#### Source-of-truth drift
- list or "No drift detected"

#### Top PM cleanup actions
1. Most important action
2. Second priority
3. Third priority

#### Files updated this pass
- list or "None"

#### Notes
- Any other observations
```

## Rules

- Be blunt about what's stale or drifted
- Do not invent product behavior
- Prefer code truth over doc prose
- Keep the report actionable, not verbose
- This is a health check, not a rewrite session
- If SOURCE_OF_TRUTH.md needs a real update, say so clearly but prefer to leave it for `/project-update` unless the fix is trivial and certain
