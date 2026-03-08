import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getIO } from "@/lib/socket-io-global";
import { auth } from "@/lib/auth";

export async function GET() {
  const [dbStatus, redisStatus] = await Promise.all([
    db
      .$queryRaw`SELECT 1`
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

  // Public: only return status code
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { status: allHealthy ? "ok" : "degraded" },
      { status: allHealthy ? 200 : 503 },
    );
  }

  // Admin: return full diagnostics
  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      redis: redisStatus,
      socketio: socketStatus,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
