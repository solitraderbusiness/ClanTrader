---
name: task-update
description: Update task memory mid-progress — capture decisions, edge cases, and test scenario changes
disable-model-invocation: true
---

You are running the `task-update` skill for ClanTrader.

Your job is to update task memory while the founder is working on a task.

## Arguments

Optional task name. If not provided, infer from:
- Recent git changes
- Recently modified task briefs in `docs/tasks/`
- Ask the user if unclear

## Workflow

### Step 1 — Read current state

Read:
1. `docs/tasks/<task-name>.md` — current brief
2. `docs/testing/<task-name>-test-plan.md` — current test plan (if exists)
3. `docs/DECISION_LOG.md` — existing decisions
4. Recent git changes (`git diff`, `git status`, recent commits)
5. User's arguments for context on what changed

### Step 2 — Update task brief

Update `docs/tasks/<task-name>.md`:
- Add new decisions to section 3
- Add new edge cases to section 6
- Add new test scenarios to section 7
- Update files/systems in section 5 if new ones were touched
- Add a dated entry to section 10 (Change notes)
- Update status if needed

### Step 3 — Update test plan (if needed)

If behavior or test scenarios changed, update `docs/testing/<task-name>-test-plan.md`:
- Add new scenarios
- Update expected results
- Move verified items from "Not yet tested" to their proper section

### Step 4 — Append to decision log

For each significant decision made during this work session, append to `docs/DECISION_LOG.md`:

```markdown
## YYYY-MM-DD — <short decision title>
- **Task:** <task-name>
- **Decision:** What was decided
- **Why:** Reasoning
- **Affected files/rules:** Key files or product rules impacted
- **Needs SOURCE_OF_TRUTH update now?:** yes/no
- **Needs manual testing?:** yes/no
```

### Step 5 — Report

Summarize:
- What was updated in the task brief
- What was updated in the test plan
- Decisions captured
- Whether SOURCE_OF_TRUTH.md needs updating (flag it, don't do it)

## Rules

- This is for **in-progress** capture, not final documentation
- Do NOT update `SOURCE_OF_TRUTH.md` unless there is a very strong reason and the change is stable
- Do NOT update `SITE_RULES_AUDIT_REPORT.md` — that's for `/project-update` or `/weekly-pm`
- Preserve existing brief content — append, don't overwrite
- If no task brief exists, suggest running `/task-start <task-name>` first
- Keep entries concise and evidence-based
