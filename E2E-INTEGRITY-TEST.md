# ClanTrader E2E Integrity Test Plan

> Date: March 9, 2026
> Purpose: Verify the trade integrity system works correctly end-to-end with real MetaTrader EA trades.
> Requirement: Markets must be open. MetaTrader 4/5 running with ClanTrader EA connected.

---

## Prerequisites

Before starting, ensure:
- [ ] MetaTrader terminal is running with ClanTrader EA loaded on a chart
- [ ] EA is logged in (green smiley face, "Connected" in EA panel)
- [ ] You are logged into clantrader.com in the browser
- [ ] You are a LEADER or CO_LEADER in at least one clan
- [ ] A demo or live account is connected (demo recommended for testing)
- [ ] Markets are open (forex pairs are moving)

---

## How the System Works (Quick Reference)

A trade counts toward your statement/leaderboard ONLY if ALL 6 conditions pass:

| # | Condition | Rule |
|---|-----------|------|
| 1 | MT-linked | Trade must come from MetaTrader EA |
| 2 | Integrity status | Must not be UNVERIFIED |
| 3 | Resolution source | Must be EA_VERIFIED or EVALUATOR (not manual) |
| 4 | Signal-first | Signal card in chat must exist BEFORE the MT trade opens |
| 5 | Initial risk | Stop Loss must exist when the trade is first created |
| 6 | No duplicates | Same MT ticket cannot count twice |

If any condition fails, the trade is excluded from statements with a specific reason code.

---

## Scenario 1: Happy Path — Full Signal Lifecycle

**Goal:** Verify a complete signal card trade flows correctly from creation to close.

### Steps:
1. In clan chat, post a **Signal card**: e.g., EURUSD LONG, Entry 1.0800, SL 1.0750, TP 1.0900
2. In MetaTrader, open a matching trade: Buy EURUSD at market, set SL to 1.0750 and TP to 1.0900
3. Wait 30 seconds for EA heartbeat to sync
4. In the chat, check if the trade card shows "MT Linked" badge
5. Wait for the trade to close (either manually close it from MT, or let it hit TP/SL)
6. After close, check the trade detail sheet

### Expected Results:
- [ ] Trade card in chat shows blue "MT Linked" badge
- [ ] Trade status updates to the correct outcome (TP_HIT / SL_HIT / CLOSED)
- [ ] `finalRR` is calculated and shown (positive for TP, negative for SL)
- [ ] `netProfit` shows actual profit/loss including commission and swap
- [ ] Integrity section shows no warnings (trade is statement-eligible)
- [ ] A system message appears in chat: "Trade closed — TP Hit (+X.XXR)"
- [ ] Your statement page shows this trade in the list
- [ ] Leaderboard updates with the new R:R

### Failure Indicators:
- Trade card does not show "MT Linked"
- Status stays OPEN after MT trade is closed
- finalRR shows 0 or incorrect value
- Trade is marked as "Not counted in statement"

---

## Scenario 2: EA Auto-Creates Signal Card

**Goal:** Verify that when you open a trade directly in MT (with SL and TP), the EA auto-creates a signal card in chat.

### Steps:
1. Do NOT post a signal card manually in chat
2. In MetaTrader, open a trade: Buy GBPUSD at market, set SL and TP immediately
3. Wait 30 seconds for EA heartbeat

### Expected Results:
- [ ] A new trade card automatically appears in the clan chat
- [ ] Card type is SIGNAL (because both SL and TP were set)
- [ ] Card has note: "Auto-generated from MetaTrader (Ticket #...)"
- [ ] Trade is MT-linked from the start
- [ ] Trade detail shows `integrityStatus: PENDING` (will promote to VERIFIED if all conditions pass)

### Failure Indicators:
- No card appears in chat after 60 seconds
- Card appears but type is ANALYSIS instead of SIGNAL
- Card appears but is not MT-linked

---

## Scenario 3: EA Opens Trade Without SL — Analysis Card Created

**Goal:** Verify that opening a trade WITHOUT a stop loss creates an ANALYSIS card (not SIGNAL), and it is NOT statement-eligible.

### Steps:
1. In MetaTrader, open a trade: Buy XAUUSD at market, do NOT set SL, do NOT set TP
2. Wait 30 seconds for EA heartbeat
3. Check the chat for the new card

