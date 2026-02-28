-- DropIndex
DROP INDEX "MtAccount_userId_accountNumber_broker_key";

-- AlterTable
ALTER TABLE "TradingStatement" ADD COLUMN     "mtAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MtAccount_accountNumber_broker_key" ON "MtAccount"("accountNumber", "broker");

-- CreateIndex
CREATE INDEX "TradingStatement_mtAccountId_idx" ON "TradingStatement"("mtAccountId");

-- AddForeignKey
ALTER TABLE "TradingStatement" ADD CONSTRAINT "TradingStatement_mtAccountId_fkey" FOREIGN KEY ("mtAccountId") REFERENCES "MtAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
