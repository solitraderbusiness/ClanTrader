import { NextResponse } from "next/server";
import { updateTestRunStatus, getTestRun } from "@/services/test-run.service";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { audit } from "@/lib/audit";

function verifyWorkerToken(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  return token === process.env.TEST_WORKER_TOKEN;
}

export async function POST(
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

    const formData = await request.formData();
    const file = formData.get("report") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No report file provided" }, { status: 400 });
    }

    // Store in public/uploads/test-reports/<runId>/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "test-reports", runId);
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "report.zip";
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const reportUrl = `/uploads/test-reports/${runId}/${filename}`;

    await updateTestRunStatus(runId, { reportUrl });

    audit("test_run.artifact_uploaded", "TestRun", runId, undefined, {
      filename,
      size: buffer.length,
    });

    return NextResponse.json({ reportUrl });
  } catch (error) {
    console.error("Upload artifact error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
