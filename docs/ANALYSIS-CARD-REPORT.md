> **Status:** ACTIVE
> **Last reviewed:** 2026-03-10
> **Authority:** SOURCE_OF_TRUTH.md
> **Notes:** Accurate technical reference for analysis vs signal card system.

# Analysis Card System — Technical Report

> Date: March 9, 2026
> Scope: How ANALYSIS cards are created, rendered, tracked in Trader Journal, and handled in the Digest system.

---

## 1. What Is an Analysis Card?

An ANALYSIS card is a trade idea posted without full risk parameters (missing SL and/or TP). It exists as a **non-statement-eligible** personal tracking tool — a way to document market observations without committing to an official signal.

**CardType enum** (`prisma/schema.prisma`):
```
enum CardType {
  SIGNAL     -- Full signal: SL + TP required, counts toward statement
  ANALYSIS   -- Observation: SL/TP optional, never counts toward statement
}
```

Both the `TradeCard` model (the chat card) and the `Trade` model (the lifecycle record) carry a `cardType` field.

---

## 2. Creation Paths

### 2a. Manual Creation (Web UI)

**Component:** `src/components/chat/AnalysisCardComposerDialog.tsx`

- Any clan member can create an ANALYSIS card (no role restriction)
- Only LEADER / CO_LEADER can create SIGNAL cards
- SL and TP are optional for ANALYSIS, required for SIGNAL
- Emits `SEND_TRADE_CARD` socket event with `cardType: "ANALYSIS"`

**Validation** (`src/lib/validators.ts:363-395`):
- SIGNAL: `stopLoss > 0`, `targets[0] > 0`, price ordering enforced
- ANALYSIS: `stopLoss` and `targets` can be 0; if both present, ordering is validated

### 2b. EA Auto-Creation (MetaTrader)

**Service:** `src/services/ea-signal-create.service.ts:39-42`

```typescript
const hasSL = (mtTrade.stopLoss ?? 0) > 0;
const hasTP = (mtTrade.takeProfit ?? 0) > 0;
const cardType = hasSL && hasTP ? "SIGNAL" : "ANALYSIS";
```

- Trade opened with SL + TP → auto-creates **SIGNAL** card
- Trade opened missing either → auto-creates **ANALYSIS** card
- EA-created trades get `integrityStatus: "PENDING"`, `resolutionSource: "EA_VERIFIED"`, `mtLinked: true`
- Manual-created trades get `integrityStatus: "UNVERIFIED"`, `resolutionSource: "MANUAL"`

### 2c. Tags

**Service:** `src/services/trade-card.service.ts:44-54`

Tags are auto-injected and mutually exclusive:
- ANALYSIS → `["analysis"]` (removes any "signal" tag)
- SIGNAL → `["signal"]` (removes any "analysis" tag)

---

## 3. Analysis-to-Signal Upgrade

**Service:** `src/services/ea-signal-modify.service.ts:136-178`

When a trader adds SL + TP to an existing ANALYSIS trade via MetaTrader:

1. Card type changes from ANALYSIS → SIGNAL
2. Tags update from `["analysis"]` → `["signal"]`
3. `initialRiskAbs` snapshot is captured at upgrade time
4. A `INTEGRITY_FLAG` event is logged with reason `ANALYSIS_UPGRADE`
5. `computeAndSetEligibility()` is called

**Critical rule:** Even after upgrade, the trade remains **NOT statement-eligible** because `initialRiskMissing` was `true` at creation. The integrity engine's Condition 5 (`NO_INITIAL_RISK`) blocks it permanently. This prevents the exploit of opening without risk, seeing the outcome, then adding SL/TP retroactively.

---

## 4. Chat Display

**Component:** `src/components/chat/TradeCardInline.tsx`

| Aspect | ANALYSIS | SIGNAL |
|--------|----------|--------|
| Accent bar color | Blue (`bg-blue-500`) | Green (LONG) / Red (SHORT) |
| Background gradient | Blue (`from-blue-500/5`) | Green / Red |
| Badge | "Analysis" badge (blue outline) | None |
| Auto-post to channel | No | Yes (if feature flag enabled) |

---

## 5. Trader Journal

**Service:** `src/services/journal.service.ts:450-469`
**UI:** `src/components/journal/JournalDashboard.tsx`

The journal has **two separate tabs**:

### Signals Tab (default, `trackedOnly=true`)
```typescript
where.integrityStatus = "VERIFIED";
where.statementEligible = true;
where.cardType = "SIGNAL";
where.tradeCard = { tags: { hasSome: ["signal"] } };
```
Strict quality gates — only fully verified, eligible SIGNAL trades appear.

