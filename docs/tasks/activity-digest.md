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

### UI/UX Modernization (implemented)
- [x] Hero status card: gradient-bg, 2xl safety label, 3xl score, progress bar, confidence inline
- [x] Modern pill tab period selector (replaces Button toggle)
- [x] Delta strip: rounded-full pills, separated label+value, no border noise
- [x] Top Actions: orange accent card with circular number badges
- [x] Key metrics: 2-column grid with larger MetricCard (bg-muted/30, no borders)
- [x] Concentration: visual progress bars proportional to trade count
- [x] Attention queue: left-accent border (border-s-2) by severity, no full borders
- [x] Member cards: rounded-xl bg-muted/20, larger avatar, bold R metric, clean stats row
- [x] Visual zones with space-y-6 between major groups, space-y-3 within
- [x] Section headers: 11px uppercase tracking-wider
- [x] Removed Badge/Button shadcn dependencies (plain styled elements)
- [x] Flex layout for sheet (overflow-hidden flex flex-col, flex-1 scrollable)

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

### Phase 2 (implemented)
- [x] Concentration / risk cluster logic (Engine 6)
- [x] Risk budget visualization with progress bar (Engine 7)
- [x] Symbol/direction clustering in alerts (concentration_risk alert type)
- [x] Per-member trend states — improving/declining/stable badges (Engine 8)
- [x] Digest engines unit tests
- [x] ConcentrationBlock, RiskBudgetBar, MemberTrendBadge UI components
- [x] Equity/balance data from MT accounts for risk budget
- [x] i18n keys for concentration, risk budget, trends, hints

### Phase 3 (implemented)
- [x] Risk-budget with account equity data (equity impact %)
- [x] Predictive deterioration hints (Engine 9 — rapid drops, worsening trends)
- [x] HintsBlock UI component
- [x] Enhanced snapshots with per-member metrics for trend computation
- [ ] Start-of-day baseline comparison (deferred — needs trigger mechanism)
- [ ] Timeframe-selectable baselines (deferred — needs additional UI)
- [ ] Advanced attribution scoring (deferred — current impact scoring is sufficient)
- [ ] Deeper drill-down flows (deferred — needs trade detail page linking)

### Phase 4: Scope-Aware Digest (implemented)
- [x] Scope switcher (Trader / Clan) — pill tabs with User/Users icons
- [x] Default scope: Trader
- [x] `buildTraderView` — client-side derivation of trader-scoped DigestV2Response
- [x] Trader-only state assessment (safety score, confidence, bands from own positions)
- [x] Trader-only cockpit (floating PnL/R, risk, actions from own data)
- [x] Trader-only concentration (own positions only)
- [x] Trader-only alerts and actions (from own issues only)
- [x] Trader-only risk budget (own SL exposure)
- [x] Trader-only attention queue (filtered to own userId)
- [x] Trader-only tracking summary (own account status)
- [x] Scope-aware deltas: server computes traderDeltas with separate Redis key
- [x] Scope-aware hints: server computes traderHints from trader snapshot
- [x] Zone 6 scope split: Clan shows member breakdown, Trader shows "My Positions" directly
- [x] Schema updated: `currentUserId`, `traderDeltas`, `traderHints` fields
- [x] Route updated: trader-scoped snapshot/delta computation with `:trader` key suffix
- [x] i18n keys: scope.trader, scope.clan, myPositions, myClosedTrades (en + fa)

## 5. Files & Systems

| File | Change |
|------|--------|
| `src/lib/digest-engines.ts` | 9 engines: state, delta, alerts, actions, impact, concentration, risk budget, member trend, predictive hints |
| `src/lib/digest-constants.ts` | Snapshot prefix/TTL + risk budget thresholds |
| `src/lib/digest-v2-schema.ts` | Schemas for all engine outputs + scope-aware fields (currentUserId, traderDeltas, traderHints) |
| `src/services/digest-v2.service.ts` | Wired all engines, equity data from MT accounts |
| `src/app/api/clans/[clanId]/digest/route.ts` | Enhanced per-user snapshots with member metrics, trends, hints + trader-scoped snapshot/delta |
| `src/components/chat/DigestSheetV2.tsx` | Scope switcher, buildTraderView, scope-aware V2Content, My Positions zone |
| `src/lib/__tests__/digest-engines.test.ts` | Unit tests for all 9 engines |
| `src/locales/en.json` | ~70 digest keys |
| `src/locales/fa.json` | ~70 Persian translations |

