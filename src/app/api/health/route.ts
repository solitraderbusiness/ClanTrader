import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getIO } from "@/lib/socket-io-global";

export async function GET(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

  const [dbStatus, redisStatus] = await Promise.all([
    db
      .$queryRawUnsafe("SELECT 1")
      .then(() => "connected" as const)
      .catch(() => "disconnected" as const),
    redis
      .ping()
      .then(() => "connected" as const)
      .catch(() => "disconnected" as const),
  ]);

  const io = getIO();
  const socketStatus = io ? "running" : "not_initialized";

  const allHealthy =
    dbStatus === "connected" &&
    redisStatus === "connected" &&
    socketStatus === "running";

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      serverTime: new Date().toISOString(),
      clientIp: ip,
      uptime: process.uptime(),
      database: dbStatus,
      redis: redisStatus,
      socketio: socketStatus,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
