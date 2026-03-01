-- AlterTable: Add new integrity contract fields to Trade
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "eligibleAtOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "openReceivedAt" TIMESTAMP(3);
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "tpEverModified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "slEverModified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Change defaults for deny-by-default trust model
ALTER TABLE "Trade" ALTER COLUMN "integrityStatus" SET DEFAULT 'PENDING';
ALTER TABLE "Trade" ALTER COLUMN "statementEligible" SET DEFAULT false;

-- Backfill: Move open VERIFIED trades (no final result yet) to PENDING
UPDATE "Trade"
SET "integrityStatus" = 'PENDING'::"IntegrityStatus"
WHERE "integrityStatus" = 'VERIFIED'
  AND "finalRR" IS NULL
  AND "status" NOT IN ('TP_HIT', 'SL_HIT', 'BE', 'CLOSED');

-- Backfill: Set eligibleAtOpen from existing statementEligible
UPDATE "Trade"
SET "eligibleAtOpen" = "statementEligible";

-- Backfill: Set openedAt from entryFilledAt or createdAt
UPDATE "Trade"
SET "openedAt" = COALESCE("entryFilledAt", "createdAt"),
    "openReceivedAt" = "createdAt";