### Expected Results:
- [ ] A trade card appears in chat with type ANALYSIS (not SIGNAL)
- [ ] Tag shown is "analysis" (not "signal")
- [ ] Trade detail shows `initialRiskMissing: true`
- [ ] Trade is NOT auto-posted to the channel (only signals auto-post)
- [ ] Trade detail shows the trade is NOT statement-eligible
- [ ] Reason: "NO_INITIAL_RISK"

### Failure Indicators:
- Card type is SIGNAL despite no SL
- Trade is marked as statement-eligible
- Trade is auto-posted to channel

---

## Scenario 4: Analysis Upgrade — Add SL and TP Later

**Goal:** Verify that adding SL + TP to an analysis trade upgrades it to SIGNAL, but it STILL does NOT become statement-eligible (anti-cheat protection).

### Steps:
1. Continue from Scenario 3 (trade is open as ANALYSIS without SL/TP)
2. In MetaTrader, modify the trade to add SL and TP
3. Wait 30 seconds for EA heartbeat to detect the change
4. Check the chat card and trade detail

### Expected Results:
- [ ] Card type changes from ANALYSIS to SIGNAL
- [ ] Tags change from "analysis" to "signal"
- [ ] A system message appears: "Card upgraded from Analysis to Signal"
- [ ] The card is now auto-posted to the channel (if auto-post is enabled)
- [ ] **BUT**: Trade is STILL NOT statement-eligible
- [ ] Reason: "ANALYSIS_UPGRADE" — trade started as analysis, so it can never be eligible
- [ ] Trade detail shows integrity warning about the upgrade

### Why This Matters:
This prevents a cheat where a trader opens a trade, waits to see if it wins, THEN adds SL/TP to make it look like a planned signal. The system remembers the trade started without risk management.

### Failure Indicators:
- Trade becomes statement-eligible after upgrade
- Card type does not change to SIGNAL
- No system message about the upgrade

---

## Scenario 5: SL Removal Warning

**Goal:** Verify that removing a stop loss from an open trade triggers a critical warning.

### Steps:
1. Open a trade in MT with SL and TP (creates a SIGNAL card)
2. Wait for sync (30 seconds)
3. In MetaTrader, modify the trade to REMOVE the SL (set to 0)
4. Wait for EA heartbeat

### Expected Results:
- [ ] A critical system message appears in chat: "Stop Loss removed — trade is now UNPROTECTED"
- [ ] Trade detail shows `riskStatus: UNPROTECTED`
- [ ] The SL on the card changes to 0
- [ ] Channel post (if exists) shows a risk warning

### Note:
Removing SL does NOT retroactively disqualify the trade from statements IF it already had initial risk captured. The integrity contract checks the initial snapshot, not the current state.

### Failure Indicators:
- No warning message appears
- riskStatus still shows PROTECTED
- Card still shows the old SL value

---

## Scenario 6: TP Modification

**Goal:** Verify that changing TP is allowed and doesn't break eligibility.

### Steps:
1. Open a trade in MT with SL and TP (SIGNAL card created)
2. Wait for sync
3. In MetaTrader, change the TP to a different value
4. Wait for EA heartbeat

### Expected Results:
- [ ] Trade card target updates to the new TP value
- [ ] A system message appears about the TP change
- [ ] Trade is still statement-eligible (TP changes are allowed)
- [ ] `tpEverModified` flag is set to true in trade detail

### Failure Indicators:
- TP value doesn't update on card
- Trade becomes ineligible after TP change

---

## Scenario 7: Manual Status Change Kills Eligibility

**Goal:** Verify that manually changing a trade's status from the web UI makes it permanently ineligible.

### Steps:
1. Open a trade in MT with SL and TP (SIGNAL card, MT-linked)
2. Wait for sync and verify it is statement-eligible
3. In the web UI, open the trade detail sheet
4. Click "TP Hit" button (manual status change)
5. Check the trade detail again

### Expected Results:
- [ ] Trade status changes to TP_HIT
- [ ] `integrityStatus` changes to UNVERIFIED
- [ ] `integrityReason` shows MANUAL_OVERRIDE
- [ ] `statementEligible` is now false
- [ ] Trade shows "Not counted in statement" warning
- [ ] This trade does NOT appear in your statement metrics
- [ ] This cannot be undone (permanent exclusion)

### Why This Matters:
This prevents traders from manually claiming wins. Only EA-verified or evaluator-resolved trades count.

### Failure Indicators:
- Trade remains statement-eligible after manual status change
- integrityStatus doesn't change to UNVERIFIED
- Trade still appears in statement calculations

---