## 6. Edge Cases

- No prior snapshot → show "Tracking changes from next refresh" instead of fake zeros
- Zero open trades → safety/confidence default to safe bands (no trades = no risk)
- Division by zero → all ratios use `max(denominator, 1)` fallback
- Member impact with 0 clan-total for a dimension → exclude that dimension from weighted average
- Delta for "good when down" metrics → positive delta = bad direction
- Redis failure on snapshot → silently skip deltas, return `deltas: null`
- Alert worsening detection → compare with previous snapshot if available
- High trade cluster threshold = 5 trades per member
- Scope switcher: Trader mode default, no refetch on scope change (client-side derivation)
- Trader not in members list → traderView null → empty state in Trader mode
- Trader with 0 trades → SAFE state, empty sections (correct behavior)
- One-member clan → Trader and Clan views nearly identical
- Per-member realizedPnl not available → shows "—" in trader cockpit

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

### 2026-03-11 (Phase 4: Scope-Aware Digest)
- Added Trader/Clan scope switcher at top of digest (pill tabs with User/Users icons)
- Default scope: Trader — personal view of risk/performance/actions
- `buildTraderView()` derives full trader-scoped DigestV2Response from clan data on client
- Trader mode recomputes: state assessment, cockpit, concentration, alerts, actions, risk budget, attention queue
- Trader deltas use separate Redis snapshot key (`:trader` suffix) — computed server-side
- Zone 6 splits: Clan shows member breakdown, Trader shows "My Positions" directly
- Schema updated with `currentUserId`, `traderDeltas`, `traderHints` optional fields
- Route updated to compute trader-specific snapshots and deltas alongside clan deltas
- Engine functions imported into UI component (they're pure — no server deps)
- Scope switching is instant (no refetch, client-side computation)
- i18n: 4 new keys in en.json + fa.json

### 2026-03-11 (UI/UX Modernization)
- Complete visual redesign of DigestSheetV2.tsx
- Hero: gradient background, large safety label (2xl/3xl), progress bar, inline confidence
- Period selector: modern pill tabs instead of Button components
- Delta strip: rounded-full pills with separated label/value
- Actions: orange accent card with circular numbered badges
- Metrics: 2-column grid with larger borderless cards (bg-muted/30)
- Concentration: proportional progress bars instead of flat rows
- Attention: left-accent borders (border-s-2) by severity instead of full borders
- Members: rounded-xl cards with bg-muted tinting, larger avatars, bold R metric
- Layout: 6 visual zones with larger gaps (space-y-6) between groups
- Removed Badge and Button shadcn imports (simpler styled elements)
- Sheet uses flex layout for better scroll behavior

### 2026-03-11 (Phase 2+3)
- Phase 2+3 implemented: 4 new engines (concentration, risk budget, member trend, predictive hints)
- Concentration analysis groups open trades by instrument+direction across members
- Risk budget shows total SL exposure with progress bar + equity impact %
- Member trends computed from per-member snapshot comparison
- Predictive hints detect rapid safety/confidence drops and worsening patterns
- Enhanced snapshots include per-member metrics for trend tracking
- MT account equity/balance added to service query for risk budget
- `concentration_risk` alert type added to severity engine
- 4 new UI components + member trend badges
- Unit tests for all 9 engines
- V2 is now the default (no feature flag needed)

### 2026-03-11 (Phase 1)
- Phase 1 implemented: all 5 decision engines, 3 UI components, i18n, schemas
- Pure function pattern chosen for testability
- Per-user Redis snapshots for delta comparison
- Build verified (type-check + lint + build pass)
