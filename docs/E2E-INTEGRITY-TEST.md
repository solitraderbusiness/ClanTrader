# ClanTrader E2E Integrity Test Plan

> Date: March 9, 2026 (updated March 9, 2026 — single-statement architecture scenarios added)
> Purpose: Verify the trade integrity system works correctly end-to-end with real MetaTrader EA trades.
> Requirement: Markets must be open. MetaTrader 4/5 running with ClanTrader EA connected.

**Operational note:** The EA sends a heartbeat every 10 seconds, so after each MT action, wait 10-30 seconds before judging the result, unless you're intentionally testing reconnect/history catch-up.

---

## Before You Start

- [ ] Log in to ClanTrader
- [ ] Make sure your user is LEADER or CO_LEADER in a clan
- [ ] Make sure at least one MT account is linked and the EA is connected
- [ ] Use a demo account if possible
- [ ] Confirm markets are open and moving
- [ ] Take a baseline screenshot of:
  - Clan chat
  - Statement page
  - Leaderboard
  - MT terminal open trades / history
- [ ] Create a simple test log with: scenario number, ticket, symbol, direction, entry / SL / TP, expected, actual, pass/fail, screenshot links

---

## How the System Works (Quick Reference)

A trade counts toward your statement/leaderboard ONLY if ALL 7 conditions pass:

| # | Condition | Rule |
|---|-----------|------|
| 1 | MT-linked | Trade must come from MetaTrader EA |
| 2 | Integrity status | Must not be UNVERIFIED |
| 3 | Resolution source | Must be EA_VERIFIED or EVALUATOR (not manual) |
| 4 | Signal-first | Signal card in chat must exist BEFORE the MT trade opens |
| 5 | Initial risk | Stop Loss must exist when the trade is first created |
| 6 | No duplicates | Same MT ticket cannot count twice |
| 7 | **Signal qualified** | **SL + TP must be set within 20 seconds of MT open (the "qualification window")** |

If any condition fails, the trade is excluded from statements with a specific reason code.

### New Concepts (Single-Statement Architecture)

| Concept | How It Works |
|---------|-------------|
| **20-second qualification window** | From the moment MT opens the trade, you have exactly 20 seconds to have both SL and TP set. If met, the trade becomes `officialSignalQualified` and a frozen risk snapshot is taken. If missed, the trade becomes ANALYSIS permanently. |
| **Frozen official risk snapshot** | At qualification, `officialEntryPrice`, `officialInitialStopLoss`, `officialInitialTargets`, `officialInitialRiskAbs`, and `officialInitialRiskMoney` are locked. These NEVER change after qualification, even if you move SL/TP later. |
| **Effective Rank R** | `effectiveRankR = closedOfficialR + sum(min(0, liveFloatingR))`. Open gains contribute 0. Open losses penalize your rank immediately. |
| **Live Open Risk overlay** | Shows floating R, floating PnL, equity drawdown, biggest loser, unprotected count, stale warning — auto-refreshes every 30 seconds on profile. |
| **Tracking status** | Per MT account: ACTIVE (<60s since heartbeat), STALE (60-120s), TRACKING_LOST (>120s). Affects ranking eligibility. |
| **Ranking eligibility** | RANKED (all accounts healthy), PROVISIONAL (stale account with open trades), UNRANKED (tracking lost with open trades). |
| **Profit factor** | `sum(positive R) / |sum(negative R)|` — displayed in closed performance block. |

---

## Best Execution Order

Run them in this order so you don't waste time:

1. **Baseline prep**
2. **Scenarios 1-7** — core contract first
3. **Scenarios 13-18** — live action/risk second
4. **Scenarios 20-25** — nasty real-world bugs third
5. **Scenarios 8-12** — disconnect/reconnect
6. **Scenarios 26-29** — admin/config/aggregation last
7. **Scenarios 30-41** — single-statement architecture (qualification window, live risk, effective rank, tracking)
8. **Final statement/leaderboard reconciliation**

---