### Analysis Tab (`cardType="ANALYSIS"`)
```typescript
where.cardType = "ANALYSIS";
```
No integrity or eligibility gates — all ANALYSIS cards appear. The tab includes a disclaimer: *"These trades are for personal tracking only."*

**Key point:** ANALYSIS trades are visible in the journal for the trader's own review, but they are **completely excluded** from the official statement.

---

## 6. Official Statement (Leaderboard)

**Service:** `src/services/statement-calc.service.ts:5-43`

The `getEligibleTrades()` function enforces all 5 filters simultaneously:

```typescript
return db.trade.findMany({
  where: {
    userId,
    clanId,
    status: { in: ["TP_HIT", "SL_HIT", "BE", "CLOSED"] },
    integrityStatus: "VERIFIED",
    statementEligible: true,
    cardType: "SIGNAL",              // ← explicit ANALYSIS exclusion
    tradeCard: { tags: { hasSome: ["signal"] } },
  },
});
```

**ANALYSIS cards have zero impact on:**
- Win rate
- Average R multiple
- Total R
- Best/worst R
- Trade count
- Instrument/direction/tag distributions
- Seasonal rankings

### R Calculation Formula (statement)

```typescript
// src/services/statement-calc.service.ts:45-54
function calculateRMultiple(status, entry, stopLoss, targets, initialRiskAbs, finalRR) {
  if (finalRR != null) return finalRR;                    // EA-verified value
  const risk = initialRiskAbs > 0 ? initialRiskAbs : Math.abs(entry - stopLoss);
  if (risk === 0) return 0;
  // Fallback by status: TP_HIT → positive R, SL_HIT → -1, BE → 0
}
```

Only SIGNAL trades reach this calculation.

---

## 7. Integrity Engine

**Service:** `src/services/integrity.service.ts:35-136`

The 6-condition deny-by-default check:

| # | Condition | Code | Why ANALYSIS Fails |
|---|-----------|------|--------------------|
| 1 | MT-linked | `trade.mtLinked` | Manual ANALYSIS cards are not MT-linked |
| 2 | Not UNVERIFIED | `integrityStatus !== "UNVERIFIED"` | Manual cards start as UNVERIFIED |
| 3 | Trusted resolution | `resolutionSource ∈ [EA_VERIFIED, EVALUATOR]` | Manual cards have MANUAL source |
| 4 | Signal-first | `cardCreated <= mtOpen` | N/A if not MT-linked |
| 5 | Initial risk exists | `initialStopLoss > 0 && !initialRiskMissing` | **ANALYSIS cards start without SL** |
| 6 | No duplicate ticket | Unique MT ticket | N/A if not MT-linked |

Even EA-created ANALYSIS cards fail Condition 5 because `initialRiskMissing = true` and `initialStopLoss = 0`.

**Reason codes relevant to ANALYSIS:**
- `NO_INITIAL_RISK` — started without stop loss
- `ANALYSIS_UPGRADE` — was upgraded but integrity memory persists
- `CARD_TYPE_ANALYSIS` — card type is ANALYSIS

---

## 8. Digest System

**Service:** `src/services/clan-digest.service.ts:45-274`
**UI:** `src/components/chat/DigestSheet.tsx`
**API:** `src/app/api/clans/[clanId]/digest/route.ts`

### Query — No Card Type Filter

```typescript
const trades = await db.trade.findMany({
  where: {
    clanId,
    OR: [
      { createdAt: { gte: periodStart } },
      { closedAt: { gte: periodStart } },
    ],
    // ⚠️ No cardType filter — both SIGNAL and ANALYSIS are fetched
  },
});
```

### Separate Counting

```typescript
if (t.cardType === "SIGNAL") entry.signalCount++;
else entry.analysisCount++;
```

The digest tracks signals and analyses separately in the counts.

### Aggregate Metrics — ANALYSIS IS INCLUDED

```
totalCards = totalSignals + totalAnalysis
winRate = (wins / (wins + losses)) * 100
avgR = totalR / countWithR
```

**Both SIGNAL and ANALYSIS trades contribute to:**
- `wins` / `losses` (based on R value: positive R = win, negative R = loss)
- `totalR` (sum of all R values)
- `avgR` (average R across all trades with R)
- `winRate` (win percentage)
- `tpHit` / `slHit` / `be` / `openCount`

### R Formula (digest)

**Utility:** `src/lib/trade-r.ts:28-63`

