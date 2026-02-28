-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('SIGNAL', 'ANALYSIS');

-- AlterTable
ALTER TABLE "TradeCard" ADD COLUMN "cardType" "CardType" NOT NULL DEFAULT 'SIGNAL';

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN "cardType" "CardType" NOT NULL DEFAULT 'SIGNAL';