## Scenario 8: EA Disconnected During Trade Close

**Goal:** Verify that if the EA is offline when a trade closes in MT, the system catches up when the EA reconnects.

### Steps:
1. Open a trade in MT with SL and TP (SIGNAL card created, MT-linked)
2. In the EA panel, disconnect/disable the EA (or close the chart)
3. Close the trade manually in MT while EA is offline
4. Verify the trade still shows as OPEN on the website
5. Re-enable the EA / reopen the chart
6. Wait for EA to reconnect and sync (heartbeat + history sync up to 5 minutes)

### Expected Results:
- [ ] While EA is offline: trade remains OPEN on the website (no update)
- [ ] After EA reconnects: trade status updates to CLOSED (or TP_HIT/SL_HIT)
- [ ] `finalRR` and `netProfit` are calculated from the actual MT close data
- [ ] System message appears in chat about the trade closure
- [ ] Statement updates with the correct result
- [ ] Sync happens within 5 minutes of EA reconnection (history sync interval)

### Failure Indicators:
- Trade stays OPEN permanently after EA reconnects
- finalRR is incorrect or missing
- Trade is not picked up by history sync

---

## Scenario 9: EA Running But User Not Logged Into Website

**Goal:** Verify that trades are recorded correctly even when the user is not browsing the website.

### Steps:
1. Log out of the website (or close the browser tab)
2. Keep MetaTrader running with EA connected
3. Open a trade in MT with SL and TP
4. Close the trade in MT
5. Wait 2 minutes
6. Log back into the website and go to the clan chat

### Expected Results:
- [ ] Trade card exists in the clan chat (was auto-created while you were offline)
- [ ] Trade shows as closed with correct status
- [ ] `finalRR` and `netProfit` are calculated correctly
- [ ] Trade is statement-eligible (all integrity conditions pass)
- [ ] Statement page reflects this trade

### Why This Matters:
The EA communicates directly with the server via API — it doesn't need the website to be open. Trades are recorded server-side regardless of browser state.

### Failure Indicators:
- No trade card in chat
- Trade exists but is not closed
- Trade is not statement-eligible despite being a proper signal

---

## Scenario 10: Manual Card From Web UI — Never Eligible

**Goal:** Verify that trade cards posted manually (not from EA) are NEVER statement-eligible.

### Steps:
1. In the clan chat, post a Signal card manually: USDJPY SHORT, Entry 150.00, SL 150.50, TP 149.00
2. Click "Track" on the card
3. Open the trade detail sheet
4. Check the integrity section

### Expected Results:
- [ ] Trade shows `integrityStatus: UNVERIFIED`
- [ ] Trade shows `resolutionSource: MANUAL`
- [ ] Trade shows `mtLinked: false`
- [ ] Trade is NOT statement-eligible
- [ ] Reason: "NOT_MT_LINKED" and "UNTRUSTED_RESOLUTION"
- [ ] Trade does NOT appear in statement calculations
- [ ] Manual status buttons (TP Hit, SL Hit, etc.) are visible (since not MT-linked)

### Why This Matters:
Manual cards are for discussion/analysis only. Only EA-verified trades can count toward statements and leaderboards.

### Failure Indicators:
- Manual card trade is statement-eligible
- integrityStatus is anything other than UNVERIFIED

---

## Scenario 11: Duplicate MT Ticket Prevention

**Goal:** Verify that the same MetaTrader ticket cannot be counted twice.

### Steps:
1. Open a trade in MT (creates signal card A in clan 1)
2. Wait for sync
3. If you are in two clans, check if the same ticket appears in both
4. Close the trade
5. Check both clans' trade history

### Expected Results:
- [ ] The MT ticket is linked to only ONE trade record
- [ ] If a second trade somehow exists with the same ticket, it shows reason: "DUPLICATE_MT_TICKET"
- [ ] Only one trade counts in statements