```typescript
function getR(trade: TradeRow): number | null {
  if (trade.finalRR != null) return trade.finalRR;
  // closePrice-based: R = (closePrice - entry) / riskAbs (direction-adjusted)
  // Fallback by status: TP_HIT → positive R, SL_HIT → -1, BE → 0
}
```

Same formula as statement, but applied to ALL card types.

### UI Display

- **Summary:** Shows `totalSignals` and `totalAnalysis` as separate cards
- **Per-member:** Displays as `5S / 3A` format (Signals / Analysis)
- **Aggregate metrics** (winRate, avgR, totalR): Combine both types

---

## 9. Design Discrepancy: Statement vs Digest

| Metric | Statement | Digest |
|--------|-----------|--------|
| ANALYSIS included? | **No** — hard-excluded via `cardType: "SIGNAL"` | **Yes** — included in all aggregate metrics |
| Win rate | SIGNAL only | SIGNAL + ANALYSIS combined |
| Avg R | SIGNAL only | SIGNAL + ANALYSIS combined |
| Total R | SIGNAL only | SIGNAL + ANALYSIS combined |
| Purpose | Official record, leaderboard ranking | Informal daily/weekly/monthly overview |

**This is a deliberate design choice:** the digest is meant as a quick activity overview ("what happened today"), while the statement is the official, auditable trading record. However, this means the digest's winRate and avgR can differ from the statement's values for the same trader in the same period.

**Potential concern:** If a clan's digest shows a 70% win rate but the statement shows 55%, the discrepancy could confuse users. The digest UI does display signal/analysis counts separately, but the aggregate metrics blend them without a visual disclaimer.

---

## 10. Summary: Analysis Card Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  CREATION                                                    │
│  ├─ Manual (any member) → ANALYSIS, UNVERIFIED, MANUAL      │
│  └─ EA (no SL/TP)       → ANALYSIS, PENDING, EA_VERIFIED    │
│                                                              │
│  CHAT                                                        │
│  └─ Blue accent bar + "Analysis" badge                       │
│                                                              │
│  UPGRADE (SL+TP added later)                                 │
│  ├─ CardType: ANALYSIS → SIGNAL                              │
│  ├─ Tags: ["analysis"] → ["signal"]                          │
│  ├─ initialRiskMissing stays TRUE (anti-cheat memory)        │
│  └─ Still NOT statement-eligible (integrity Condition 5)     │
│                                                              │
│  JOURNAL                                                     │
│  ├─ Signals tab: excluded (strict quality gates)             │
│  └─ Analysis tab: included (personal tracking only)          │
│                                                              │
│  STATEMENT / LEADERBOARD                                     │
│  └─ Completely excluded: cardType="SIGNAL" filter            │
│                                                              │
│  DIGEST                                                      │
│  ├─ Included in aggregate metrics (winRate, avgR, totalR)    │
│  └─ Counted separately: signalCount vs analysisCount         │
│                                                              │
│  INTEGRITY ENGINE                                            │
│  └─ Fails Condition 5 (NO_INITIAL_RISK) permanently         │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Key File Reference

| Area | File | Lines |
|------|------|-------|
| Schema | `prisma/schema.prisma` | CardType enum, TradeCard.cardType, Trade.cardType |
| Manual creation UI | `src/components/chat/AnalysisCardComposerDialog.tsx` | Full dialog |
| Socket handler | `src/lib/socket-handlers/trade-handlers.ts` | 31-132 |
| Card service | `src/services/trade-card.service.ts` | 37-80 |
| EA auto-creation | `src/services/ea-signal-create.service.ts` | 39-42, 71-87 |
| Upgrade flow | `src/services/ea-signal-modify.service.ts` | 136-178 |
| Chat rendering | `src/components/chat/TradeCardInline.tsx` | 84, 108-138 |
| Validators | `src/lib/validators.ts` | 363-395 |
| Integrity engine | `src/services/integrity.service.ts` | 35-136 |
| Statement calc | `src/services/statement-calc.service.ts` | 5-43, 45-54 |
| Journal filtering | `src/services/journal.service.ts` | 450-469 |
| Journal UI | `src/components/journal/JournalDashboard.tsx` | 30, 38-40 |
| Digest service | `src/services/clan-digest.service.ts` | 62-107, 165-225 |
| Digest UI | `src/components/chat/DigestSheet.tsx` | 116-133, 173-178 |
| R calculation | `src/lib/trade-r.ts` | 28-63 |
| Exploit tests | `src/services/__tests__/exploit-regression.test.ts` | 119-177 |
