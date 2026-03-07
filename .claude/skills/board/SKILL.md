---
name: board
description: Check project board status and log completed work. Use at start/end of tasks.
argument-hint: [check|log "title" --phase W4 --category BUG_FIX]
allowed-tools: Bash(source .env && psql *), Read
---

Project board management — read current status or log completed work.

## Usage

### `/board check` — Read board status (start of task)

Run this to see what's on the board today:

```bash
source .env && psql "$DATABASE_URL" -c "
  SELECT '=== OVERDUE ===' AS section;
  SELECT id, title, phase, priority, \"dueDate\"::date,
    (CURRENT_DATE - \"dueDate\"::date) AS days_overdue
  FROM \"ProjectTask\"
  WHERE \"dueDate\" < CURRENT_DATE AND \"column\" NOT IN ('DONE', 'BUGS_FIXED')
  ORDER BY \"dueDate\" ASC;

  SELECT '=== TODAY ===' AS section;
  SELECT id, title, phase, priority
  FROM \"ProjectTask\"
  WHERE \"dueDate\"::date = CURRENT_DATE AND \"column\" NOT IN ('DONE', 'BUGS_FIXED');

  SELECT '=== IN PROGRESS ===' AS section;
  SELECT id, title, phase, priority
  FROM \"ProjectTask\"
  WHERE \"column\" = 'IN_PROGRESS'
  ORDER BY priority ASC, position ASC;

  SELECT '=== SUGGESTED NEXT ===' AS section;
  SELECT id, title, phase, priority
  FROM \"ProjectTask\"
  WHERE \"column\" NOT IN ('DONE', 'BUGS_FIXED')
  ORDER BY
    CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
    phase ASC, position ASC
  LIMIT 5;
"
```

Summarize findings to the user: what's overdue, what's in progress, and what to work on next.

### `/board log "Title here"` — Log completed work (end of task)

After completing work, log it to the board. Parse arguments for title. Use flags if provided, otherwise infer:
- `--phase` (default: W4)
- `--category`: FEATURE | BUG_FIX | IMPROVEMENT | MAINTENANCE | INFRASTRUCTURE (default: infer from title)
- `--result`: outcome summary (default: ask user or summarize from context)

```bash
source .env && psql "$DATABASE_URL" -c "
  INSERT INTO \"ProjectTask\" (id, title, description, phase, category, \"column\", \"completedAt\", result, position, \"updatedAt\")
  VALUES (
    concat('cl', substr(md5(random()::text), 1, 23)),
    'TITLE',
    'DESCRIPTION',
    'PHASE',
    'CATEGORY',
    'DONE',
    now(),
    'RESULT',
    0,
    now()
  );
"
```

### `/board bug "Title here"` — Log a fixed bug

When a bug is fixed, log it to the BUGS_FIXED column. The description MUST include:
1. **Problem**: What was the symptom/behavior the user observed
2. **Root cause**: Why it happened (the actual code/data issue)
3. **Fix**: What was changed to resolve it

Use flags if provided, otherwise infer:
- `--phase` (default: W4)
- `--result`: brief outcome summary
- `--from TASK_ID`: link to the task where the bug was discovered (use the task's cuid ID)

If the bug was discovered while working on a board task, **always** include `--from` to link them. If no `--from` is given but you know which task you were working on, look up the task ID first.

```bash
source .env && psql "$DATABASE_URL" -c "
  INSERT INTO \"ProjectTask\" (id, title, description, phase, category, \"column\", \"completedAt\", result, position, \"discoveredFromId\", \"updatedAt\")
  VALUES (
    concat('cl', substr(md5(random()::text), 1, 23)),
    'Fix: TITLE',
    'Problem: WHAT_USER_SAW

Root cause: WHY_IT_HAPPENED

Fix: WHAT_WAS_CHANGED',
    'PHASE',
    'BUG_FIX',
    'BUGS_FIXED',
    now(),
    'RESULT',
    0,
    'DISCOVERED_FROM_TASK_ID_OR_NULL',
    now()
  );
"
```

### `/board update TASK_ID` — Update an existing task

Move a task to a different column or update its fields:

```bash
source .env && psql "$DATABASE_URL" -c "
  UPDATE \"ProjectTask\"
  SET \"column\" = 'IN_PROGRESS', \"startedAt\" = COALESCE(\"startedAt\", now())
  WHERE id = 'TASK_ID';
"
```

For completing:
```bash
source .env && psql "$DATABASE_URL" -c "
  UPDATE \"ProjectTask\"
  SET \"column\" = 'DONE', \"completedAt\" = now(), result = 'RESULT'
  WHERE id = 'TASK_ID';
"
```

## Bug Logging Workflow

Every time a bug is fixed (whether it was on the board or not), **always** log it with `/board bug`. This creates a searchable history of:
- What bugs we encountered and under what conditions
- What the root cause was
- How we fixed them

This helps prevent regressions and speeds up future debugging of similar issues.

## Notes

- Always use `source .env && psql "$DATABASE_URL"` — never hardcode connection strings
- When logging, infer category from work type: bug fixes → BUG_FIX, new features → FEATURE, refactors → IMPROVEMENT
- Keep titles short and imperative: "Fix live R:R calculation", "Add dashboard to kanban"
- Result should be 1-2 sentences about what was done and the outcome
- Columns: BACKLOG → TODO → IN_PROGRESS → TESTING → DONE (features) | BUGS_FIXED (bug fixes)
- Both DONE and BUGS_FIXED count as "completed" for stats, dashboard, and overdue checks
