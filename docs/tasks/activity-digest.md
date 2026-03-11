# Task: Activity Digest v2 — Cockpit Simplification & Live Risk UX

> Status: IN_PROGRESS
> Started: 2026-03-11
> Last updated: 2026-03-11

## 1. Goal

Transform the Activity Digest from a data display into a **live-market decision-support screen** that answers 5 core questions:
1. Where do I stand right now? (State Engine)
2. What changed since last check? (Delta Engine)
3. What is dangerous? (Risk Severity Engine)
4. What should I do first? (Action Queue Engine)
5. Which member is causing the issue? (Impact Attribution Engine)

## 2. Background

The v2 digest (feature-flagged behind `digest_v2`) already provides cockpit metrics, open trade health, attention queue, and member breakdowns. Phase 1 adds the 5 decision engines on top of this foundation.

## 3. Decisions

- **5-engine architecture**: All engines are pure functions in `src/lib/digest-engines.ts` — no DB/Redis access, fully unit-testable
- **Per-user delta snapshots**: Stored in Redis (`digest-snap:{clanId}:{userId}:{period}`, 24h TTL). Digest data is shared (90s cache), deltas are per-user (computed at route level)
- **Severity scoring**: Base severity per alert type + modifiers (trade count, worsening trend, top-impact member)
- **Member impact**: Weighted clan-relative shares (0.35 needAction + 0.25 unknownRisk + 0.25 trackingLost + 0.15 openTrades). Dimensions with 0 clan total are excluded to prevent inflation
- **Confidence score**: `round(100 * (0.40 * trackingCoverage + 0.35 * knownRiskCoverage + 0.25 * activeAccountCoverage))`
- **Safety score**: `round(100 * (0.45 * protectionCoverage + 0.30 * safeUnknown + 0.25 * safeTracking))`
- **Best-effort deltas**: Delta computation wrapped in try/catch — never fails the digest

## 4. Scope

### Phase 1 (implemented)
- [x] State Assessment Engine (safety score, confidence score, bands)
- [x] Delta Engine (per-user Redis snapshots, delta computation)
- [x] Risk Severity Engine (alert generation, severity scoring)
- [x] Action Queue Engine (top 3 prioritized actions)
- [x] Member Impact Engine (impact score, impact labels)
- [x] StateStatusBar UI component
- [x] DeltaStrip UI component
- [x] TopActionsBlock UI component
- [x] Member impact indicators in member rows
- [x] i18n keys (en + fa)
- [x] Zod schemas for all new types

### Phase 2 (next)
- [ ] Concentration / risk cluster logic
- [ ] Stronger danger bar / risk budget visualization
- [ ] Better symbol/direction clustering in alerts
- [ ] Richer trust/confidence explanations
- [ ] Per-member trend states (improving/declining)
- [ ] Digest engines unit tests

### Phase 3 (future)
- [ ] Risk-budget logic with account equity data
- [ ] Advanced attribution scoring
- [ ] Predictive deterioration hints
- [ ] Deeper drill-down flows
- [ ] Start-of-day baseline comparison
- [ ] Timeframe-selectable baselines

## 5. Files & Systems

| File | Change |
|------|--------|
| `src/lib/digest-engines.ts` | NEW — all 5 engine computations |
| `src/lib/digest-constants.ts` | Added snapshot prefix/TTL constants |
| `src/lib/digest-v2-schema.ts` | Added schemas for state/alerts/actions/deltas |
| `src/services/digest-v2.service.ts` | Wired engines into digest computation |
| `src/app/api/clans/[clanId]/digest/route.ts` | Per-user delta snapshots via Redis |
| `src/components/chat/DigestSheetV2.tsx` | 3 new UI sections + member impact |
| `src/locales/en.json` | ~47 new digest keys |
| `src/locales/fa.json` | ~47 new Persian translations |

## 6. Edge Cases

- No prior snapshot → show "Tracking changes from next refresh" instead of fake zeros
- Zero open trades → safety/confidence default to safe bands (no trades = no risk)
- Division by zero → all ratios use `max(denominator, 1)` fallback
- Member impact with 0 clan-total for a dimension → exclude that dimension from weighted average
- Delta for "good when down" metrics → positive delta = bad direction
- Redis failure on snapshot → silently skip deltas, return `deltas: null`
- Alert worsening detection → compare with previous snapshot if available
- High trade cluster threshold = 5 trades per member

## 7. Test Scenarios

See `docs/testing/activity-digest-test-plan.md`

## 8. Dependencies

- Redis (for delta snapshots)
- Feature flag `digest_v2` (to enable v2 path)
- Open trade health system (`open-trade-health.ts`)
- MT heartbeat data for tracking/stale detection

## 9. Risks

- Safety/confidence scores may need tuning after real data testing
- Alert severity base scores are heuristic — may need adjustment
- Persian translations need native speaker review

## 10. Change Notes

### 2026-03-11
- Phase 1 implemented: all 5 decision engines, 3 UI components, i18n, schemas
- Pure function pattern chosen for testability
- Per-user Redis snapshots for delta comparison
- Build verified (type-check + lint + build pass)
