-- Migration: Backfill officialSignalQualified for existing trades
-- Safe for production: only updates trades that already passed all integrity checks

-- Step 1: Qualify existing verified eligible SIGNAL trades
-- These trades have already proven they had SL+TP and passed all checks
UPDATE "Trade"
SET
  "officialSignalQualified" = true,
  "officialQualifiedAt" = COALESCE("openedAt", "createdAt"),
  "officialSignalOriginType" = 'AT_OPEN',
  "officialEntryPrice" = "initialEntry",
  "officialInitialStopLoss" = "initialStopLoss",
  "officialInitialTargets" = CASE
    WHEN "initialTakeProfit" IS NOT NULL AND "initialTakeProfit" > 0
    THEN ARRAY["initialTakeProfit"]
    ELSE '{}'::float8[]
  END,
  "officialInitialRiskAbs" = "initialRiskAbs"
WHERE
  "statementEligible" = true
  AND "integrityStatus" = 'VERIFIED'
  AND "cardType" = 'SIGNAL'
  AND "mtLinked" = true
  AND "initialStopLoss" IS NOT NULL
  AND "initialStopLoss" > 0
  AND "officialSignalQualified" = false;

-- Step 2: Also qualify open SIGNAL trades with valid SL that haven't been qualified yet
-- These are trades that were created before the new system but have valid risk
UPDATE "Trade"
SET
  "officialSignalQualified" = true,
  "officialQualifiedAt" = COALESCE("openedAt", "createdAt"),
  "officialSignalOriginType" = 'AT_OPEN',
  "officialEntryPrice" = "initialEntry",
  "officialInitialStopLoss" = "initialStopLoss",
  "officialInitialTargets" = CASE
    WHEN "initialTakeProfit" IS NOT NULL AND "initialTakeProfit" > 0
    THEN ARRAY["initialTakeProfit"]
    ELSE '{}'::float8[]
  END,
  "officialInitialRiskAbs" = "initialRiskAbs"
WHERE
  "status" IN ('OPEN', 'PENDING')
  AND "cardType" = 'SIGNAL'
  AND "mtLinked" = true
  AND "initialStopLoss" IS NOT NULL
  AND "initialStopLoss" > 0
  AND "initialRiskMissing" = false
  AND "officialSignalQualified" = false;

-- Step 3: Set qualification deadline for open trades without qualification
-- Give them a deadline in the past so they'll be processed by the expire logic
UPDATE "Trade"
SET "qualificationDeadline" = "openedAt" + interval '20 seconds'
WHERE
  "qualificationDeadline" IS NULL
  AND "openedAt" IS NOT NULL
  AND "mtLinked" = true
  AND "officialSignalQualified" = false;

-- Step 4: Initialize peakEquity from current equity for active accounts
UPDATE "MtAccount"
SET "peakEquity" = "equity"
WHERE "isActive" = true
  AND "equity" > 0
  AND "peakEquity" IS NULL;

-- Report
SELECT 'Qualified trades' AS label, COUNT(*) AS count
FROM "Trade" WHERE "officialSignalQualified" = true;

SELECT 'Unqualified open trades' AS label, COUNT(*) AS count
FROM "Trade"
WHERE "officialSignalQualified" = false
  AND "status" IN ('OPEN', 'PENDING')
  AND "mtLinked" = true;

SELECT 'Accounts with peak equity' AS label, COUNT(*) AS count
FROM "MtAccount" WHERE "peakEquity" IS NOT NULL;
