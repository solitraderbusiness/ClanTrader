import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

  let dbStatus = "unknown";
  try {
    await db.$queryRawUnsafe("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  return NextResponse.json({
    status: "ok",
    serverTime: new Date().toISOString(),
    clientIp: ip,
    infrastructure: "iranian-core",
    database: dbStatus,
    externalDependencies: "none",
  });
}
