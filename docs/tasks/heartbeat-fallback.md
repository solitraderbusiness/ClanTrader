# Task Brief — Heartbeat Fallback: Price-Pool-Based Background Computation

> Started: 2026-03-12
> Status: DONE (2026-03-15)
> Completed: Heartbeat fallback implemented (2026-03-14) + equity chart hardening (2026-03-15)

## 1. Goal

When a user's MT/EA loses heartbeat, use the **price pool** (fed by all other connected EAs) to continue computing estimated equity, floating P/L, equity snapshots, and live risk — so no user loses data just because their personal MT connection dropped.

Principle: **If any EA on the platform knows a price, every user holding that instrument should benefit.**

## 2. Why it exists

Currently, when a user's EA stops sending heartbeats:
- Equity curve gets gaps (no new snapshots)
- Floating P/L freezes at last heartbeat value
- Live risk overlay becomes stale
- Effective rank stops penalizing new open losses
- Socket broadcasts stop (UI freezes)
- Trade closures on MT are never detected

All of this happens even though the price pool (fed by other users' EAs) likely has fresh prices for the same instruments. The data exists — we just don't use it as a fallback.

## 3. Current decisions

None yet — task is new. Key design question: **estimated vs verified** data must be clearly labeled so the integrity contract is never compromised.

## 4. Rules touched

- Live open risk computation (currently MT-only)
- Equity snapshot recording (currently heartbeat-only)
- Effective rank (currently depends on live floating R from MT)
- Ranking status (ACTIVE → STALE → TRACKING_LOST thresholds)
- Price pool trust model (display-grade vs verification-grade)
- **NOT touched**: Signal qualification (20s window is strict — no fallback possible), integrity contract (7 conditions unchanged), statement eligibility

## 5. Files / systems involved

| File | Current Role | Fallback Change |
|------|-------------|-----------------|
| `src/services/ea.service.ts` | processHeartbeat: updates balance/equity, records snapshots, broadcasts P/L | Background job reuses same patterns with estimated data |
| `src/services/live-risk.service.ts` | getLiveOpenRisk: computes floating P/L from MT trade profit | Add price-pool fallback when MT data stale |
| `src/services/price-pool.service.ts` | 5-layer Redis price cache from all EAs | Already has `getDisplayPrice()` — use it for estimation |
| `src/services/digest-v2.service.ts` | Equity curve from EquitySnapshot table | Benefits automatically from new estimated snapshots |
| `src/services/ranking.service.ts` | Effective rank = closedR + openLossPenaltyR | Use estimated floating R when MT stale |
| `prisma/schema.prisma` | EquitySnapshot model, MtAccount fields | Add `isEstimated` flag to EquitySnapshot |
| `server.ts` | Background intervals (evaluator, reminders) | Add heartbeat-fallback interval |
| `src/app/api/admin/stale-check/route.ts` | External cron for stale detection | Move to in-process interval |

## 6. Edge cases

- **No other EA online for that instrument**: No price available → skip estimation, leave gap
- **Cross-broker price differences**: Display-grade prices may differ from user's broker by a few pips → acceptable for estimation, must be labeled
- **Market closed (weekends)**: Price pool returns `market_closed` status → don't generate false snapshots
- **All EAs offline**: No prices available for any instrument → system gracefully degrades
- **User comes back online**: Real heartbeat resumes → seamlessly switch back to verified data, estimated snapshots stay in history
- **Estimated equity in rankings**: Must be clearly marked — ranking with estimated data should degrade to PROVISIONAL, not RANKED
- **Point value derivation**: Need instrument + lots + entry to compute P/L from price → all available from last known open trades in DB
- **Commission/swap not updated**: Estimated P/L won't include commission/swap changes → minor inaccuracy, acceptable

## 7. Manual test scenarios

1. Connect EA, open trades, see live P/L updating
2. Disconnect EA (close MT) — verify estimated P/L continues updating from price pool
3. Verify equity chart continues with estimated snapshots (different visual style — dashed line?)
4. Verify effective rank continues to penalize open losses from estimated data
5. Reconnect EA — verify seamless switch back to verified data
6. Disconnect EA when no other EA has the same instrument — verify graceful degradation (no estimated data, gap acknowledged)
7. Verify estimated snapshots are labeled in DB (`isEstimated = true`)
8. Verify digest cockpit shows "estimated" indicator when using fallback data

## 8. Done definition

- [ ] Background job runs every 30-60s for stale accounts with open positions
- [ ] Floating P/L estimated from price pool when MT data is stale
- [ ] EquitySnapshot estimated records created (with `isEstimated` flag)
- [ ] Live risk overlay uses estimated floating P/L as fallback
- [ ] Effective rank uses estimated open loss penalty
- [ ] Stale-check moved from external cron to in-process interval
- [ ] Equity chart visually distinguishes estimated vs verified segments
- [ ] UI shows "estimated" indicator on digest/live-risk when using fallback
- [ ] Socket broadcasts continue with estimated data (labeled)
- [ ] All estimation clearly separated from verification-grade data (integrity contract untouched)

## 9. Open questions

1. **Should estimated equity affect leaderboard ranking?** Current thought: yes, but downgrade to PROVISIONAL status
2. **Should we backfill equity snapshots when EA reconnects?** MT can provide exact equity — could fill gaps retroactively
3. **Estimation interval**: 30s (match heartbeat) or 60s (lighter load)?
4. **Should the equity chart show estimated segments differently?** Dashed line vs solid, or a different shade?
5. **Close detection from price pool**: If price crosses known SL, should we flag the trade as "possibly closed"? (Risky — could be a wick that didn't trigger SL on broker)

## 10. Change notes

### 2026-03-12
- Task created from conversation about equity curve gaps when MT is offline
- Deep research identified 13 systems affected by heartbeat loss
- 6 systems can benefit from price-pool fallback: equity snapshots, live risk, effective rank, digest cockpit, socket broadcasts, ranking status
- 2 systems cannot have fallback: signal qualification (strict 20s), trade closure detection (requires MT confirmation)
