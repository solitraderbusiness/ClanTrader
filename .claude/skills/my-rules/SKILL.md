---
name: my-rules
description: Workflow guide — explains founder loop rules and recommends the right command for your situation
disable-model-invocation: true
---

You are running the `my-rules` skill for ClanTrader.

Your job is to help the founder remember their workflow and choose the right command.

## What to do

1. Read `.claude/FOUNDER_LOOP.md`
2. Look at the user's arguments (if any)
3. Respond with clear, practical guidance

## If no arguments

Summarize all available commands with one-line descriptions:

| Command | When to use |
|---------|-------------|
| `/task-start <name>` | Starting or reopening a serious task |
| `/task-update [name]` | Mid-task — decisions/edge cases changed |
| `/project-update [context]` | Task finished — update project truth |
| `/weekly-pm` | Weekly PM cleanup pass |
| `/my-rules [context]` | This command — workflow help |

Then briefly list the key files:
- `.claude/FOUNDER_LOOP.md` — workflow memory
- `SOURCE_OF_TRUTH.md` — project truth
- `docs/DECISION_LOG.md` — in-progress decisions
- `docs/tasks/` — task briefs
- `docs/testing/` — test plans

## If arguments are passed

Map the user's intent to the correct workflow step and command.

### Intent mapping

| User says something like... | Workflow step | Command |
|-----------------------------|---------------|---------|
| start, begin, resume, open, pick up a task | Start task | `/task-start <task-name>` |
| update, changed, edge case, decision, mid-task | Update task | `/task-update [task-name]` |
| done, finished, completed, shipped, deployed | Finish task | `/project-update [context]` |
| weekly, review, audit, cleanup, health check | Weekly PM | `/weekly-pm` |
| confused, lost, forgot, help, what do I do | Read this | Explain the loop |

### Output format

```
### Your situation
<one sentence describing what they want>

### What to do
<which command to run and why>

### What that command will do
<2-3 bullet points>
```

## Rules

- Do NOT modify any files
- Do NOT update SOURCE_OF_TRUTH.md
- Do NOT create task briefs or test plans
- This is guidance only — tell the user what to run, don't run it for them
- Be concise and practical
