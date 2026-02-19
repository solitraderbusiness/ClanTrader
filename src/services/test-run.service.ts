import { db } from "@/lib/db";
import type { TestSuite, TestRunMode, TestRunStatus, Prisma } from "@prisma/client";

const MAX_HEADED_WORKERS = 2;

interface CreateTestRunParams {
  suite: TestSuite;
  requestedWorkers: number;
  runMode: TestRunMode;
  options?: Record<string, unknown>;
  queuedById: string;
}

export function clampWorkers(requested: number, runMode: TestRunMode): number {
  if (runMode === "HEADED") {
    return Math.min(requested, MAX_HEADED_WORKERS);
  }
  return Math.min(requested, 6);
}

export async function createTestRun(params: CreateTestRunParams) {
  const effectiveWorkers = clampWorkers(params.requestedWorkers, params.runMode);

  return db.testRun.create({
    data: {
      suite: params.suite,
      requestedWorkers: params.requestedWorkers,
      effectiveWorkers,
      runMode: params.runMode,
      status: "QUEUED",
      options: (params.options || undefined) as Prisma.InputJsonValue | undefined,
      queuedById: params.queuedById,
    },
  });
}

export async function getTestRuns(opts: {
  status?: TestRunStatus;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.TestRunWhereInput = {};
  if (opts.status) where.status = opts.status;

  const [runs, total] = await Promise.all([
    db.testRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit || 50,
      skip: opts.offset || 0,
    }),
    db.testRun.count({ where }),
  ]);

  return { runs, total };
}

export async function getTestRun(id: string) {
  return db.testRun.findUnique({ where: { id } });
}

export async function claimTestRun(workerHostname: string) {
  // Atomically find and claim the oldest QUEUED run
  // Use a transaction to avoid race conditions
  return db.$transaction(async (tx) => {
    const run = await tx.testRun.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });

    if (!run) return null;

    return tx.testRun.update({
      where: { id: run.id },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        workerHostname,
      },
    });
  });
}

export async function updateTestRunStatus(
  id: string,
  data: {
    status?: TestRunStatus;
    startedAt?: Date;
    completedAt?: Date;
    totalTests?: number;
    passedTests?: number;
    failedTests?: number;
    skippedTests?: number;
    durationMs?: number;
    reportUrl?: string;
    errorMessage?: string;
  }
) {
  return db.testRun.update({ where: { id }, data });
}

export async function cancelTestRun(id: string) {
  const run = await db.testRun.findUnique({ where: { id } });
  if (!run) return null;
  if (run.status !== "QUEUED" && run.status !== "CLAIMED") {
    throw new Error("Can only cancel QUEUED or CLAIMED runs");
  }
  return db.testRun.update({
    where: { id },
    data: { status: "CANCELED", completedAt: new Date() },
  });
}