## Scenario 1: Happy Path — Manual Signal First, Then MT Trade

### Do:
1. In clan chat, post a signal card manually with exact entry, SL, and TP
2. Open the matching MT trade immediately with the same symbol, direction, SL, and TP
3. Wait 10-30 seconds
4. Close the trade at TP or manually at a known price
5. Open the trade detail sheet, statement page, and leaderboard

### Expect:
- [ ] Trade becomes MT-linked
- [ ] Correct open/close status
- [ ] Correct `finalRR`
- [ ] Correct `netProfit`
- [ ] No integrity warning
- [ ] Counted in statement
- [ ] Leaderboard updates once

---

## Scenario 2: EA Auto-Creates a Signal Card

### Do:
1. Do not post anything in chat
2. Open an MT trade with SL and TP already set
3. Wait 10-30 seconds

### Expect:
- [ ] A new signal card appears automatically
- [ ] It is MT-linked from the start
- [ ] It is treated as a signal, not analysis
- [ ] Detail page shows it as evaluator/EA-driven, not manual
- [ ] `officialSignalQualified` = true (qualified AT_OPEN since SL+TP were present)
- [ ] Official frozen snapshot is set (entry, SL, TP, risk abs)

---

## Scenario 3: Open MT Trade Without SL — Analysis Card

### Do:
1. Open an MT trade with no SL and no TP
2. Wait 10-30 seconds
3. Check the card and detail page

### Expect:
- [ ] Card type is ANALYSIS
- [ ] Live P&L may still show
- [ ] Trade is not statement-eligible
- [ ] Integrity reason points to missing initial risk
- [ ] `officialSignalQualified` = false
- [ ] `qualificationDeadline` is set to openTime + 20 seconds

---

## Scenario 4: Add SL/TP Later to That Analysis Trade (After 20s Window)

### Do:
1. Continue from Scenario 3 — **wait at least 25 seconds** after the MT trade opened
2. Add SL and TP in MT
3. Wait 10-30 seconds for sync

### Expect:
- [ ] Card upgrades visually from analysis to signal
- [ ] Upgrade event is logged
- [ ] Trade still does NOT become `officialSignalQualified` (window expired)
- [ ] Trade is not statement-eligible — integrity reason includes `NOT_SIGNAL_QUALIFIED`
- [ ] Anti-cheat memory of "missed qualification window" is permanent — no way to undo

---

## Scenario 5: Remove SL After Starting Correctly

### Do:
1. Open a normal MT signal with SL/TP
2. Wait for sync
3. Remove the SL in MT
4. Wait for sync

### Expect:
- [ ] Critical warning or clear warning state
- [ ] Risk status becomes UNPROTECTED
- [ ] Current card SL updates to 0/empty
- [ ] Eligibility should not be retroactively destroyed — the frozen `officialInitialStopLoss` is still set
- [ ] Live open risk overlay shows this trade in `unprotectedCount`

---

## Scenario 6: Modify TP After Open

### Do:
1. Open a normal MT signal with SL/TP
2. Wait for sync
3. Change only TP in MT
4. Wait for sync

### Expect:
- [ ] TP updates on the card
- [ ] Modification event is logged
- [ ] Trade remains eligible

---

## Scenario 7: Manual Status Override From Web UI Kills Eligibility

### Do:
1. Open a valid MT-linked trade
2. Confirm it looks eligible
3. In the web UI, manually press TP Hit / SL Hit / Closed
4. Refresh trade detail and statement

### Expect:
- [ ] Trade becomes unverified / ineligible
- [ ] Integrity reason reflects manual override
- [ ] It no longer counts in statement metrics

---

## Scenario 8: EA Disconnected While Trade Closes

### Do:
1. Open a valid MT-linked trade
2. Disable EA or close the chart
3. Close the trade in MT while EA is offline
4. Confirm website still shows OPEN
5. Re-enable EA and wait for reconnect/history sync

