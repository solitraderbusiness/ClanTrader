import { db } from "@/lib/db";
import type { LogLevel, LogCategory, Prisma } from "@prisma/client";

interface AuditOptions {
  level?: LogLevel;
  category?: LogCategory;
}

export function audit(
  action: string,
  entityType: string,
  entityId: string,
  actorId?: string,
  metadata?: Record<string, unknown>,
  options?: AuditOptions
) {
  // Fire and forget
  db.auditLog
    .create({
      data: {
        action,
        entityType,
        entityId,
        actorId: actorId || null,
        metadata: (metadata || undefined) as Prisma.InputJsonValue | undefined,
        level: options?.level ?? "INFO",
        category: options?.category ?? "SYSTEM",
      },
    })
    .catch((err) => {
      console.error("Audit log error:", err);
    });
}

/**
 * Convenience wrapper for non-entity events (errors, system events).
 * Sets entityType to "System" and entityId to "-".
 */
export function log(
  action: string,
  level: LogLevel,
  category: LogCategory,
  metadata?: Record<string, unknown>,
  actorId?: string
) {
  audit(action, "System", "-", actorId, metadata, { level, category });
}
