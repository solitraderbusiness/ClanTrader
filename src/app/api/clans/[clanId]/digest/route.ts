import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { z } from "zod";
import { getClanDigest } from "@/services/clan-digest.service";
import { getClanDigestV2 } from "@/services/digest-v2.service";
import { DIGEST_SNAPSHOT_PREFIX, DIGEST_SNAPSHOT_TTL } from "@/lib/digest-constants";
import {
  createDigestSnapshotV2,
  computeDeltas,
  computeMemberTrend,
  computePredictiveHints,
  computeStateAssessment,
  type DigestSnapshot,
  type MemberSnapshotData,
} from "@/lib/digest-engines";

const querySchema = z.object({
  period: z.enum(["today", "week", "month"]).default("today"),
  tz: z.coerce.number().int().min(-720).max(840).default(0),
  v: z.coerce.number().int().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;

    // Verify user is a member of this clan
    const member = await db.clanMember.findUnique({
      where: {
        userId_clanId: { userId: session.user.id, clanId },
      },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Not a clan member" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
      tz: searchParams.get("tz") ?? undefined,
      v: searchParams.get("v") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid parameters" },
        { status: 400 }
      );
    }

    // Use v2 by default; v=1 can force legacy
    const useV2 = parsed.data.v !== 1;

    if (useV2) {
      const rawData = await getClanDigestV2(clanId, parsed.data.period, parsed.data.tz);

      // Extract internal member snapshot data (not part of public response)
      const { _memberSnapshotData, ...data } = rawData as typeof rawData & { _memberSnapshotData?: Record<string, MemberSnapshotData> };
      const memberSnapData = _memberSnapshotData ?? {};

      // Delta Engine: per-user snapshot comparison
      const snapshotKey = `${DIGEST_SNAPSHOT_PREFIX}:${clanId}:${session.user.id}:${parsed.data.period}`;
      let deltas = data.deltas;
      let hints = data.hints;

      // Trader-scoped deltas (separate snapshot key)
      const traderSnapshotKey = `${DIGEST_SNAPSHOT_PREFIX}:${clanId}:${session.user.id}:${parsed.data.period}:trader`;
      let traderDeltas: typeof deltas = null;
      let traderHints: typeof hints = [];

      try {
        // Load previous snapshot
        const prevRaw = await redis.get(snapshotKey);
        const previousSnapshot: DigestSnapshot | null = prevRaw ? JSON.parse(prevRaw) : null;

        // Create current snapshot with member-level data
        const currentSnapshot = createDigestSnapshotV2(
          data.cockpit, data.stateAssessment, memberSnapData
        );

        // Compute deltas
        deltas = computeDeltas(currentSnapshot, previousSnapshot);

        // Engine 8: Member trends (Phase 2)
        if (previousSnapshot?.memberMetrics) {
          for (const member of data.members) {
            const current = memberSnapData[member.userId];
            const prev = previousSnapshot.memberMetrics[member.userId] ?? null;
            if (current) {
              member.memberTrend = computeMemberTrend(current, prev);
            }
          }
        }

        // Engine 9: Predictive hints (Phase 3)
        hints = computePredictiveHints(currentSnapshot, previousSnapshot, deltas);

        // Save current snapshot for next comparison
        await redis.set(snapshotKey, JSON.stringify(currentSnapshot), "EX", DIGEST_SNAPSHOT_TTL);

        // ─── Trader-scoped snapshot & deltas ───
        const myMember = data.members.find(m => m.userId === session.user.id);
        if (myMember) {
          const hasActive = myMember.openPositions.some(p => p.trackingStatus === "ACTIVE");
          const hasStale = myMember.openPositions.some(p => p.trackingStatus === "STALE");
          const hasLost = myMember.openPositions.some(p => p.trackingStatus === "TRACKING_LOST");

          const traderState = computeStateAssessment({
            openHealthResults: myMember.openPositions.map(p => ({
              health: p.health,
              rComputable: p.rComputable,
              trackingStatus: p.trackingStatus,
            })),
            trackingSummary: {
              activeAccounts: hasActive ? 1 : 0,
              staleAccounts: hasStale ? 1 : 0,
              lostAccounts: hasLost ? 1 : 0,
            },
          });

          const traderSnapshot = createDigestSnapshotV2(
            {
              totalFloatingPnl: myMember.memberFloatingPnl,
              realizedPnl: null,
              realizedR: myMember.closedTrades.length > 0 ? myMember.totalR : null,
              closedCount: myMember.closedTrades.length,
            },
            traderState
          );

          const prevTraderRaw = await redis.get(traderSnapshotKey);
          const prevTraderSnapshot: DigestSnapshot | null = prevTraderRaw ? JSON.parse(prevTraderRaw) : null;

          traderDeltas = computeDeltas(traderSnapshot, prevTraderSnapshot);
          traderHints = computePredictiveHints(traderSnapshot, prevTraderSnapshot, traderDeltas);

          await redis.set(traderSnapshotKey, JSON.stringify(traderSnapshot), "EX", DIGEST_SNAPSHOT_TTL);
        }
      } catch {
        // Delta/trend/hint computation is best-effort — don't fail the digest
      }

      return NextResponse.json({
        ...data,
        deltas,
        hints,
        currentUserId: session.user.id,
        traderDeltas,
        traderHints,
      });
    }

    const data = await getClanDigest(clanId, parsed.data.period, parsed.data.tz);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Clan digest error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