### Expect:
- [ ] Site remains stale while EA is offline
- [ ] After reconnect, trade catches up correctly
- [ ] Final status, `finalRR`, and `netProfit` reconcile to MT history
- [ ] Statement updates once

---

## Scenario 9: User Logged Out / Browser Closed

### Do:
1. Close the browser or log out
2. Keep EA running
3. Open and close a valid MT trade
4. Return to the site later

### Expect:
- [ ] Card exists even though browser was closed
- [ ] Closure is already synced
- [ ] Trade is eligible if all integrity rules passed

---

## Scenario 10: Manual Web Card Only — Never Eligible

### Do:
1. Post a signal card manually from the web UI
2. Track it
3. Never connect it to a real MT trade

### Expect:
- [ ] It stays manual/unverified
- [ ] It never affects statement or leaderboard
- [ ] Manual action buttons remain available

---

## Scenario 11: Duplicate MT Ticket Prevention

### Do:
1. Open one MT trade and let it sync
2. Watch for any accidental duplicate records after refreshes/reconnects
3. If you can reproduce duplicate rendering, close the trade and inspect both entries

### Expect:
- [ ] One MT ticket maps to one counted trade
- [ ] Any duplicate visual artifact must not count twice
- [ ] Statement contribution stays single

---

## Scenario 12: Signal-First Rule — Late Manual Card Must Not Hijack the Trade

### Do:
1. Open an MT trade first
2. Wait for the EA-created card to appear
3. Then manually post another matching signal card after the trade is already open
4. Inspect which card is linked

### Expect:
- [ ] The late manual card does not become the valid counted record
- [ ] No after-the-fact card should become eligible

---

## Scenario 13: Breakeven Detection

### Do:
1. Open a valid MT signal
2. Move SL to entry using MT or the web "Set BE" action
3. Wait for sync

### Expect:
- [ ] Risk state becomes BREAKEVEN
- [ ] SL equals entry
- [ ] Event is logged
- [ ] If trade closes near entry, `finalRR` is around 0

---

## Scenario 14: Locked Profit Detection

### Do:
1. Open a valid MT signal
2. Move SL beyond entry into profit
3. Wait for sync

### Expect:
- [ ] Risk state becomes LOCKED_PROFIT
- [ ] Modification event is logged
- [ ] Trade remains eligible

---

## Scenario 15: Multiple Open Trades at Once

### Do:
1. Open three trades:
   - One valid signal
   - One valid signal
   - One no-SL analysis
2. Modify and close them independently

### Expect:
- [ ] Each trade updates independently
- [ ] Valid signals count
- [ ] Analysis-start trade stays ineligible even if later upgraded
- [ ] Statement totals only include eligible trades

---

## Scenario 16: Long-Side finalRR Accuracy

### Do:
1. Open a BUY with known numbers
2. Close at a known manual price
3. Calculate expected R manually
4. Compare with ClanTrader

### Expect:
- [ ] `closePrice` matches MT
- [ ] `finalRR` matches your manual calculation within rounding
- [ ] `netProfit` matches MT profit after fees/swap

---

## Scenario 17: Win/Loss Classification Based on Actual Result, Not Label

### Do:
1. Create a trade where the label might be misleading
2. Close it at a small loss or small win manually
3. Check statement win rate

### Expect:
- [ ] Negative `finalRR` counts as loss
- [ ] Positive `finalRR` counts as win
- [ ] Zero-ish `finalRR` counts as breakeven
- [ ] Statement math uses actual result, not cosmetic status wording

---

## Scenario 18: Very Fast Open/Close Race Condition

### Do:
1. Open a trade with SL/TP
2. Close it within a few seconds
3. Refresh chat and detail repeatedly

### Expect:
- [ ] No duplicate cards
- [ ] No stuck OPEN state
- [ ] One clean close event
- [ ] Single statement contribution

---

## Scenario 19: Weekend / Market-Closed Behavior

### Do:
1. Leave a trade open into market close, or test when market is closed
2. Check chat and detail page later

### Expect:
- [ ] Trade does not false-close
- [ ] Last known values freeze
- [ ] No fake TP/SL hit generated from stale price

