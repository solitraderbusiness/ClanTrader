---
name: bug-fix
description: Log a fixed bug to the project board BUGS_FIXED column
disable-model-invocation: true
argument-hint: "Title of the bug fix"
allowed-tools: Bash(source .env && psql *), Read
---

Log a bug fix to the project board. Parse the title from $ARGUMENTS.

## Procedure

1. **Identify the parent task** — determine which board task this bug was discovered from. If you were working on a task, use that task's ID. If unsure, ask.

2. **Look up the parent task ID**:
```bash
source .env && psql "$DATABASE_URL" -c "
  SELECT id, title FROM \"ProjectTask\"
  WHERE title ILIKE '%SEARCH_TERM%'
  LIMIT 5;
"
```

3. **Insert the bug fix** into BUGS_FIXED column with `discoveredFromId` linking to the parent task:
```bash
source .env && psql "$DATABASE_URL" -c "
  INSERT INTO \"ProjectTask\" (id, title, description, phase, category, \"column\", \"completedAt\", result, position, \"discoveredFromId\", \"updatedAt\")
  VALUES (
    concat('cl', substr(md5(random()::text), 1, 23)),
    'Fix: TITLE',
    'Problem: WHAT_USER_SAW

Root cause: WHY_IT_HAPPENED

Fix: WHAT_WAS_CHANGED',
    'CURRENT_PHASE',
    'BUG_FIX',
    'BUGS_FIXED',
    now(),
    'BRIEF_OUTCOME',
    0,
    'PARENT_TASK_ID',
    now()
  );
"
```

## Rules

- **Every bug fix MUST be logged** — no exceptions
- **description MUST include** all 3 sections: Problem, Root cause, Fix
- **discoveredFromId** is required — link to the task where the bug was found
- **phase** should match the current working phase (default W4)
- **title** always starts with "Fix: "
- **result** is 1-2 sentences about the outcome
- Confirm insertion was successful (INSERT 0 1)
