-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'TRADE_CARD', 'SYSTEM_SUMMARY');

-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'TP1_HIT', 'TP2_HIT', 'SL_HIT', 'BE', 'CLOSED');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "topicId" TEXT,
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'TEXT';

-- CreateTable
CREATE TABLE "ChatTopic" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "TopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeCard" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "entry" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "targets" DOUBLE PRECISION[],
    "timeframe" TEXT NOT NULL,
    "riskPct" DOUBLE PRECISION,
    "note" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeCardVersion" (
    "id" TEXT NOT NULL,
    "tradeCardId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "entry" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "targets" DOUBLE PRECISION[],
    "timeframe" TEXT NOT NULL,
    "riskPct" DOUBLE PRECISION,
    "note" TEXT,
    "tags" TEXT[],
    "editedById" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeCardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "tradeCardId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeStatusHistory" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "fromStatus" "TradeStatus" NOT NULL,
    "toStatus" "TradeStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instrument" TEXT,
    "impact" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatTopic_clanId_status_idx" ON "ChatTopic"("clanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTopic_clanId_name_key" ON "ChatTopic"("clanId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TradeCard_messageId_key" ON "TradeCard"("messageId");

-- CreateIndex
CREATE INDEX "TradeCard_instrument_idx" ON "TradeCard"("instrument");

-- CreateIndex
CREATE INDEX "TradeCard_direction_idx" ON "TradeCard"("direction");

-- CreateIndex
CREATE INDEX "TradeCardVersion_tradeCardId_editedAt_idx" ON "TradeCardVersion"("tradeCardId", "editedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_tradeCardId_key" ON "Trade"("tradeCardId");

-- CreateIndex
CREATE INDEX "Trade_clanId_status_idx" ON "Trade"("clanId", "status");

-- CreateIndex
CREATE INDEX "Trade_clanId_createdAt_idx" ON "Trade"("clanId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- CreateIndex
CREATE INDEX "TradeStatusHistory_tradeId_createdAt_idx" ON "TradeStatusHistory"("tradeId", "createdAt");

-- CreateIndex
CREATE INDEX "Watchlist_userId_clanId_idx" ON "Watchlist"("userId", "clanId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_clanId_instrument_key" ON "Watchlist"("userId", "clanId", "instrument");

-- CreateIndex
CREATE INDEX "TradingEvent_isActive_startTime_idx" ON "TradingEvent"("isActive", "startTime");

-- CreateIndex
CREATE INDEX "Message_topicId_createdAt_idx" ON "Message"("topicId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatTopic" ADD CONSTRAINT "ChatTopic_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTopic" ADD CONSTRAINT "ChatTopic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ChatTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCard" ADD CONSTRAINT "TradeCard_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCardVersion" ADD CONSTRAINT "TradeCardVersion_tradeCardId_fkey" FOREIGN KEY ("tradeCardId") REFERENCES "TradeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tradeCardId_fkey" FOREIGN KEY ("tradeCardId") REFERENCES "TradeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeStatusHistory" ADD CONSTRAINT "TradeStatusHistory_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
