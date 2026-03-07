"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Compass,
  Megaphone,
  Eye,
  ArrowRight,
} from "lucide-react";
import { AddEmailBanner } from "@/components/shared/AddEmailBanner";
import { MissionDashboard } from "@/components/home/MissionDashboard";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useTranslation } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";

interface FeedTradeCard {
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

interface FeedPost {
  id: string;
  title: string | null;
  content: string;
  images: string[];
  isPremium: boolean;
  viewCount: number;
  sourceType: string;
  createdAt: string;
  clanId: string;
  clan: { name: string; avatar: string | null };
  author: { id: string; name: string | null; avatar: string | null };
  tradeCard: FeedTradeCard | null;
}

interface HomeFeedProps {
  userId: string;
  userName: string;
  activeSeason: {
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  clanCount: number;
  followCount: number;
  hasEmail: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HomeFeed({
  userName,
  activeSeason,
  clanCount,
  followCount,
  hasEmail,
}: HomeFeedProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchFeed = useCallback(async (p: number) => {
    try {
      const res = await fetch(`/api/me/feed?page=${p}`);
      if (res.ok) {
        const data = await res.json();
        if (p === 1) {
          setPosts(data.posts);
        } else {
          setPosts((prev) => [...prev, ...data.posts]);
        }
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(1);
  }, [fetchFeed]);

  const hasFeed = clanCount > 0 || followCount > 0;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold">{t("home.greeting", { name: userName })}</h1>
        <p className="text-sm text-muted-foreground">
          {t("home.feedSubtitle")}
        </p>
      </div>

      {/* Add email banner for EA-only users */}
      <AddEmailBanner hasEmail={hasEmail} />


      {/* Mission dashboard for new users */}
      <MissionDashboard />

      {/* Season widget */}
      {activeSeason && (
        <Card className="glass-card border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">{activeSeason.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("home.activeSeason")}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/explore?tab=leaderboard">
                {t("home.viewRankings")} <ArrowRight className="ms-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Feed */}
      {!hasFeed ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Compass className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <h2 className="text-lg font-semibold">{t("home.emptyFeed")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("home.emptyFeedDesc")}
            </p>
          </div>
          <Button asChild>
            <Link href="/explore">
              <Compass className="me-2 h-4 w-4" />
              {t("home.exploreClans")}
            </Link>
          </Button>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("home.loadingFeed")}
        </p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">{t("home.noPostsYet")}</p>
            <p className="text-xs text-muted-foreground">
              {t("home.noPostsDesc")}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {posts.map((post) => (
              <FeedPostCard key={post.id} post={post} />
            ))}
          </div>
          {page < totalPages && (
            <div className="text-center pb-4">
              <Button
                variant="outline"
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  fetchFeed(next);
                }}
              >
                {t("common.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
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

function computeStaticRR(tc: FeedTradeCard): string | null {
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

function FeedPostCard({ post }: { post: FeedPost }) {
  const { t } = useTranslation();
  const tc = post.tradeCard;

  // Signal card layout for trade card posts
  if (tc) {
    const trade = tc.trade;
    const isClosed = trade && CLOSED_STATUSES.includes(trade.status);
    const hasFourthCol =
      (isClosed && trade.finalRR != null) || computeStaticRR(tc) != null;
    const note = extractNote(post.content);

    return (
      <Link href={`/clans/${post.clanId}/posts/${post.id}`}>
        <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
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

          <div className="relative p-3 ps-4 space-y-2">
            {/* Header: clan + author + time */}
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={post.clan.avatar || undefined}
                  alt={post.clan.name}
                />
                <AvatarFallback className="text-[10px]">
                  {getInitials(post.clan.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{post.clan.name}</span>
              <span className="text-[11px] text-muted-foreground">
                · {post.author.name}
              </span>
              <span className="ms-auto text-[11px] text-muted-foreground">
                {timeAgo(post.createdAt)}
              </span>
            </div>

            {/* Direction + Instrument + Timeframe + Status */}
            <div className="flex flex-wrap items-center gap-1.5">
              <DirectionBadge direction={tc.direction as "LONG" | "SHORT"} />
              <span className="text-sm font-bold tracking-tight">
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
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                {note}
              </p>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {post.viewCount}
              </span>
              {post.isPremium && (
                <Badge variant="secondary" className="text-[10px]">
                  PRO
                </Badge>
              )}
              {post.sourceType === "AUTO_TAG" && (
                <Badge variant="outline" className="text-[10px]">
                  {t("home.autoPosted")}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Text post layout (no tradeCard)
  return (
    <Link href={`/clans/${post.clanId}/posts/${post.id}`}>
      <Card className="glass-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
        <CardContent className="py-3 space-y-2">
          {/* Header: clan + author + time */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage
                src={post.clan.avatar || undefined}
                alt={post.clan.name}
              />
              <AvatarFallback className="text-[10px]">
                {getInitials(post.clan.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium">{post.clan.name}</span>
            <span className="text-[11px] text-muted-foreground">
              · {post.author.name}
            </span>
            <span className="ms-auto text-[11px] text-muted-foreground">
              {timeAgo(post.createdAt)}
            </span>
          </div>

          {/* Title + content preview */}
          {post.title && (
            <p className="text-sm font-medium leading-tight">{post.title}</p>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2">
            {post.content}
          </p>

          {post.images.length > 0 && (
            <div className="flex gap-1">
              <img
                src={post.images[0]}
                alt=""
                className="h-16 w-16 rounded-md object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {post.viewCount}
            </span>
            {post.isPremium && (
              <Badge variant="secondary" className="text-[10px]">
                PRO
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
