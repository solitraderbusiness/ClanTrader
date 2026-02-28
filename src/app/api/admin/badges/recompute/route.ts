import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { badgeRecomputeSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import {
  recomputeAllBadges,
  recomputeUserBadges,
  recomputeBadgeForAll,
} from "@/services/badge-engine.service";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = badgeRecomputeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { scope, targetId } = parsed.data;

    if ((scope === "user" || scope === "badge") && !targetId) {
      return NextResponse.json(
        { error: "targetId is required for user/badge scope" },
        { status: 400 }
      );
    }

    audit("badge.recompute", "BadgeDefinition", targetId || "all", session.user.id, {
      scope,
    }, { category: "ADMIN" });

    if (scope === "user") {
      const result = await recomputeUserBadges(targetId!);
      return NextResponse.json({ result });
    }

    if (scope === "badge") {
      const result = await recomputeBadgeForAll(targetId!);
      return NextResponse.json({ result });
    }

    // scope === "all" — start async job
    const jobId = randomUUID();
    await redis.set(
      `badge:recompute:${jobId}`,
      JSON.stringify({ total: 0, processed: 0, errors: 0, status: "running" }),
      "EX",
      3600
    );

    // Fire and forget
    recomputeAllBadges(jobId).catch((err) =>
      console.error("Recompute all badges error:", err)
    );

    return NextResponse.json({ jobId, status: "running" });
  } catch (error) {
    console.error("Badge recompute error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const data = await redis.get(`badge:recompute:${jobId}`);
    if (!data) {
      return NextResponse.json(
        { error: "Job not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error("Badge recompute status error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
