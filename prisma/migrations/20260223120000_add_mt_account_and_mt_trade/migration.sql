-- CreateEnum
CREATE TYPE "TradeActionType" AS ENUM ('SET_BE', 'MOVE_SL', 'CHANGE_TP', 'CLOSE', 'ADD_NOTE', 'STATUS_CHANGE', 'INTEGRITY_FLAG', 'MANUAL_STATUS_SET', 'ADMIN_STATEMENT_TOGGLE');

-- CreateEnum
CREATE TYPE "IntegrityStatus" AS ENUM ('VERIFIED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "IntegrityReason" AS ENUM ('ENTRY_CONFLICT', 'EXIT_CONFLICT', 'DATA_GAP', 'MANUAL_OVERRIDE', 'OTHER');

-- CreateEnum
CREATE TYPE "ResolutionSource" AS ENUM ('EVALUATOR', 'MANUAL', 'UNKNOWN', 'EA_VERIFIED');

-- CreateEnum
CREATE TYPE "MtPlatform" AS ENUM ('MT4', 'MT5');

-- CreateEnum
CREATE TYPE "MtAccountType" AS ENUM ('DEMO', 'LIVE');

-- CreateEnum
CREATE TYPE "MtTradeDirection" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "ChannelPostSource" AS ENUM ('MANUAL', 'AUTO_TAG');

-- CreateEnum
CREATE TYPE "StatementPeriod" AS ENUM ('MONTHLY', 'SEASONAL', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "TestSuite" AS ENUM ('SMOKE', 'FULL_E2E', 'SIMULATOR');

-- CreateEnum
CREATE TYPE "TestRunMode" AS ENUM ('HEADLESS', 'HEADED');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('QUEUED', 'CLAIMED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BadgeCategory" AS ENUM ('RANK', 'PERFORMANCE', 'TROPHY', 'OTHER');

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'TRADE_ACTION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TradeStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "TradeStatus" ADD VALUE IF NOT EXISTS 'TP_HIT';
ALTER TYPE "TradeStatus" ADD VALUE IF NOT EXISTS 'UNVERIFIED';

-- DropIndex
DROP INDEX "LeaderboardEntry_seasonId_entityType_entityId_key";

-- AlterTable
ALTER TABLE "ChannelPost" ADD COLUMN     "sourceType" "ChannelPostSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "tradeCardId" TEXT;

-- AlterTable
ALTER TABLE "Clan" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibilityOverride" TEXT;

-- AlterTable
ALTER TABLE "ClanMember" ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Follow" ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LeaderboardEntry" ADD COLUMN     "lens" TEXT NOT NULL DEFAULT 'composite';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "images" TEXT[];

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "entryFilledAt" TIMESTAMP(3),
ADD COLUMN     "integrityDetails" JSONB,
ADD COLUMN     "integrityReason" "IntegrityReason",
ADD COLUMN     "integrityStatus" "IntegrityStatus" NOT NULL DEFAULT 'VERIFIED',
ADD COLUMN     "lastEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionSource" "ResolutionSource" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "statementEligible" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerified" TIMESTAMP(3),
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RankingConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lenses" JSONB NOT NULL,
    "weights" JSONB NOT NULL,
    "minTrades" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeEvent" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "actionType" "TradeActionType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraderStatement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "periodType" "StatementPeriod" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "seasonId" TEXT,
    "metrics" JSONB NOT NULL,
    "tradeCount" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraderStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaywallRule" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "freePreview" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaywallRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "entitlements" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "suite" "TestSuite" NOT NULL,
    "requestedWorkers" INTEGER NOT NULL DEFAULT 2,
    "effectiveWorkers" INTEGER NOT NULL DEFAULT 2,
    "runMode" "TestRunMode" NOT NULL DEFAULT 'HEADLESS',
    "status" "TestRunStatus" NOT NULL DEFAULT 'QUEUED',
    "options" JSONB,
    "queuedById" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "workerHostname" TEXT,
    "totalTests" INTEGER,
    "passedTests" INTEGER,
    "failedTests" INTEGER,
    "skippedTests" INTEGER,
    "durationMs" INTEGER,
    "reportUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanJoinRequest" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClanJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "BadgeCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "iconAssetKey" TEXT,
    "requirementsJson" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeDefinitionId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeAdminChange" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "badgeDefinitionId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldValueJson" JSONB,
    "newValueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeAdminChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "participant1Id" TEXT NOT NULL,
    "participant2Id" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "replyToId" TEXT,
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MtAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountNumber" INTEGER NOT NULL,
    "broker" TEXT NOT NULL,
    "serverName" TEXT,
    "accountType" "MtAccountType" NOT NULL DEFAULT 'LIVE',
    "platform" "MtPlatform" NOT NULL DEFAULT 'MT4',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin" DOUBLE PRECISION,
    "freeMargin" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "leverage" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeat" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "MtAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MtTrade" (
    "id" TEXT NOT NULL,
    "mtAccountId" TEXT NOT NULL,
    "ticket" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" "MtTradeDirection" NOT NULL,
    "lots" DOUBLE PRECISION NOT NULL,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "closePrice" DOUBLE PRECISION,
    "openTime" TIMESTAMP(3) NOT NULL,
    "closeTime" TIMESTAMP(3),
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "swap" DOUBLE PRECISION,
    "comment" TEXT,
    "magicNumber" INTEGER,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "matchedTradeId" TEXT,

    CONSTRAINT "MtTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankingConfig_key_key" ON "RankingConfig"("key");

-- CreateIndex
CREATE INDEX "TradeEvent_tradeId_createdAt_idx" ON "TradeEvent"("tradeId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeEvent_actorId_idx" ON "TradeEvent"("actorId");

-- CreateIndex
CREATE INDEX "TraderStatement_clanId_periodType_idx" ON "TraderStatement"("clanId", "periodType");

-- CreateIndex
CREATE INDEX "TraderStatement_userId_periodType_idx" ON "TraderStatement"("userId", "periodType");

-- CreateIndex
CREATE UNIQUE INDEX "TraderStatement_userId_clanId_periodType_periodKey_key" ON "TraderStatement"("userId", "clanId", "periodType", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PaywallRule_resourceType_key" ON "PaywallRule"("resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "ReferralEvent_referrerId_idx" ON "ReferralEvent"("referrerId");

-- CreateIndex
CREATE INDEX "ReferralEvent_referredId_idx" ON "ReferralEvent"("referredId");

-- CreateIndex
CREATE INDEX "ReferralEvent_type_idx" ON "ReferralEvent"("type");

-- CreateIndex
CREATE INDEX "ReferralEvent_createdAt_idx" ON "ReferralEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TestRun_status_createdAt_idx" ON "TestRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TestRun_queuedById_idx" ON "TestRun"("queuedById");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_clanId_status_idx" ON "ClanJoinRequest"("clanId", "status");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_userId_idx" ON "ClanJoinRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanJoinRequest_clanId_userId_key" ON "ClanJoinRequest"("clanId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeDefinition_key_key" ON "BadgeDefinition"("key");

-- CreateIndex
CREATE INDEX "BadgeDefinition_category_enabled_idx" ON "BadgeDefinition"("category", "enabled");

-- CreateIndex
CREATE INDEX "BadgeDefinition_enabled_isDeleted_displayOrder_idx" ON "BadgeDefinition"("enabled", "isDeleted", "displayOrder");

-- CreateIndex
CREATE INDEX "UserBadge_userId_isActive_idx" ON "UserBadge"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserBadge_badgeDefinitionId_idx" ON "UserBadge"("badgeDefinitionId");

-- CreateIndex
CREATE INDEX "UserBadge_awardedAt_idx" ON "UserBadge"("awardedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeDefinitionId_key" ON "UserBadge"("userId", "badgeDefinitionId");

-- CreateIndex
CREATE INDEX "BadgeAdminChange_badgeDefinitionId_createdAt_idx" ON "BadgeAdminChange"("badgeDefinitionId", "createdAt");

-- CreateIndex
CREATE INDEX "BadgeAdminChange_adminUserId_idx" ON "BadgeAdminChange"("adminUserId");

-- CreateIndex
CREATE INDEX "Conversation_participant1Id_idx" ON "Conversation"("participant1Id");

-- CreateIndex
CREATE INDEX "Conversation_participant2Id_idx" ON "Conversation"("participant2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_participant1Id_participant2Id_key" ON "Conversation"("participant1Id", "participant2Id");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_idx" ON "DirectMessage"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "MtAccount_apiKey_key" ON "MtAccount"("apiKey");

-- CreateIndex
CREATE INDEX "MtAccount_userId_idx" ON "MtAccount"("userId");

-- CreateIndex
CREATE INDEX "MtAccount_apiKey_idx" ON "MtAccount"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "MtAccount_userId_accountNumber_broker_key" ON "MtAccount"("userId", "accountNumber", "broker");

-- CreateIndex
CREATE INDEX "MtTrade_mtAccountId_isOpen_idx" ON "MtTrade"("mtAccountId", "isOpen");

-- CreateIndex
CREATE INDEX "MtTrade_matchedTradeId_idx" ON "MtTrade"("matchedTradeId");

-- CreateIndex
CREATE UNIQUE INDEX "MtTrade_mtAccountId_ticket_key" ON "MtTrade"("mtAccountId", "ticket");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelPost_tradeCardId_key" ON "ChannelPost"("tradeCardId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_seasonId_entityType_entityId_lens_key" ON "LeaderboardEntry"("seasonId", "entityType", "entityId", "lens");

-- CreateIndex
CREATE INDEX "Trade_status_lastEvaluatedAt_idx" ON "Trade"("status", "lastEvaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeEvent" ADD CONSTRAINT "TradeEvent_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelPost" ADD CONSTRAINT "ChannelPost_tradeCardId_fkey" FOREIGN KEY ("tradeCardId") REFERENCES "TradeCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderStatement" ADD CONSTRAINT "TraderStatement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderStatement" ADD CONSTRAINT "TraderStatement_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderStatement" ADD CONSTRAINT "TraderStatement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanJoinRequest" ADD CONSTRAINT "ClanJoinRequest_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanJoinRequest" ADD CONSTRAINT "ClanJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanJoinRequest" ADD CONSTRAINT "ClanJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeDefinitionId_fkey" FOREIGN KEY ("badgeDefinitionId") REFERENCES "BadgeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAdminChange" ADD CONSTRAINT "BadgeAdminChange_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAdminChange" ADD CONSTRAINT "BadgeAdminChange_badgeDefinitionId_fkey" FOREIGN KEY ("badgeDefinitionId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participant1Id_fkey" FOREIGN KEY ("participant1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participant2Id_fkey" FOREIGN KEY ("participant2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MtAccount" ADD CONSTRAINT "MtAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MtTrade" ADD CONSTRAINT "MtTrade_mtAccountId_fkey" FOREIGN KEY ("mtAccountId") REFERENCES "MtAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MtTrade" ADD CONSTRAINT "MtTrade_matchedTradeId_fkey" FOREIGN KEY ("matchedTradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

