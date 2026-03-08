/**
 * Adapter layer — maps database queries to the digest Task type.
 * Keeps digest logic decoupled from Prisma.
 */

/** Prisma select for digest queries — includes all fields needed by scoring + classification */
export const DIGEST_TASK_SELECT = {
  id: true,
  title: true,
  phase: true,
  priority: true,
  column: true,
  dueDate: true,
  completedAt: true,
  startedAt: true,
  category: true,
  isLaunchBlocker: true,
  result: true,
  key: true,
  pmStatus: true,
  milestone: true,
  workstream: true,
  owner: true,
  dependencies: true,
  evidence: true,
  notes: true,
} as const;

export const DIGEST_TASK_ORDER = [
  { phase: "asc" as const },
  { position: "asc" as const },
];
