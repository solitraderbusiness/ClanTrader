import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateAlphaIssueSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { issueId } = await params;
    const body = await request.json();
    const parsed = updateAlphaIssueSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.alphaIssue.findUnique({ where: { id: issueId } });
    if (!existing) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const issue = await db.alphaIssue.update({
      where: { id: issueId },
      data: parsed.data,
    });

    audit("alpha-issue.update", "AlphaIssue", issue.id, session.user.id, {
      title: issue.title,
      changes: Object.keys(parsed.data),
    }, { category: "ADMIN" });

    return NextResponse.json({ issue });
  } catch (error) {
    console.error("Update alpha issue error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { issueId } = await params;

    const existing = await db.alphaIssue.findUnique({ where: { id: issueId } });
    if (!existing) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    await db.alphaIssue.delete({ where: { id: issueId } });

    audit("alpha-issue.delete", "AlphaIssue", issueId, session.user.id, {
      title: existing.title,
    }, { category: "ADMIN" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete alpha issue error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
