import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditLogQuerySchema } from "@/lib/validators";
import { getAuditLogs } from "@/services/admin.service";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = auditLogQuerySchema.safeParse({
      action: searchParams.get("action") || undefined,
      entityType: searchParams.get("entityType") || undefined,
      actorId: searchParams.get("actorId") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await getAuditLogs({
      ...parsed.data,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get audit logs error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
