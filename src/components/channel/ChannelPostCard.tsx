"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Lock, Crown, AlertTriangle } from "lucide-react";
import { ReactionBar } from "./ReactionBar";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toThumbUrl, isThumbUrl } from "@/lib/image-urls";
import { TRADE_POLICY } from "@/lib/trade-policy";
import { useTranslation } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";

interface TradeCardInfo {
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
}

interface ChannelPostCardProps {
  post: {
    id: string;
    title: string | null;
    content: string;
    images: string[];
    isPremium: boolean;
    locked?: boolean;
    viewCount: number;
    reactions: Record<string, string[]> | null;
    createdAt: string;
    author: { id: string; name: string | null; avatar: string | null };
    sourceType?: string;
    tradeCard?: TradeCardInfo | null;
  };
  clanId: string;
  currentUserId: string | null;
}

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

function computeStaticRR(tc: TradeCardInfo): string | null {
  const { entry, stopLoss, targets, direction } = tc;
  const target = targets[0];
  if (!target || !stopLoss || !entry) return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) return null;
  const reward = direction === "LONG" ? target - entry : entry - target;
  const rr = reward / risk;
  if (rr <= 0) return null;
  return `1:${rr.toFixed(1)}`;
}

export function ChannelPostCard({
  post,
  clanId,
  currentUserId,
}: ChannelPostCardProps) {
  const { t } = useTranslation();
  const reactions = (post.reactions || {}) as Record<string, string[]>;
  const tc = post.tradeCard;

  // Parse risk warning from AUTO_TAG content
  let riskWarning: { type: string } | null = null;
  if (post.sourceType === "AUTO_TAG" && TRADE_POLICY.CHANNEL_SHOW_RISK_VIOLATIONS) {
    try {
      const parsed = JSON.parse(post.content);
      if (parsed.riskWarning) riskWarning = parsed.riskWarning;
    } catch {
      // Not JSON content
    }
  }

  // Signal card layout when tradeCard data is present
  if (tc && post.sourceType === "AUTO_TAG") {
    const trade = tc.trade;
    const isClosed = trade && CLOSED_STATUSES.includes(trade.status);
    const hasFourthCol =
      (isClosed && trade.finalRR != null) || computeStaticRR(tc) != null;
    const note = extractNote(post.content);

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
          {/* Author + timestamp */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={post.author.avatar || undefined}
                  alt={post.author.name || ""}
                />
                <AvatarFallback className="text-xs">
                  {getInitials(post.author.name || "?")}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="text-sm font-medium">
                  {post.author.name || t("common.unknown")}
                </span>
                <span className="ms-2 text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {post.isPremium && (
                <Badge variant="default" className="gap-1">
                  <Crown className="h-3 w-3" />
                  {t("chat.premiumContent")}
                </Badge>
              )}
            </div>
          </div>

          {/* Risk Warning Banner */}
          {riskWarning && (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {riskWarning.type === "SL_REMOVED"
                  ? t("chat.slRemoved")
                  : t("chat.riskViolation")}
              </span>
            </div>
          )}

          {/* Direction + Instrument + Timeframe + Status */}
          <div className="flex flex-wrap items-center gap-2">
            <DirectionBadge direction={tc.direction as "LONG" | "SHORT"} />
            <span className="text-base font-bold tracking-tight">
              {tc.instrument}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {tc.timeframe === "AUTO" ? "Auto" : tc.timeframe}
            </Badge>
            {trade && <StatusBadge status={trade.status} />}
          </div>

          {/* Price grid */}
          <div
            className={`grid gap-2 text-xs ${
              hasFourthCol ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
            }`}
          >
            <div className="rounded-lg bg-muted/30 px-2 py-1 text-center">
              <span className="text-muted-foreground">{t("trade.entry")}</span>
              <p className="font-mono font-medium">{tc.entry}</p>
            </div>
            <div className="rounded-lg bg-muted/30 px-2 py-1 text-center">
              <span className="text-muted-foreground">{t("trade.stopLoss")}</span>
              <p className="font-mono font-medium text-red-500">
                {tc.stopLoss}
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 px-2 py-1 text-center">
              <span className="text-muted-foreground">{t("trade.target")}</span>
              <p className="font-mono font-medium text-green-500">
                {tc.targets[0]}
              </p>
            </div>
            {isClosed && trade.finalRR != null && (
              <div className="rounded-lg bg-muted/30 px-2 py-1 text-center">
                <span className="text-muted-foreground">{t("trade.result")}</span>
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
                    className={`font-mono text-[10px] ${
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
            {!isClosed && computeStaticRR(tc) && (
              <div className="rounded-lg bg-muted/30 px-2 py-1 text-center">
                <span className="text-muted-foreground">{t("trade.riskReward")}</span>
                <p className="font-mono font-medium text-muted-foreground">
                  {computeStaticRR(tc)}
                </p>
              </div>
            )}
          </div>

          {/* Tags */}
          {tc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tc.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Note from content */}
          {note && (
            <p className="text-sm text-muted-foreground italic">
              {note}
            </p>
          )}

          {/* Images */}
          {post.images.length > 0 && !post.locked && (
            <div
              className={`grid gap-2 overflow-hidden rounded-lg ${
                post.images.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-2"
              }`}
            >
              {post.images.map((img, i) => (
                <img
                  key={i}
                  src={isThumbUrl(img) ? img : toThumbUrl(img)}
                  alt={`${t("chat.postImage")} ${i + 1}`}
                  className="w-full rounded-lg object-cover"
                  style={{ maxHeight: post.images.length === 1 ? 400 : 200 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ))}
            </div>
          )}

          {/* Footer: view count + reactions */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {post.viewCount}
            </div>

            <ReactionBar
              postId={post.id}
              clanId={clanId}
              reactions={reactions}
              currentUserId={currentUserId}
            />

            <Link
              href={`/clans/${clanId}/posts/${post.id}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("chat.viewPost")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Standard text post layout
  return (
    <Card className="glass-card">
      <CardContent className="space-y-3">
        {/* Author + timestamp */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={post.author.avatar || undefined}
                alt={post.author.name || ""}
              />
              <AvatarFallback className="text-xs">
                {getInitials(post.author.name || "?")}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-sm font-medium">
                {post.author.name || t("common.unknown")}
              </span>
              <span className="ms-2 text-xs text-muted-foreground">
                {new Date(post.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.isPremium && (
              <Badge variant="default" className="gap-1">
                <Crown className="h-3 w-3" />
                {t("chat.premiumContent")}
              </Badge>
            )}
          </div>
        </div>

        {/* Risk Warning Banner */}
        {riskWarning && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {riskWarning.type === "SL_REMOVED"
                ? t("chat.slRemoved")
                : t("chat.riskViolation")}
            </span>
          </div>
        )}

        {/* Title */}
        {post.title && (
          <h3 className="text-lg font-semibold">{post.title}</h3>
        )}

        {/* Content */}
        <div className="relative">
          <p className="whitespace-pre-wrap text-sm">{post.content}</p>
          {post.locked && (
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background via-background/80 to-transparent pt-8">
              <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
                <Lock className="h-4 w-4" />
                {t("chat.premiumLocked")}
              </div>
            </div>
          )}
        </div>

        {/* Images */}
        {post.images.length > 0 && !post.locked && (
          <div
            className={`grid gap-2 overflow-hidden rounded-lg ${
              post.images.length === 1
                ? "grid-cols-1"
                : post.images.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2"
            }`}
          >
            {post.images.map((img, i) => (
              <img
                key={i}
                src={isThumbUrl(img) ? img : toThumbUrl(img)}
                alt={`${t("chat.postImage")} ${i + 1}`}
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: post.images.length === 1 ? 400 : 200 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ))}
          </div>
        )}

        {/* Footer: view count + reactions */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            {post.viewCount}
          </div>

          <ReactionBar
            postId={post.id}
            clanId={clanId}
            reactions={reactions}
            currentUserId={currentUserId}
          />

          <Link
            href={`/clans/${clanId}/posts/${post.id}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("chat.viewPost")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
