import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export function audit(
  action: string,
  entityType: string,
  entityId: string,
  actorId?: string,
  metadata?: Record<string, unknown>
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
      },
    })
    .catch((err) => {
      console.error("Audit log error:", err);
    });
}
