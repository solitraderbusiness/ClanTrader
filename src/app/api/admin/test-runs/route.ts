import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTestRunSchema } from "@/lib/validators";
import { createTestRun, getTestRuns } from "@/services/test-run.service";
import { audit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as
      | "QUEUED"
      | "CLAIMED"
      | "RUNNING"
      | "PASSED"
      | "FAILED"
      | "CANCELED"
      | undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { runs, total } = await getTestRuns({
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json({ runs, total });
  } catch (error) {
    console.error("Get test runs error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createTestRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const run = await createTestRun({
      suite: parsed.data.suite,
      requestedWorkers: parsed.data.requestedWorkers,
      runMode: parsed.data.runMode,
      options: parsed.data.options as Record<string, unknown> | undefined,
      queuedById: session.user.id,
    });

    audit("test_run.create", "TestRun", run.id, session.user.id, {
      suite: run.suite,
      runMode: run.runMode,
      requestedWorkers: run.requestedWorkers,
      effectiveWorkers: run.effectiveWorkers,
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    console.error("Create test run error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
