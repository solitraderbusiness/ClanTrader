import { db } from "@/lib/db";
import { invalidateFlag } from "@/lib/feature-flags";
import type { Prisma } from "@prisma/client";

// --- Feature Flags ---

export async function getFeatureFlags() {
  return db.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export async function createFeatureFlag(data: {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const flag = await db.featureFlag.create({
    data: {
      ...data,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  await invalidateFlag(data.key);
  return flag;
}

export async function updateFeatureFlag(
  key: string,
  data: { name?: string; description?: string; enabled?: boolean; metadata?: Record<string, unknown> }
) {
  const flag = await db.featureFlag.update({
    where: { key },
    data: {
      ...data,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  await invalidateFlag(key);
  return flag;
}

export async function deleteFeatureFlag(key: string) {
  await db.featureFlag.delete({ where: { key } });
  await invalidateFlag(key);
}

// --- Paywall Rules ---

export async function getPaywallRules() {
  return db.paywallRule.findMany({ orderBy: { resourceType: "asc" } });
}

export async function createPaywallRule(data: {
  resourceType: string;
  name: string;
  description?: string;
  freePreview?: Record<string, boolean>;
  enabled?: boolean;
}) {
  return db.paywallRule.create({
    data: {
      ...data,
      freePreview: data.freePreview as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function updatePaywallRule(
  id: string,
  data: { name?: string; description?: string; freePreview?: Record<string, boolean>; enabled?: boolean }
) {
  return db.paywallRule.update({
    where: { id },
    data: {
      ...data,
      freePreview: data.freePreview as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function deletePaywallRule(id: string) {
  await db.paywallRule.delete({ where: { id } });
}

// --- Subscription Plans ---

export async function getPlans() {
  return db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createPlan(data: {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency?: string;
  interval?: string;
  entitlements: string[];
  sortOrder?: number;
}) {
  return db.subscriptionPlan.create({ data });
}

export async function updatePlan(
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    currency?: string;
    interval?: string;
    entitlements?: string[];
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  return db.subscriptionPlan.update({ where: { id }, data });
}

export async function deletePlan(id: string) {
  await db.subscriptionPlan.delete({ where: { id } });
}

// --- Audit Logs ---

export async function getAuditLogs(filters: {
  action?: string;
  entityType?: string;
  actorId?: string;
  level?: "INFO" | "WARN" | "ERROR";
  category?: "AUTH" | "EA" | "TRADE" | "CHAT" | "ADMIN" | "SYSTEM";
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 50, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.level) where.level = filters.level;
  if (filters.category) where.category = filters.category;
  if (filters.search) where.action = { contains: filters.search, mode: "insensitive" };
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [logs, total, countInfo, countWarn, countError] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
    db.auditLog.count({ where: { level: "INFO", createdAt: { gte: since24h } } }),
    db.auditLog.count({ where: { level: "WARN", createdAt: { gte: since24h } } }),
    db.auditLog.count({ where: { level: "ERROR", createdAt: { gte: since24h } } }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      info24h: countInfo,
      warn24h: countWarn,
      error24h: countError,
    },
  };
}