---

## Scenario 20: SELL-Path Parity Test

> Important because the product supports both Long and Short directions and tracks R:R by direction.

### Do:
1. Run one full clean scenario using a SELL trade, not BUY
2. Preferably use something like USDJPY or XAUUSD
3. Open, modify, and close it at a known price

### Expect:
- [ ] Short-side math is correct
- [ ] SL/TP logic is inverted correctly for sell
- [ ] `finalRR`, live R:R, and status all behave correctly

---

## Scenario 21: Multiple TP Targets + Partial Close

> The docs say signal cards support multiple targets.

### Do:
1. Create a trade/card with TP1 and TP2 if your UI supports it
2. Partially close at TP1
3. Leave the rest open
4. Move SL after TP1
5. Close the remainder later

### Expect:
- [ ] The card/history remains coherent
- [ ] Partial realization does not create duplicate counted trades
- [ ] Final statement contribution happens once
- [ ] Final P&L reflects the actual MT result

**Honesty note:** The docs confirm multiple targets, but they do not fully define the exact partial-close UI wording. The must-pass standard is: no double counting, no broken lifecycle, and correct final accounting.

---

## Scenario 22: Same Symbol, Same Direction, Two Tickets Open Together

> One of the nastiest real bugs in trading systems.

### Do:
1. Open EURUSD BUY ticket A
2. A few seconds later open EURUSD BUY ticket B
3. Modify only B
4. Close only A
5. Then close B

### Expect:
- [ ] Events attach to the correct ticket
- [ ] A's close does not mutate B
- [ ] B's SL/TP change does not leak into A
- [ ] Statement counts both separately and correctly

---

## Scenario 23: Web Action -> Pending EA Action -> MT Execution Round-Trip

> The docs describe server-to-EA pending actions like "set breakeven."

### Do:
1. Open a valid MT-linked trade
2. From the web UI, trigger a supported action like Set BE
3. Watch both the site and MT terminal
4. Repeat once with EA offline if possible

### Expect:
- [ ] Action becomes pending first
- [ ] EA executes it on MT
- [ ] UI shows success only after MT-side execution/sync
- [ ] If EA is offline, it should not pretend success immediately

---

## Scenario 24: Multi-Account Isolation

> The docs say multiple MT accounts are supported, with per-account connection status.

### Do:
1. Link two MT accounts to the same user
2. Open a trade on account A
3. Open another trade on account B
4. Reconnect only one EA if you can
5. Check account pages, trade detail, statement, and logs

### Expect:
- [ ] Each trade remains tied to the correct MT account
- [ ] Heartbeat/reconnect for one account does not mutate the other
- [ ] Balances/equity/connection status remain separated
- [ ] Statement aggregation behaves as intended

---

## Scenario 25: Reconnect Replay / Idempotency

### Do:
1. Open a valid trade
2. Disconnect EA
3. Reconnect it
4. Disconnect and reconnect again
5. Refresh after multiple sync cycles

### Expect:
- [ ] No duplicate close event
- [ ] No duplicate statement contribution
- [ ] No duplicate system messages
- [ ] Final state remains stable after repeated replay opportunities

---

## Scenario 26: Admin Override Governance + Permissions

> The docs mention admin override governance and full trade-event audit trails.

### Do:
1. Try an override with a normal user who should not have that power
2. Then test with the proper admin role if available
3. Inspect trade events / audit logs afterward

### Expect:
- [ ] Unauthorized users cannot do governed overrides
- [ ] Authorized override is clearly logged
- [ ] Audit trail shows who changed what and when
- [ ] Overridden trades do not silently look identical to clean EA-verified trades

---

## Scenario 27: Feature Flag Behavior

> Auto-post from trades is feature-flag gated.

### Do:
1. Note current relevant flag states
2. Test one auto-post scenario with flag ON
3. Toggle OFF in admin if safe
4. Repeat with the same kind of trade