### Note:
This is primarily an integrity safeguard — in normal usage, the EA creates signals in one clan only (the user's first/primary clan). The dedup check is a safety net.

### Failure Indicators:
- Same ticket counted twice in statements
- Two eligible trades exist for the same MT ticket

---

## Scenario 12: Signal-First Rule — Card Must Exist Before Trade

**Goal:** Verify that a signal card created AFTER the MT trade opens does NOT become eligible.

### Steps:
1. Open a trade in MT (EA auto-creates card at T=0)
2. The auto-created card's `createdAt` should match or be after the MT `openTime`
3. Check the trade detail — is the signal-first condition satisfied?

### Expected Results:
- [ ] For EA auto-created cards: the card is created simultaneously with the trade, so timing is correct
- [ ] The signal-first check should pass for EA auto-created cards
- [ ] If you manually create a card AFTER opening a trade, and the EA tries to match it, the condition FAILS

### How to Test the Failure Case:
1. Open a trade in MT
2. Wait for EA auto-create (card A appears)
3. Delete or ignore card A
4. Manually post a new signal card matching the same instrument/direction
5. The manual card should NOT be matched (it was created AFTER the trade opened)

### Failure Indicators:
- A manually-created card (posted after trade open) becomes linked and eligible

---

## Scenario 13: Break Even Detection

**Goal:** Verify that moving SL to entry price correctly shows BREAKEVEN status.

### Steps:
1. Open a trade in MT with SL and TP
2. Wait for sync
3. In the web UI, click "Set BE" on the trade card (or manually move SL to entry in MT)
4. Wait for EA to execute the action (if MT-linked, it routes through EA)

### Expected Results:
- [ ] SL moves to the entry price
- [ ] `riskStatus` shows BREAKEVEN
- [ ] A system message confirms: "Break even set"
- [ ] If trade later closes near entry, outcome is BE (break even)
- [ ] `finalRR` for a BE trade is approximately 0

### Failure Indicators:
- riskStatus doesn't change to BREAKEVEN
- SL doesn't move (pending action times out)

---

## Scenario 14: Locked Profit Detection

**Goal:** Verify that moving SL beyond entry (into profit) shows LOCKED_PROFIT status.

### Steps:
1. Open a BUY trade in MT with SL below entry and TP above entry
2. Wait for sync
3. In MT, move the SL ABOVE the entry price (e.g., if entry is 1.0800, move SL to 1.0820)
4. Wait for EA heartbeat

### Expected Results:
- [ ] `riskStatus` changes to LOCKED_PROFIT
- [ ] System message shows the SL change
- [ ] Trade is still statement-eligible (SL modifications are allowed)
- [ ] If trade closes at SL, the result is positive R:R (profit was locked)

### Failure Indicators:
- riskStatus shows PROTECTED instead of LOCKED_PROFIT
- riskStatus shows UNPROTECTED

---

## Scenario 15: Multiple Open Trades — Independent Tracking

**Goal:** Verify that multiple simultaneous trades are tracked independently.

### Steps:
1. Open 3 trades simultaneously in MT:
   - Trade A: EURUSD LONG with SL + TP
   - Trade B: GBPUSD SHORT with SL + TP
   - Trade C: XAUUSD LONG without SL (analysis)
2. Wait for all 3 to appear in chat
3. Close Trade A (let it hit TP)
4. Close Trade B (let it hit SL)
5. Add SL + TP to Trade C, then close it

### Expected Results:
- [ ] Three separate trade cards appear in chat
- [ ] Trade A: SIGNAL, eligible, positive R:R
- [ ] Trade B: SIGNAL, eligible, negative R:R
- [ ] Trade C: ANALYSIS → upgraded to SIGNAL, but NOT eligible (started as analysis)
- [ ] Statement shows only Trade A and Trade B
- [ ] Leaderboard correctly sums both R:R values

### Failure Indicators:
- Trades interfere with each other
- Trade C counts in statement despite starting as ANALYSIS
- Missing trades in chat

---

## Scenario 16: Close Price Accuracy — finalRR Verification

**Goal:** Verify that the `finalRR` calculation matches the actual R:R from the trade numbers.

### Steps:
1. Open a trade in MT: Buy EURUSD @ 1.0800, SL 1.0750, TP 1.0900
   - Risk = 1.0800 - 1.0750 = 50 pips
2. Close the trade at a known price (e.g., 1.0850)
3. Calculate expected R:R manually:
   - Reward = 1.0850 - 1.0800 = 50 pips
   - R:R = 50 / 50 = 1.00R
4. Check the trade detail on the website

### Expected Results:
- [ ] `closePrice` matches the MT close price
- [ ] `finalRR` matches your manual calculation (within rounding)
- [ ] Formula: `finalRR = (closePrice - initialEntry) / initialRiskAbs` (for LONG)
- [ ] For SHORT: `finalRR = (initialEntry - closePrice) / initialRiskAbs`
- [ ] `netProfit` = MT profit + commission + swap

### Failure Indicators:
- finalRR is significantly different from manual calculation
- closePrice doesn't match MT terminal
- netProfit is wrong or missing

---

## Scenario 17: Win Rate Based on finalRR, Not Status Label

**Goal:** Verify that the win rate calculation uses the actual R:R, not the status label.

### Steps:
1. Open a trade with TP at +2R
2. Close it manually in MT at -0.3R (a small loss, even though you might expect it to be TP_HIT based on proximity rules)
3. Check if it counts as a WIN or LOSS in your statement

### Expected Results:
- [ ] If `finalRR < 0`, the trade counts as a LOSS regardless of status label
- [ ] If `finalRR > 0`, the trade counts as a WIN regardless of status label
- [ ] If `finalRR = 0`, the trade counts as BREAK EVEN
- [ ] Statement win rate = wins / (wins + losses + break-evens)

### Why This Matters:
The system uses actual P&L, not what the trader claims. A trade labeled "TP_HIT" with negative R:R is still a loss.

### Failure Indicators:
- Win rate counts trades by status label instead of finalRR value
- A negative R:R trade counts as a win

---

## Scenario 18: Rapid Open/Close — Race Condition Test

**Goal:** Verify that very fast trades (open and close within seconds) are handled correctly.

### Steps:
1. Open a trade in MT with SL and TP
2. Close it almost immediately (within 5-10 seconds)
3. Check the chat and trade detail

### Expected Results:
- [ ] Signal card appears in chat
- [ ] Trade is closed with correct status
- [ ] No duplicate cards or duplicate close events
- [ ] Trade detail shows all fields correctly

### Failure Indicators:
- Duplicate trade cards appear
- Trade stays OPEN
- Multiple close events recorded

---

## Scenario 19: Weekend/Market Closed Behavior

**Goal:** Verify behavior when markets are closed (this is a reference scenario — test during weekend if needed).

### Steps:
1. Note any trades that were open when markets closed Friday
2. Check their status on Saturday/Sunday

### Expected Results:
- [ ] Open trades remain OPEN (no false closes)
- [ ] Live R:R shows last known price (frozen)
- [ ] No spurious system messages

### Failure Indicators:
- Trades auto-close on weekends
- False TP/SL hit detection from stale prices

---

## Final Verification Checklist

After completing all scenarios, verify the overall system state:

### Statement Accuracy
- [ ] Go to your statement page
- [ ] Count eligible trades — matches the number of EA-verified SIGNAL trades that closed
- [ ] Win rate matches: wins (finalRR > 0) / total eligible trades
- [ ] Total R matches sum of all finalRR values from eligible trades
- [ ] No manual trades or analysis trades appear in statements

### Leaderboard Consistency
- [ ] Leaderboard rankings use the same data as statements
- [ ] Your clan's stats reflect the correct aggregate

### Integrity Contract Summary
- [ ] EA-created SIGNAL trades with SL → statement-eligible (Scenarios 1, 2)
- [ ] EA-created ANALYSIS trades → NOT eligible, even after upgrade (Scenarios 3, 4)
- [ ] Manual web UI trades → NEVER eligible (Scenario 10)
- [ ] Manual status changes → permanently kills eligibility (Scenario 7)
- [ ] SL removal → warning shown, but doesn't retroactively disqualify (Scenario 5)
- [ ] Disconnected trades → catch up on reconnect (Scenarios 8, 9)
- [ ] Duplicate tickets → only one counts (Scenario 11)

---

## Test Results Log

| # | Scenario | Pass/Fail | Notes |
|---|----------|-----------|-------|
| 1 | Happy path — full signal lifecycle | | |
| 2 | EA auto-creates signal card | | |
| 3 | EA trade without SL — analysis card | | |
| 4 | Analysis upgrade — add SL/TP later | | |
| 5 | SL removal warning | | |
| 6 | TP modification | | |
| 7 | Manual status change kills eligibility | | |
| 8 | EA disconnected during trade close | | |
| 9 | EA running, user not logged in | | |
| 10 | Manual card — never eligible | | |
| 11 | Duplicate MT ticket prevention | | |
| 12 | Signal-first rule | | |
| 13 | Break even detection | | |
| 14 | Locked profit detection | | |
| 15 | Multiple open trades | | |
| 16 | Close price / finalRR accuracy | | |
| 17 | Win rate based on finalRR | | |
| 18 | Rapid open/close race condition | | |
| 19 | Weekend/market closed behavior | | |
| -- | Statement accuracy check | | |
| -- | Leaderboard consistency check | | |
