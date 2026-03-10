# ClanTrader Documentation

> Last Updated: 2026-03-10

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

Run `/update-project` in Claude Code to:
- Audit all docs against codebase reality
- Reconcile contradictions
- Update canonical docs
- Archive stale docs
- Refresh CLAUDE.md and this index
