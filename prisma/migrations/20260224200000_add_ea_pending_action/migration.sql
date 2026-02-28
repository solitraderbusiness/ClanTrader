-- CreateEnum
CREATE TYPE "EaActionStatus" AS ENUM ('PENDING', 'SENT', 'EXECUTED', 'FAILED', 'TIMED_OUT');

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN "mtLinked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EaPendingAction" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "mtAccountId" TEXT NOT NULL,
    "actionType" "TradeActionType" NOT NULL,
    "newValue" TEXT,
    "note" TEXT,
    "requestedById" TEXT NOT NULL,
    "status" "EaActionStatus" NOT NULL DEFAULT 'PENDING',
    "mtTicket" BIGINT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EaPendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EaPendingAction_mtAccountId_status_idx" ON "EaPendingAction"("mtAccountId", "status");

-- CreateIndex
CREATE INDEX "EaPendingAction_tradeId_idx" ON "EaPendingAction"("tradeId");

-- CreateIndex
CREATE INDEX "EaPendingAction_status_expiresAt_idx" ON "EaPendingAction"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "EaPendingAction" ADD CONSTRAINT "EaPendingAction_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EaPendingAction" ADD CONSTRAINT "EaPendingAction_mtAccountId_fkey" FOREIGN KEY ("mtAccountId") REFERENCES "MtAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
