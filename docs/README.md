# ClanTrader Documentation

> Last Updated: 2026-03-20

## How This Docs System Works

- **`SOURCE_OF_TRUTH.md`** (repo root) is the **authoritative project truth**. When any doc conflicts with it, SOURCE_OF_TRUTH.md wins.
- **`CLAUDE.md`** (repo root) is the authoritative quick reference for development rules and product architecture.
- **Canonical docs** live in `docs/` — actively maintained references for specific domains.
- **Archived docs** live in `docs/archive/` — historical snapshots with deprecation banners.
- When docs conflict with code, **code wins** for implemented behavior.
- When planning future work, **latest PM decisions** override older docs.

Every doc has a status banner at the top:
```
> Status: ACTIVE | HISTORICAL | ARCHIVED | REPLACED
> Last reviewed: YYYY-MM-DD
> Authority: SOURCE_OF_TRUTH.md
```

## Canonical Docs

### Product & Scope
| Doc | Purpose | Owner |
|-----|---------|-------|
| [MVP.md](MVP.md) | Launch scope, timeline, feature completion status | Product |
| [ANALYSIS-CARD-REPORT.md](ANALYSIS-CARD-REPORT.md) | Signal vs analysis card system, lifecycle, upgrade mechanics | Engineering |
| [BADGES.md](BADGES.md) | Badge categories, evaluation rules, admin controls | Engineering |

### Engineering & Architecture
| Doc | Purpose | Owner |
|-----|---------|-------|
| [E2E-INTEGRITY-TEST.md](E2E-INTEGRITY-TEST.md) | 41 E2E test scenarios — integrity contract, single-statement architecture, signal qualification | Engineering/QA |
| [INTEGRITY-CONTRACT-CHECKLIST.md](INTEGRITY-CONTRACT-CHECKLIST.md) | 12 integrity loopholes identified and fixed | Engineering |
| [MT_LINKED_SIGNAL_ACTIONS_NOTES.md](MT_LINKED_SIGNAL_ACTIONS_NOTES.md) | MT-linked trade action routing (Mode A) | Engineering |
| [price-system-report.md](price-system-report.md) | ~~Price data flow~~ — HISTORICAL: superseded by 5-layer source-aware price pool | Engineering |
| [price-system-review-response.md](price-system-review-response.md) | ~~Price system review~~ — HISTORICAL: proposals now implemented in code | Engineering |

### QA & Testing
| Doc | Purpose | Owner |
|-----|---------|-------|
| [FEATURES.md](FEATURES.md) | Feature-by-feature QA test checklist | QA |
| [TESTING-CHECKLIST.md](TESTING-CHECKLIST.md) | Full QA test matrix (light/dark, mobile/desktop) | QA |

### Workflow & Task Management
| Doc | Purpose | Owner |
|-----|---------|-------|
| [DECISION_LOG.md](DECISION_LOG.md) | Running log of in-progress decisions captured during task work | PM |
| `tasks/*.md` | Per-task briefs (goal, decisions, edge cases, done definition) | PM |
| `testing/*-test-plan.md` | Per-task test plans with scenarios and expected results | QA |
| `testing/*-qa-checklist.md` | Per-task manual QA verification checklists with SQL checks and decision matrix | QA |

### Strategy & Status
| Doc | Purpose | Owner |
|-----|---------|-------|
| [STRATEGIC_ROADMAP.md](STRATEGIC_ROADMAP.md) | 7-phase product strategy (MVP → Full Vibe Trading) | PM |
| [PM-STATUS-REPORT-2026-03-18.md](PM-STATUS-REPORT-2026-03-18.md) | Current project status snapshot (103 tasks, 4 blockers, launch strategy) | PM |

### Ops & Deployment
| Doc | Purpose | Owner |
|-----|---------|-------|
| [PRODUCTION-PLAN.md](PRODUCTION-PLAN.md) | ~~Production ops plan~~ — HISTORICAL: many items now exist (PM2, Sentry, rate limiting). Useful as future ops checklist. | Ops |

## Archived Docs (`docs/archive/`)

These are historical snapshots — useful for context but no longer canonical. Each has a deprecation banner at the top.

| Doc | Why Archived |
|-----|-------------|
| ALPHA-READINESS-PLAN.md | Sprint plan snapshot; work completed or superseded |
| AUTH_CLEANUP_NOTES.md | Auth refactor complete (Feb 2026) |
| CLAUDE.iran.md | Iranian VPS plan canceled; infra moved to Germany |
| PITCH.md | Marketing pitch; superseded by MVP.md |
| PLATFORM_REPORT.md | Platform overview; superseded by CLAUDE.md + MVP.md |
| PM-ROADMAP.md | Post-MVP roadmap (P9–P16); deferred |
| PROACTIVE-PM-REPORT.md | Digest system design report; useful as reference |
| PROJECT-REPORT.md | Full project audit (P1–P8); point-in-time snapshot |
| PROJECT-STATUS-REPORT.md | PM status snapshot; redundant with PROJECT-REPORT |
| PROJECT_PLAN.md | Comprehensive dev plan (Feb 2026); some details outdated |
| project_plan_claude.md | Claude's working plan; superseded |
| trade-integrity-v1.md | v1 integrity spec; superseded by full contract |

## Key Concepts

For detailed product architecture (single statement page, signal qualification, integrity contract, effective rank, live risk), see **CLAUDE.md** in the repo root.

For authoritative project truth (feature status, infrastructure state, launch blockers, business decisions, contradiction resolution), see **SOURCE_OF_TRUTH.md** in the repo root.

## Keeping Docs Current

**Founder workflow commands** (see `.claude/FOUNDER_LOOP.md`):
- `/task-start <name>` — rebuild context, create task brief + test plan
- `/task-update [name]` — mid-task: capture decisions, update brief/test plan
- `/project-update [context]` — task finished: update SOURCE_OF_TRUTH.md and docs
- `/weekly-pm` — weekly PM cleanup pass
- `/my-rules` — workflow guidance

**Full doc reconciliation**:
Run `/update-project` in Claude Code to audit all docs against codebase reality, reconcile contradictions, and refresh this index.
