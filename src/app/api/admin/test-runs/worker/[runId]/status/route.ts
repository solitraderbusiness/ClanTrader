import { NextResponse } from "next/server";
import { updateTestRunStatus, getTestRun } from "@/services/test-run.service";
import { audit } from "@/lib/audit";

function verifyWorkerToken(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === process.env.TEST_WORKER_TOKEN;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    if (!verifyWorkerToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { runId } = await params;
    const existing = await getTestRun(runId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Parameters<typeof updateTestRunStatus>[1] = {};

    if (body.status) updateData.status = body.status;
    if (body.status === "RUNNING") updateData.startedAt = new Date();
    if (body.status === "PASSED" || body.status === "FAILED") {
      updateData.completedAt = new Date();
    }
    if (body.totalTests !== undefined) updateData.totalTests = body.totalTests;
    if (body.passedTests !== undefined) updateData.passedTests = body.passedTests;
    if (body.failedTests !== undefined) updateData.failedTests = body.failedTests;
    if (body.skippedTests !== undefined) updateData.skippedTests = body.skippedTests;
    if (body.durationMs !== undefined) updateData.durationMs = body.durationMs;
    if (body.errorMessage) updateData.errorMessage = body.errorMessage;

    const run = await updateTestRunStatus(runId, updateData);

    audit("test_run.status_update", "TestRun", run.id, undefined, {
      from: existing.status,
      to: body.status,
    }, { category: "ADMIN" });

    return NextResponse.json({ run });
  } catch (error) {
    console.error("Update test run status error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
