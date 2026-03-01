# Integrity Contract — Testing Checklist

All loopholes identified during the security audit, with the fix applied and how to verify each one.

---

## Test Accounts

| Role      | Description                        |
|-----------|------------------------------------|
| TRADER    | Has MT account connected, clan member |
| SPECTATOR | No MT account, can create manual trades |
| ADMIN     | Can access admin panel             |

---

## 1. Default-Verified Trades (CRITICAL)

**Loophole:** Trades were born with `integrityStatus: VERIFIED` and `statementEligible: true`. Any trade created through any path automatically counted in statements.

**Fix:** Defaults flipped to `integrityStatus: PENDING` and `statementEligible: false`. Trades must earn eligibility through the 6-condition check.

### How to test:
- [ ] Open the chat in a clan, create a new trade card (SIGNAL type) via the UI
- [ ] Check the database: `SELECT "integrityStatus", "statementEligible" FROM "Trade" WHERE id = '<new-trade-id>'`
- [ ] Verify: `integrityStatus = 'UNVERIFIED'` and `statementEligible = false` (because it's a manual/socket trade)
- [ ] The trade card should show the orange **"Not Counted"** badge

---

## 2. Analysis-to-Signal Upgrade Gaming (CRITICAL)

**Loophole:** User opens a position in MT without SL/TP → we create an ANALYSIS card. The trade plays out. If it's a winner, user adds SL+TP → card upgrades to SIGNAL and `statementEligible` flips to `true`. This is selection bias — cherry-picking winners.

**Fix:** When ANALYSIS upgrades to SIGNAL, `cardType` changes but `statementEligible` stays `false`. A TradeEvent is logged with reason `ANALYSIS_UPGRADE`.

### How to test:
- [ ] Connect MT account, open a position with NO SL and NO TP
- [ ] Verify an ANALYSIS card is created with `statementEligible = false`
- [ ] Now add SL and TP to the MT position (via EA sync)
- [ ] Verify the card type changes to SIGNAL in the UI
- [ ] Check DB: `statementEligible` should still be `false`
- [ ] Check `TradeEvent` table: should have an event with `ANALYSIS_UPGRADE` in the newValue JSON
- [ ] The trade card should still show the **"Not Counted"** badge

---

## 3. Retroactive / Late Signal Card (CRITICAL)

**Loophole:** Signal matcher used `Math.abs(time difference)`, so a card created AFTER the MT trade opened could still match. User sees a winning trade, then posts a signal card retroactively.

**Fix:** Changed to directional check: `mtOpenTime - cardCreatedAt`. If the result is negative (card created after trade), the match is rejected. Window tightened from 60 minutes to 5 minutes.

### How to test:
- [ ] Create a trade card (SIGNAL) in the chat
- [ ] Wait more than 5 minutes
- [ ] Open a matching position in MT (same instrument, direction, similar entry price)
- [ ] Check: the signal matcher should NOT match them (time window exceeded)
- [ ] Alternatively, check the DB — the Trade should remain unlinked (`mtLinked = false`)
- [ ] Try the reverse: open MT position first, THEN create a signal card after
- [ ] Check: the matcher rejects it because card was created after trade opened

---

## 4. Manual Trades Counting in Statements (HIGH)

**Loophole:** Manual `trackTrade()` and socket-based trade creation set `integrityStatus: VERIFIED` and `statementEligible: !isAnalysis` (true for SIGNAL cards). Users could create fake signal cards, manually track them, and manually set status to TP_HIT.

**Fix:** All manual/socket trades are created with `integrityStatus: UNVERIFIED`, `statementEligible: false`, `resolutionSource: MANUAL`.

### How to test:
- [ ] In the chat, create a SIGNAL trade card
- [ ] Click "Track" to start tracking it manually
- [ ] Check DB: `integrityStatus = 'UNVERIFIED'`, `statementEligible = false`, `resolutionSource = 'MANUAL'`
- [ ] Use the trade actions menu to close the trade or change status to TP_HIT
- [ ] Check DB: `statementEligible` should still be `false`
- [ ] Go to Statements page — this trade should NOT appear in the eligible trades count

---

## 5. Admin Override Bypasses Integrity (HIGH)

**Loophole:** Admin could toggle `statementEligible: true` on any trade, even UNVERIFIED ones. The API only showed a warning, not a hard block.

**Fix:** Admin endpoint returns `422 Unprocessable Entity` when trying to enable eligibility on non-VERIFIED trades. Hard block, not a warning.

### How to test:
- [ ] Create a manual trade (will be UNVERIFIED)
- [ ] As ADMIN, go to admin panel and try to toggle statement eligibility ON for this trade
- [ ] **Expected:** API returns 422 with message: "Trade integrity is UNVERIFIED. Only VERIFIED trades can be statement-eligible."
- [ ] Test via curl:
  ```bash
  curl -X PATCH https://clantrader.com/api/admin/trades/<tradeId>/statement-eligibility \
    -H "Content-Type: application/json" \
    -d '{"statementEligible": true, "reason": "test"}' \
    -b "<admin-session-cookie>"
  ```
- [ ] Verify 422 response with `reasons: ["INTEGRITY_UNVERIFIED"]`
- [ ] Now try on a VERIFIED trade — should succeed with 200

---

## 6. TP Dragging / Moving Before Close (HIGH)

**Loophole:** User moves TP to match where price already is, then close is recorded as TP_HIT with inflated R:R. The `MOVE_SL`, `SET_BE`, `CHANGE_TP` actions didn't track that modifications happened.

**Fix:** Added `tpEverModified` and `slEverModified` boolean fields. SET_BE, MOVE_SL, CHANGE_TP actions now set these flags. EA sync modifications also track them.

### How to test:
- [ ] Open a trade via MT (EA creates the card)
- [ ] Move SL in MetaTrader → EA syncs the change
- [ ] Check DB: `slEverModified = true`
- [ ] Move TP in MetaTrader → EA syncs
- [ ] Check DB: `tpEverModified = true`
- [ ] Alternatively, use the in-app trade actions menu: "Move SL", "Set BE", "Change TP"
- [ ] Verify the corresponding flags are set in the DB

---

## 7. Status-Label-Based Win Rate Gaming (MEDIUM)

**Loophole:** Win rate was calculated as `count(TP_HIT) / resolved`. A trade could be TP_HIT by label (close price near TP) but actually have negative R:R (e.g., TP was moved after entry). Conversely, a CLOSED trade with positive R:R wouldn't count as a win.

**Fix:** Win rate now uses outcome-based calculation: `finalRR > 0` = win, `finalRR < 0` = loss, `finalRR = 0` = breakeven. Status labels are ignored for win rate.

### How to test:
- [ ] Find or create a trade with status `TP_HIT` but `finalRR < 0` (edge case — TP was close to entry)
- [ ] Find or create a trade with status `CLOSED` but `finalRR > 0` (closed manually in profit)
- [ ] Run statement calculation for the user
- [ ] Check the statement: the TP_HIT with negative R:R should count as a **loss**, the CLOSED with positive R:R should count as a **win**
- [ ] Win rate should be based on R:R outcome, not status labels

---

## 8. EA Close Action Blind Eligibility (MEDIUM)

**Loophole:** When the EA close action completed (`ea-action.service.ts`), it blindly set `statementEligible: true` and `integrityStatus: VERIFIED` on the trade, regardless of whether the trade was legitimately eligible.

**Fix:** Removed the blind eligibility assignment. After EA close, `computeAndSetEligibility()` is called to properly evaluate all 6 conditions.

### How to test:
- [ ] Create a manual trade (UNVERIFIED, ineligible)
- [ ] Somehow trigger an EA close action on it (if MT-linked later)
- [ ] Check DB after close: `statementEligible` should still be `false` if the trade doesn't meet all 6 conditions
- [ ] For a properly EA-created trade, close via MT → should properly evaluate and set eligibility

---

## 9. Duplicate MT Ticket Counting (MEDIUM)

**Loophole:** The same MT position (ticket number) could potentially be matched to multiple trade cards, each counting separately in statements. Double-counting inflates trade count and potentially win rate.

**Fix:** The `computeAndSetEligibility()` function checks condition 6: no other eligible trade has the same MT ticket. If a duplicate is found, the trade gets reason code `DUPLICATE_MT_TICKET`.

### How to test:
- [ ] Check DB for any trades sharing the same MT ticket:
  ```sql
  SELECT t."id", t."statementEligible", mt."ticket"
  FROM "Trade" t
  JOIN "MtTrade" mt ON mt."matchedTradeId" = t."id"
  GROUP BY mt."ticket", t."id", t."statementEligible"
  HAVING COUNT(*) > 1;
  ```
- [ ] If duplicates exist, only one should have `statementEligible = true`

---

## 10. No Initial Risk Snapshot (MEDIUM)

**Loophole:** Trades created without a stop loss have no risk baseline. R:R calculations become meaningless or gameable because `initialRiskAbs` is 0 or null.

**Fix:** Condition 5 of the eligibility check: `initialStopLoss > 0 && !initialRiskMissing`. Trades without initial SL get reason code `NO_INITIAL_RISK`.

### How to test:
- [ ] Open a MT position with NO stop loss
- [ ] Verify the created trade has `initialRiskMissing = true` and `initialStopLoss = 0`
- [ ] Check: `statementEligible = false` with reason `NO_INITIAL_RISK`
- [ ] The "Not Counted" badge should appear on the trade card

---

## 11. syncSignalClose Overwriting Eligibility (MEDIUM)

**Loophole:** When a trade closed via EA (`syncSignalClose`), it set `statementEligible: !isAnalysis` — blindly granting eligibility to any SIGNAL card on close, even if it was never properly verified.

**Fix:** The close update no longer sets `statementEligible`. After close, `computeAndSetEligibility()` re-evaluates properly.

### How to test:
- [ ] Have an ANALYSIS card trade that gets closed via MT
- [ ] Check: `statementEligible` should remain `false` after close
- [ ] Have a properly verified SIGNAL card trade close via MT
- [ ] Check: `statementEligible` should remain `true` (it was already eligible)

---

## 12. Untrusted Resolution Source (LOW)

**Loophole:** Trades resolved manually (user clicks "Close" or changes status) could still be counted if they were previously eligible.

**Fix:** The CLOSE and STATUS_CHANGE actions in `trade-action.service.ts` already set `integrityStatus: UNVERIFIED`, `resolutionSource: MANUAL`, `statementEligible: false`. This was correct before; verify it still works.

### How to test:
- [ ] Have an eligible, MT-linked trade
- [ ] Use the in-app "Close" action (not MT close)
- [ ] Check DB: `integrityStatus = 'UNVERIFIED'`, `statementEligible = false`, `resolutionSource = 'MANUAL'`

---

## UI Verification

### "Not Counted" Badge
- [ ] Open a clan chat with trade cards
- [ ] Trades with `statementEligible = false` should show an orange **"Not Counted"** badge
- [ ] Hover/tap the badge — tooltip should say "This trade is excluded from statements and competition"

### Trade Detail Sheet — Integrity Section
- [ ] Click on an ineligible trade card to open the detail sheet
- [ ] Should see the orange "Not Counted" section at the bottom
- [ ] Should list "Why is this excluded?" with the specific reason codes in the user's language
- [ ] Test in both English and Persian (switch language in settings)

### Statements Page
- [ ] Navigate to Statements page for a user who has both eligible and ineligible trades
- [ ] Verify only eligible trades are counted in the statistics
- [ ] Win rate should reflect outcome-based calculation (finalRR), not status labels

---

## Database Quick Checks

Run these queries to verify the migration and backfill:

```sql
-- 1. No open trades should be VERIFIED (they should be PENDING)
SELECT COUNT(*) as "open_verified_should_be_zero"
FROM "Trade"
WHERE "integrityStatus" = 'VERIFIED'
  AND "status" IN ('OPEN', 'PENDING')
  AND "finalRR" IS NULL;

-- 2. Resolved trades with finalRR should still be VERIFIED
SELECT COUNT(*) as "resolved_verified"
FROM "Trade"
WHERE "integrityStatus" = 'VERIFIED'
  AND "finalRR" IS NOT NULL;

-- 3. All trades should have openedAt backfilled
SELECT COUNT(*) as "missing_openedAt_should_be_zero"
FROM "Trade"
WHERE "openedAt" IS NULL;

-- 4. Default check: new trades should get PENDING/false
-- (Create a test trade and verify)

-- 5. Manual trades should all be UNVERIFIED
SELECT COUNT(*) as "manual_verified_should_be_zero"
FROM "Trade"
WHERE "resolutionSource" = 'MANUAL'
  AND "statementEligible" = true;
```

---

## Issues Log

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Default-Verified | | |
| 2 | Analysis Upgrade | | |
| 3 | Late Signal Card | | |
| 4 | Manual Trades | | |
| 5 | Admin Override | | |
| 6 | TP Dragging | | |
| 7 | Win Rate | | |
| 8 | EA Close Blind | | |
| 9 | Duplicate Ticket | | |
| 10 | No Initial Risk | | |
| 11 | Close Overwrite | | |
| 12 | Untrusted Resolution | | |
| UI | Not Counted Badge | | |
| UI | Detail Sheet Reasons | | |
| UI | Statements Page | | |
| DB | Migration Queries | | |