### Expect:
- [ ] With flag ON: expected auto-post behavior happens
- [ ] With flag OFF: no auto-post happens
- [ ] Integrity/statement logic should not silently depend on the wrong flag state

---

## Scenario 28: Aggregation Boundaries — Clan, Season, Monthly, All-Time

> Stats are auto-recalculated monthly, seasonal, and all-time. Statements are per trader per clan from verified trades only, with seasonal rankings and a minimum trade threshold.

### Do:
1. Note your current trade counts and statement totals
2. Add one clean eligible trade
3. Check:
   - Clan statement
   - Seasonal ranking
   - Monthly stats
   - All-time stats
4. If possible, test around the minimum-trade threshold boundary

### Expect:
- [ ] Only verified trades are counted
- [ ] Data lands in the correct clan/season bucket
- [ ] Monthly / seasonal / all-time numbers reconcile
- [ ] Qualification threshold behaves correctly just before and after crossing it

---

## Scenario 29: Edit/Delete Linked Card After MT Linkage

> Signal/analysis cards have version history and trade lifecycle is immutable.

### Do:
1. Create a valid MT-linked trade
2. Edit the card text if editing is allowed
3. If deletion exists, test it carefully in staging/dev only
4. Re-check trade detail, integrity, statement, and event history

### Expect:
- [ ] Presentation edits do not erase underlying evidence
- [ ] Immutable trade history remains intact
- [ ] Statement eligibility does not reset accidentally

**Honesty note:** The docs support version history and immutable lifecycle, but they do not spell out the exact delete behavior. Treat this as a high-value integrity probe, especially in staging.

---

## Scenario 30: 20-Second Qualification Window — Instant Qualification (AT_OPEN)

> The most common happy path: trade opens with SL+TP already set.

### Do:
1. Open an MT trade with both SL and TP set from the start
2. Wait 10-30 seconds for sync
3. Check the trade in the database or trade detail

### Expect:
- [ ] `officialSignalQualified` = true
- [ ] `officialSignalOriginType` = "AT_OPEN"
- [ ] `officialQualifiedAt` is set to around the open time
- [ ] Frozen snapshot fields are set: `officialEntryPrice`, `officialInitialStopLoss`, `officialInitialTargets`, `officialInitialRiskAbs`
- [ ] These frozen values match the initial SL/TP/entry at the moment of qualification

---

## Scenario 31: 20-Second Qualification Window — Within Window (WITHIN_WINDOW)

> Trade opens without SL, but SL+TP are added within the 20-second window.

### Do:
1. Open an MT trade with NO SL and NO TP
2. **Within 15 seconds**, add both SL and TP in MT
3. Wait for the next heartbeat (10-30 seconds)
4. Check qualification status

### Expect:
- [ ] `officialSignalQualified` = true
- [ ] `officialSignalOriginType` = "WITHIN_WINDOW"
- [ ] Card type upgrades from ANALYSIS to SIGNAL
- [ ] Frozen snapshot reflects the SL/TP/entry at the moment of qualification
- [ ] Trade IS statement-eligible (all 7 conditions pass)

---

## Scenario 32: 20-Second Qualification Window — Expired (Permanent ANALYSIS)

> Trade opens without SL, and 20 seconds pass before SL+TP are added.

### Do:
1. Open an MT trade with NO SL and NO TP
2. **Wait at least 25 seconds** (well past the 20-second window)
3. Now add both SL and TP in MT
4. Wait for sync

### Expect:
- [ ] `officialSignalQualified` remains false forever
- [ ] Card may upgrade visually to SIGNAL, but integrity check still fails
- [ ] Trade is NOT statement-eligible — reason: `NOT_SIGNAL_QUALIFIED`
- [ ] This is permanent — no way to fix a missed window after the fact

---

## Scenario 33: Frozen Official Snapshot Immutability

> After qualification, the official risk snapshot must NEVER change, even if the trader moves SL/TP later.

