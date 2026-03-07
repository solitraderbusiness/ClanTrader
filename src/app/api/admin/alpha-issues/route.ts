import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAlphaIssueSchema, alphaIssueQuerySchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = alphaIssueQuerySchema.safeParse({
      severity: searchParams.get("severity") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
    });

    const where: Prisma.AlphaIssueWhereInput = {};
    if (query.success) {
      if (query.data.severity) where.severity = query.data.severity;
      if (query.data.status) where.status = query.data.status;
      if (query.data.search) {
        where.OR = [
          { title: { contains: query.data.search, mode: "insensitive" } },
          { description: { contains: query.data.search, mode: "insensitive" } },
          { reportedBy: { contains: query.data.search, mode: "insensitive" } },
        ];
      }
    }

    const [issues, total, openCount, criticalCount, fixedCount] = await Promise.all([
      db.alphaIssue.findMany({
        where,
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      }),
      db.alphaIssue.count(),
      db.alphaIssue.count({ where: { status: "OPEN" } }),
      db.alphaIssue.count({ where: { severity: "CRITICAL" } }),
      db.alphaIssue.count({ where: { status: "FIXED" } }),
    ]);

    return NextResponse.json({
      issues,
      stats: { total, open: openCount, critical: criticalCount, fixed: fixedCount },
    });
  } catch (error) {
    console.error("Get alpha issues error:", error);
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
    const parsed = createAlphaIssueSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const issue = await db.alphaIssue.create({ data: parsed.data });

    audit("alpha-issue.create", "AlphaIssue", issue.id, session.user.id, {
      title: issue.title,
      severity: issue.severity,
    }, { category: "ADMIN" });

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    console.error("Create alpha issue error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
