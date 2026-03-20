# Task Brief — Heartbeat Fallback: Price-Pool-Based Background Computation

> Started: 2026-03-12
> Status: DONE (2026-03-15) — trust-hardened 2026-03-20
> Completed: Heartbeat fallback implemented (2026-03-14) + equity chart hardening (2026-03-15) + freshness policy audit (2026-03-20)

## 1. Goal

When a user's MT/EA loses heartbeat, use the **price pool** (fed by all other connected EAs) to continue computing estimated equity, floating P/L, equity snapshots, and live risk — so no user loses data just because their personal MT connection dropped.

Principle: **If any EA on the platform knows a price, every user holding that instrument should benefit.**

## 2. Why it exists

When a user's EA stops sending heartbeats:
- Equity curve gets gaps (no new snapshots)
- Floating P/L freezes at last heartbeat value
- Live risk overlay becomes stale
- Effective rank stops penalizing new open losses
- Socket broadcasts stop (UI freezes)

The price pool (fed by other users' EAs) likely has fresh prices for the same instruments. This service uses that data as a fallback.

## 3. Current decisions

1. **Freshness policy**: 90s (`FALLBACK_FRESH_THRESHOLD_MS = 90_000`) — prices older than 90s are rejected in both `heartbeat-fallback.service.ts` and `live-risk.service.ts`
2. **Effective rank**: Uses status-degrade-only approach — ranking status degrades to PROVISIONAL/UNRANKED based on tracking status, but effective rank R value uses last known MT profit, NOT fallback-estimated prices. This is safer: avoids stale cross-broker prices contaminating the ranking number.
3. **Stale-check ownership**: When `heartbeat_fallback` flag is enabled, `updateAllTrackingStatuses()` runs in-process every 30s — making `/api/admin/stale-check` cron redundant.
4. **Snapshot quality classification**: `EA`/`REAL` (chart-eligible), `FALLBACK_FRESH` (chart-eligible), `FALLBACK_STALE` (not chart-eligible), `NO_PRICE` (not chart-eligible)
5. **Point value derivation**: Uses sanity check — derived value must be within 1%-100x of static fallback

## 4. Rules touched

- Live open risk computation (price pool fallback with 90s freshness gate)
- Equity snapshot recording (estimated snapshots with quality classification)
- Effective rank (status-degrade only — no fallback prices in R value)
- Ranking status (ACTIVE → STALE → TRACKING_LOST thresholds)
- Price pool trust model (display-grade for estimation, never verification-grade)
- **NOT touched**: Signal qualification (20s window is strict), integrity contract (7 conditions unchanged), statement eligibility

## 5. Files / systems involved

| File | Role |
|------|------|
| `src/services/heartbeat-fallback.service.ts` | Core 30s background job — estimates equity, classifies quality, creates snapshots, broadcasts P/L |
| `src/services/live-risk.service.ts` | `getLiveOpenRisk()` — price pool fallback with 90s freshness gate for stale accounts |
| `src/services/price-pool.service.ts` | 5-layer Redis price cache, `getDisplayPrice()` used for estimation |
| `src/services/ranking.service.ts` | `computeEffectiveRank()` — uses last MT profit only (no fallback prices) |
| `server.ts` | 30s interval, feature-flag gated (`heartbeat_fallback`), de-duplication via `fallbackRunning` |
| `src/app/api/admin/stale-check/route.ts` | Legacy external cron — redundant when flag enabled |
| `prisma/schema.prisma` | `EquitySnapshot.snapshotSource`, `estimateQuality`, `chartEligible` fields |

## 6. Edge cases

- **No other EA online for that instrument**: No price available → skip estimation, leave gap
- **Cross-broker price differences**: Display-grade prices may differ by a few pips → acceptable for estimation, labeled as such
- **Market closed (weekends)**: Price pool returns `market_closed` status → don't generate false snapshots
- **All EAs offline**: No prices available → system gracefully degrades
- **User comes back online**: Real heartbeat resumes → seamlessly switch back to verified data
- **Point value derivation**: Sanity check prevents wild estimates from bad data
- **Commission/swap not updated**: Estimated P/L won't include commission/swap changes → minor, acceptable

## 7. Manual test scenarios

1. Connect EA, open trades, see live P/L updating
2. Disconnect EA (close MT) — verify estimated P/L continues updating from price pool
3. Verify equity chart continues with estimated snapshots (different visual style)
4. Verify effective rank status degrades to PROVISIONAL when stale with open trades
5. Reconnect EA — verify seamless switch back to verified data
6. Disconnect EA when no other EA has the same instrument — verify graceful degradation
7. Verify estimated snapshots are labeled in DB (`snapshotSource`, `estimateQuality`, `chartEligible`)

## 8. Done definition

- [x] Background job runs every 30s for stale accounts with open positions
- [x] Floating P/L estimated from price pool when MT data is stale
- [x] EquitySnapshot estimated records created (with `snapshotSource`/`estimateQuality`/`chartEligible` fields)
- [x] Live risk overlay uses estimated floating P/L as fallback (freshness-gated to 90s)
- [x] Effective rank uses status-degrade approach (PROVISIONAL/UNRANKED) — does NOT use fallback prices in R value
- [x] Stale-check moved from external cron to in-process interval (flag-gated)
- [x] Socket broadcasts continue with estimated data (`isEstimated: true` flag)
- [x] All estimation clearly separated from verification-grade data (integrity contract untouched)
- [ ] Equity chart visually distinguishes estimated vs verified segments (deferred — data is flagged, UI TBD)
- [ ] UI shows "estimated" indicator on digest/live-risk (deferred — runtime only)

## 9. Open questions (resolved)

1. **Should estimated equity affect leaderboard ranking?** → No. Effective rank uses last MT profit only. Status degrades to PROVISIONAL/UNRANKED.
2. **Should we backfill equity snapshots when EA reconnects?** → No. Real heartbeat resumes and new verified snapshots fill in.
3. **Estimation interval**: 30s (matches heartbeat frequency)
4. **Should the equity chart show estimated segments differently?** → Deferred. Data has `chartEligible` flag for future UI work.
5. **Close detection from price pool**: → Not implemented. Too risky (broker wicks vs SL triggers are unpredictable).

## 10. Change notes

### 2026-03-12
- Task created from conversation about equity curve gaps when MT is offline
- Deep research identified 13 systems affected by heartbeat loss

### 2026-03-14
- Core implementation complete: heartbeat-fallback.service.ts, server.ts interval, stale-check consolidation

### 2026-03-15
- Equity chart hardening: snapshotSource, estimateQuality, chartEligible fields added
- Point value derivation with sanity check

### 2026-03-20 — Trust-hardening audit
- Fixed freshness policy inconsistency: `live-risk.service.ts` `getLiveOpenRisk()` now enforces 90s freshness gate (was accepting arbitrarily old prices)
- Confirmed effective rank is status-degrade-only (safer than using stale fallback prices)
- Resolved stale-check ownership: in-process 30s interval when flag enabled, legacy endpoint as manual fallback
- Updated task brief, test plan, SOURCE_OF_TRUTH.md
