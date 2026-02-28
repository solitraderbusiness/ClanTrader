-- AlterTable: Trade - add final result fields
ALTER TABLE "Trade" ADD COLUMN "closePrice" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "finalRR" DOUBLE PRECISION;
ALTER TABLE "Trade" ADD COLUMN "netProfit" DOUBLE PRECISION;
