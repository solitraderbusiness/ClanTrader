import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTestRun, cancelTestRun } from "@/services/test-run.service";
import { audit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { runId } = await params;
    const run = await getTestRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error("Get test run error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { runId } = await params;
    const run = await cancelTestRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    audit("test_run.cancel", "TestRun", run.id, session.user.id, undefined, { category: "ADMIN" });

    return NextResponse.json({ run });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Something went wrong";
    console.error("Cancel test run error:", error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