### Do:
1. Open a trade with SL=100 and TP=200 (or appropriate values for your instrument)
2. Wait for qualification (check `officialSignalQualified` = true)
3. Note the frozen values: `officialEntryPrice`, `officialInitialStopLoss`, `officialInitialTargets`
4. Move SL in MT to a different value (e.g., SL=110)
5. Move TP in MT to a different value (e.g., TP=250)
6. Wait for sync
7. Check the frozen fields again

### Expect:
- [ ] Current SL/TP on the card update to new values (110/250)
- [ ] `officialInitialStopLoss` still shows original value (100)
- [ ] `officialInitialTargets` still shows original value ([200])
- [ ] `officialEntryPrice` unchanged
- [ ] `officialInitialRiskAbs` unchanged
- [ ] Statement R calculations use the FROZEN values, not the current SL/TP

---

## Scenario 34: Trader Statement 3-Block UI on Profile Page

### Do:
1. Have at least one qualified closed trade and one qualified open trade
2. Navigate to `/profile/[your-userId]`
3. Inspect the TraderStatementView component

### Expect:
- [ ] **Block A: Official Closed Performance** shows: trade count, win rate, avg R, total R, profit factor, best R, worst R, W/L/BE breakdown
- [ ] **Block B: Live Open Risk** shows: open trade count, floating R, floating PnL, equity drawdown %, max drawdown %, biggest loser R, unprotected count
- [ ] **Block C: Effective Rank** shows: closed R + open penalty = effective R
- [ ] Only `officialSignalQualified` trades appear in Block A metrics
- [ ] Analysis trades and unqualified trades are excluded
- [ ] Live data auto-refreshes (check values change over ~30 seconds if trades are open)

---

## Scenario 35: Effective Rank R — Open Loss Penalizes Rank

> The core ranking formula: open gains don't help, open losses penalize immediately.

### Do:
1. Note your current closed official R (from statement Block A or the API)
2. Open a qualified trade that goes into loss (floating R < 0)
3. Wait for live risk to update (~30 seconds)
4. Check Block C on your profile

### Expect:
- [ ] `closedOfficialR` stays the same as before
- [ ] `openRiskPenalty` shows a negative number (the sum of your open losing R)
- [ ] `effectiveRankR` = closedOfficialR + openRiskPenalty (lower than closedR)
- [ ] Leaderboard shows the penalized `effectiveRankR`, not the closed R

---

## Scenario 36: Effective Rank R — Open Gain Does NOT Boost Rank

### Do:
1. Note your current effective rank
2. Open a qualified trade that goes into profit (floating R > 0)
3. Wait for live risk to update

### Expect:
- [ ] `openRiskPenalty` is 0 (positive floating R contributes 0, not a bonus)
- [ ] `effectiveRankR` equals `closedOfficialR` exactly
- [ ] Leaderboard rank does NOT improve from unrealized gains

---

## Scenario 37: Tracking Status — ACTIVE / STALE / TRACKING_LOST

> Per-account heartbeat freshness determines tracking status.

### Do:
1. With EA running, check your MT account's `trackingStatus` — should be ACTIVE
2. Disable the EA (close the chart or kill MT)
3. Wait 60-90 seconds
4. Check `trackingStatus` — should be STALE
5. Wait another 60 seconds (total ~120+ seconds offline)
6. Check `trackingStatus` — should be TRACKING_LOST
7. Re-enable EA and wait for one heartbeat
8. Check `trackingStatus` — should return to ACTIVE

### Expect:
- [ ] ACTIVE when heartbeat is <60 seconds old
- [ ] STALE when heartbeat is 60-120 seconds old
- [ ] TRACKING_LOST when heartbeat is >120 seconds old
- [ ] Recovers to ACTIVE immediately on next heartbeat
- [ ] Live Open Risk block shows stale warning when account is STALE or TRACKING_LOST

---

## Scenario 38: Ranking Eligibility — PROVISIONAL and UNRANKED

> Stale/tracking-lost accounts with open official trades degrade ranking status.

