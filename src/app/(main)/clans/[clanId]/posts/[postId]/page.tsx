import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getPost, ChannelServiceError } from "@/services/channel.service";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReactionBar } from "@/components/channel/ReactionBar";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import Link from "next/link";
import { ArrowLeft, Eye, Crown, Lock } from "lucide-react";

const CLOSED_STATUSES = ["TP_HIT", "SL_HIT", "BE", "CLOSED"];

function extractNote(content: string): string | null {
  const raw = content.trim();
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      return parsed.note || null;
    } catch {
      // Not valid JSON, render as-is
    }
  }
  return raw;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clanId: string; postId: string }>;
}) {
  const { postId } = await params;
  try {
    const post = await getPost(postId);
    return { title: post.title || "Post" };
  } catch {
    return { title: "Post" };
  }
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ clanId: string; postId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { clanId, postId } = await params;

  let post;
  try {
    post = await getPost(postId);
  } catch (e) {
    if (e instanceof ChannelServiceError && e.code === "NOT_FOUND") {
      notFound();
    }
    notFound();
  }

  // Check premium access
  let canView = true;
  if (post.isPremium) {
    const membership = await db.clanMember.findUnique({
      where: { userId_clanId: { userId: session.user.id, clanId } },
    });
    canView = !!membership || (session.user.isPro ?? false);
  }

  const reactions = (post.reactions || {}) as Record<string, string[]>;
  const tc = post.tradeCard;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clans/${clanId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Back to {post.clan.name}
        </span>
      </div>

      {/* Author + meta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={post.author.avatar || undefined}
              alt={post.author.name || ""}
            />
            <AvatarFallback>
              {(post.author.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="font-medium">
              {post.author.name || "Unknown"}
            </span>
            <p className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString()} &middot;{" "}
              <Eye className="me-0.5 inline h-3 w-3" />
              {post.viewCount} views
            </p>
          </div>
        </div>
        {post.isPremium && (
          <Badge variant="default" className="gap-1">
            <Crown className="h-3 w-3" />
            Premium
          </Badge>
        )}
      </div>

      {/* Title */}
      {post.title && (
        <h1 className="text-2xl font-bold">{post.title}</h1>
      )}

      {/* Content */}
      {canView ? (
        <>
          {/* Trade card signal display */}
          {tc && (
            <TradeCardDisplay tradeCard={tc} />
          )}

          {/* Text content — extract note from JSON for old posts */}
          {(() => {
            const displayText = tc ? extractNote(post.content) : post.content;
            if (!displayText) return null;
            return (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {displayText}
              </div>
            );
          })()}

          {/* Images */}
          {post.images.length > 0 && (
            <div className="space-y-3">
              {post.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Post image ${i + 1}`}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-lg font-semibold">Premium Content</h2>
            <p className="text-sm text-muted-foreground">
              Join this clan or upgrade to Pro to view this post.
            </p>
          </div>
        </div>
      )}

      {/* Reactions */}
      <div className="border-t pt-4">
        <ReactionBar
          postId={postId}
          clanId={clanId}
          reactions={reactions}
          currentUserId={session.user.id}
        />
      </div>

      {/* Placeholder */}
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Comments coming soon
      </div>
    </div>
  );
}

function TradeCardDisplay({
  tradeCard: tc,
}: {
  tradeCard: {
    instrument: string;
    direction: string;
    entry: number;
    stopLoss: number;
    targets: number[];
    timeframe: string;
    tags: string[];
    trade?: {
      id: string;
      status: string;
      finalRR: number | null;
      netProfit: number | null;
      closePrice: number | null;
    } | null;
  };
}) {
  const trade = tc.trade;
  const isClosed = trade && CLOSED_STATUSES.includes(trade.status);

  const computeStaticRR = (): string | null => {
    const { entry, stopLoss, targets, direction } = tc;
    const target = targets[0];
    if (!target || !stopLoss || !entry) return null;
    const risk = Math.abs(entry - stopLoss);
    if (risk === 0) return null;
    const reward = direction === "LONG" ? target - entry : entry - target;
    const rr = reward / risk;
    if (rr <= 0) return null;
    return `1:${rr.toFixed(1)}`;
  };

  const hasFourthCol =
    (isClosed && trade.finalRR != null) || computeStaticRR() != null;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Colored accent bar */}
      <div
        className={`absolute inset-y-0 start-0 w-1 ${
          tc.direction === "LONG" ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <div
        className={`absolute inset-0 pointer-events-none ${
          tc.direction === "LONG"
            ? "bg-gradient-to-b from-green-500/5 to-transparent"
            : "bg-gradient-to-b from-red-500/5 to-transparent"
        }`}
      />

      <div className="relative p-4 ps-5 space-y-3">
        {/* Direction + Instrument + Timeframe + Status */}
        <div className="flex flex-wrap items-center gap-2">
          <DirectionBadge direction={tc.direction as "LONG" | "SHORT"} />
          <span className="text-lg font-bold tracking-tight">
            {tc.instrument}
          </span>
          <Badge variant="outline" className="text-xs">
            {tc.timeframe === "AUTO" ? "Auto" : tc.timeframe}
          </Badge>
          {trade && <StatusBadge status={trade.status} />}
        </div>

        {/* Price grid */}
        <div
          className={`grid gap-3 text-sm ${
            hasFourthCol ? "grid-cols-4" : "grid-cols-3"
          }`}
        >
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
            <span className="text-xs text-muted-foreground">Entry</span>
            <p className="font-mono font-medium">{tc.entry}</p>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
            <span className="text-xs text-muted-foreground">Stop Loss</span>
            <p className="font-mono font-medium text-red-500">
              {tc.stopLoss}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
            <span className="text-xs text-muted-foreground">Target</span>
            <p className="font-mono font-medium text-green-500">
              {tc.targets[0]}
            </p>
          </div>
          {isClosed && trade.finalRR != null && (
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <span className="text-xs text-muted-foreground">Result</span>
              <p
                className={`font-mono font-bold ${
                  trade.finalRR > 0
                    ? "text-green-500"
                    : trade.finalRR < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                {trade.finalRR > 0 ? "+" : ""}
                {trade.finalRR.toFixed(2)}R
              </p>
              {trade.netProfit != null && (
                <p
                  className={`font-mono text-xs ${
                    trade.netProfit > 0
                      ? "text-green-500/70"
                      : trade.netProfit < 0
                        ? "text-red-500/70"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {trade.netProfit > 0 ? "+" : ""}
                  {trade.netProfit.toFixed(2)}
                </p>
              )}
            </div>
          )}
          {!isClosed && computeStaticRR() && (
            <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
              <span className="text-xs text-muted-foreground">R:R</span>
              <p className="font-mono font-medium text-muted-foreground">
                {computeStaticRR()}
              </p>
            </div>
          )}
        </div>

        {/* Tags */}
        {tc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tc.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
