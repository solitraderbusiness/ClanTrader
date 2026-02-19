import { NextResponse } from "next/server";
import { claimTestRun } from "@/services/test-run.service";
import { audit } from "@/lib/audit";

function verifyWorkerToken(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === process.env.TEST_WORKER_TOKEN;
}

export async function POST(request: Request) {
  try {
    if (!verifyWorkerToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const hostname = body.hostname || "unknown";

    const run = await claimTestRun(hostname);
    if (!run) {
      return NextResponse.json({ run: null, message: "No queued runs" });
    }

    audit("test_run.claimed", "TestRun", run.id, undefined, { hostname });

    return NextResponse.json({ run });
  } catch (error) {
    console.error("Claim test run error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