### Do:
1. Have a qualified open trade running
2. Disable the EA
3. Wait until `trackingStatus` becomes TRACKING_LOST (>120 seconds)
4. Trigger the stale-check endpoint: `POST /api/admin/stale-check` (as admin)
5. Check your `TraderStatement.rankingStatus`

### Expect:
- [ ] With TRACKING_LOST + open official trades → `rankingStatus` = "UNRANKED"
- [ ] With STALE + open official trades → `rankingStatus` = "PROVISIONAL"
- [ ] With all accounts ACTIVE → `rankingStatus` = "RANKED"
- [ ] Re-enable EA, wait for ACTIVE, re-run stale-check → should return to RANKED

---

## Scenario 39: Equity Drawdown Tracking

### Do:
1. Note your MT account's current equity and `peakEquity` in the database
2. Let equity increase above the peak (winning trade or deposit)
3. Wait for a heartbeat
4. Check `peakEquity` — should update to new high
5. Let equity drop (losing trade)
6. Wait for a heartbeat

### Expect:
- [ ] `peakEquity` tracks the highest equity seen
- [ ] `peakEquity` never decreases (it's a high-water mark)
- [ ] `maxDrawdownPct` = `(peakEquity - lowestEquitySincePeak) / peakEquity * 100`
- [ ] `maxDrawdownMoney` tracks the absolute money amount of worst drawdown
- [ ] Live Open Risk block shows `currentEquityDrawdownPct` and `maxEquityDrawdownPct`

---

## Scenario 40: Risk Money Backfill on Heartbeat

> When a trade qualifies, `officialInitialRiskMoney` may be null if there's no price movement yet. It gets filled on subsequent heartbeats.

### Do:
1. Open a trade with SL+TP (qualifies AT_OPEN)
2. Check `officialInitialRiskMoney` immediately after qualification — may be null
3. Wait for 2-3 heartbeats while price moves
4. Check `officialInitialRiskMoney` again

### Expect:
- [ ] `officialInitialRiskMoney` eventually gets filled (once price moves enough to compute dollarPerPoint)
- [ ] Once set, it does not change on subsequent heartbeats
- [ ] Formula: `dollarPerPoint = |profit / priceMove|`, then `riskMoney = dollarPerPoint * riskAbs`

---

## Scenario 41: Statement API — 3-Block JSON Response

### Do:
1. Call `GET /api/users/[userId]/trader-statement?clanId=[clanId]`
2. Inspect the JSON response

### Expect:
- [ ] Response has three blocks: `closedPerformance`, `liveOpenRisk`, `effectiveRank`
- [ ] `closedPerformance` contains: `totalTrades`, `winRate`, `avgRMultiple`, `totalRMultiple`, `profitFactor`, `bestR`, `worstR`, `wins`, `losses`, `breakevens`, `signalCount`
- [ ] `liveOpenRisk` contains: `openOfficialCount`, `liveFloatingPnl`, `liveFloatingR`, `currentEquityDrawdownPct`, `maxEquityDrawdownPct`, `biggestOpenLoserR`, `unprotectedCount`, `staleWarning`, `lastUpdate`
- [ ] `effectiveRank` contains: `closedOfficialR`, `openRiskPenalty`, `effectiveRankR`
- [ ] `effectiveRankR` = `closedOfficialR` + `openRiskPenalty`
- [ ] Only `officialSignalQualified` trades are included in closed performance metrics
- [ ] Returns 401 for unauthenticated requests

---

## Final Reconciliation

After all scenarios, do one full audit pass:

- [ ] Count all trades you created
- [ ] Mark which ones should be eligible (must pass all 7 conditions including signal qualification)
- [ ] Compare with the statement list
- [ ] Sum expected `finalRR` of eligible trades only
- [ ] Compare with leaderboard totals (should use `effectiveRankR`, not raw `totalR`)
- [ ] Check that no manual-only or analysis-start trades slipped in
- [ ] Check that no trade counted twice
- [ ] Verify unqualified trades (missed 20s window) are permanently excluded
- [ ] Verify frozen official snapshots did not change after SL/TP modifications
- [ ] Verify effective rank penalizes open losses but not open gains

---

## Launch-Blocking Bugs

If you hit any of these, **stop and fix before moving on:**

- [ ] A manual override still counts in statement
- [ ] An analysis-start trade becomes eligible later
- [ ] Duplicate ticket gets counted twice
- [ ] Same-symbol concurrent tickets cross-wire
- [ ] Pending web action shows success before EA actually executes
- [ ] Reconnect replay duplicates close events or statement contributions
- [ ] Multi-account trades contaminate each other
- [ ] Monthly/seasonal/all-time totals disagree
- [ ] A trade that missed the 20-second window later becomes `officialSignalQualified`
- [ ] Frozen official snapshot values change after SL/TP modification
- [ ] Open profitable trades boost effective rank (should contribute 0, not positive)
- [ ] `effectiveRankR` does not match `closedOfficialR + openRiskPenalty` formula
- [ ] Tracking status does not recover to ACTIVE after EA reconnects
- [ ] Stale-check endpoint crashes or returns wrong counts

---

## Test Results Log

| # | Scenario | Ticket | Symbol | Direction | Entry/SL/TP | Expected | Actual | Pass/Fail | Notes |
|---|----------|--------|--------|-----------|-------------|----------|--------|-----------|-------|
| 1 | Happy path — manual signal first | | | | | | | | |
| 2 | EA auto-creates signal card | | | | | | | | |
| 3 | MT trade without SL — analysis | | | | | | | | |
| 4 | Add SL/TP later — upgrade | | | | | | | | |
| 5 | Remove SL warning | | | | | | | | |
| 6 | Modify TP | | | | | | | | |
| 7 | Manual status override | | | | | | | | |
| 8 | EA disconnected during close | | | | | | | | |
| 9 | User logged out | | | | | | | | |
| 10 | Manual web card only | | | | | | | | |
| 11 | Duplicate ticket prevention | | | | | | | | |
| 12 | Signal-first rule | | | | | | | | |
| 13 | Breakeven detection | | | | | | | | |
| 14 | Locked profit detection | | | | | | | | |
| 15 | Multiple open trades | | | | | | | | |
| 16 | Long-side finalRR accuracy | | | | | | | | |
| 17 | Win/loss by actual result | | | | | | | | |
| 18 | Fast open/close race | | | | | | | | |
| 19 | Weekend behavior | | | | | | | | |
| 20 | SELL-path parity | | | | | | | | |
| 21 | Multiple TP + partial close | | | | | | | | |
| 22 | Same symbol, two tickets | | | | | | | | |
| 23 | Web action -> EA round-trip | | | | | | | | |
| 24 | Multi-account isolation | | | | | | | | |
| 25 | Reconnect replay idempotency | | | | | | | | |
| 26 | Admin override governance | | | | | | | | |
| 27 | Feature flag behavior | | | | | | | | |
| 28 | Aggregation boundaries | | | | | | | | |
| 29 | Edit/delete linked card | | | | | | | | |
| 30 | 20s window — instant qualification (AT_OPEN) | | | | | | | | |
| 31 | 20s window — within window (WITHIN_WINDOW) | | | | | | | | |
| 32 | 20s window — expired (permanent ANALYSIS) | | | | | | | | |
| 33 | Frozen snapshot immutability | | | | | | | | |
| 34 | Statement 3-block UI on profile | | | | | | | | |
| 35 | Effective rank — open loss penalizes | | | | | | | | |
| 36 | Effective rank — open gain does NOT boost | | | | | | | | |
| 37 | Tracking status ACTIVE/STALE/TRACKING_LOST | | | | | | | | |
| 38 | Ranking eligibility PROVISIONAL/UNRANKED | | | | | | | | |
| 39 | Equity drawdown tracking | | | | | | | | |
| 40 | Risk money backfill on heartbeat | | | | | | | | |
| 41 | Statement API 3-block JSON | | | | | | | | |
| -- | Final reconciliation | | | | | | | | |
