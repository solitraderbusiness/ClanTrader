-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('PROTECTED', 'BREAKEVEN', 'LOCKED_PROFIT', 'UNPROTECTED');

-- CreateEnum
CREATE TYPE "TradeEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterEnum
ALTER TYPE "TradeActionType" ADD VALUE 'SL_REMOVED';
ALTER TYPE "TradeActionType" ADD VALUE 'TP_REMOVED';

-- AlterTable: Trade - add initial risk snapshot fields
ALTER TABLE "Trade" ADD COLUMN "initialEntry" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "initialStopLoss" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "initialTakeProfit" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "initialRiskAbs" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "initialRiskMissing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trade" ADD COLUMN "riskStatus" "RiskStatus" NOT NULL DEFAULT 'PROTECTED';
ALTER TABLE "Trade" ADD COLUMN "wasEverCounted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trade" ADD COLUMN "countedAt" TIMESTAMP(3);

-- AlterTable: TradeEvent - add severity and source
ALTER TABLE "TradeEvent" ADD COLUMN "severity" "TradeEventSeverity";
ALTER TABLE "TradeEvent" ADD COLUMN "source" TEXT;

-- Backfill: populate initial risk snapshot from TradeCard values
UPDATE "Trade" t SET
  "initialEntry" = tc."entry",
  "initialStopLoss" = tc."stopLoss",
  "initialTakeProfit" = COALESCE(tc."targets"[1], 0),
  "initialRiskAbs" = CASE WHEN tc."stopLoss" > 0 THEN ABS(tc."entry" - tc."stopLoss") ELSE 0 END,
  "initialRiskMissing" = CASE WHEN tc."stopLoss" <= 0 THEN true ELSE false END,
  "riskStatus" = CASE WHEN tc."stopLoss" <= 0 THEN 'UNPROTECTED'::"RiskStatus" ELSE 'PROTECTED'::"RiskStatus" END
FROM "TradeCard" tc WHERE t."tradeCardId" = tc."id" AND t."initialEntry" IS NULL;

-- Backfill: mark already-counted trades
UPDATE "Trade" SET "wasEverCounted" = true, "countedAt" = "createdAt"
WHERE "statementEligible" = true AND "status" IN ('TP_HIT', 'SL_HIT', 'BE', 'CLOSED');
