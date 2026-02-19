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
  tradeCard: {
    instrument: string;
    direction: string;
    entry: number;
    tags: string[];
  } | null;
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
}: HomeFeedProps) {
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
        <h1 className="text-xl font-bold">Hey, {userName}</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s new from your clans and channels.
        </p>
      </div>

      {/* Season widget */}
      {activeSeason && (
        <Card className="border-primary/20">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">{activeSeason.name}</p>
                <p className="text-xs text-muted-foreground">
                  Active season
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/explore?tab=leaderboard">
                View Rankings <ArrowRight className="ms-1 h-3 w-3" />
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
            <h2 className="text-lg font-semibold">Your feed is empty</h2>
            <p className="text-sm text-muted-foreground">
              Follow some clans or join one to see posts here.
            </p>
          </div>
          <Button asChild>
            <Link href="/explore">
              <Compass className="me-2 h-4 w-4" />
              Explore Clans
            </Link>
          </Button>
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Loading feed...
        </p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">No posts yet</p>
            <p className="text-xs text-muted-foreground">
              The clans you follow haven&apos;t posted anything yet.
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
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <Link href={`/clans/${post.clanId}/posts/${post.id}`}>
      <Card className="transition-colors hover:bg-accent/30">
        <CardContent className="py-3 space-y-2">
          {/* Header: clan + author + time */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage
                src={post.clan.avatar || undefined}
                alt={post.clan.name}
              />
              <AvatarFallback className="text-[10px]">
                {post.clan.name.slice(0, 2).toUpperCase()}
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

          {/* Trade card badge */}
          {post.tradeCard && (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {post.tradeCard.direction} {post.tradeCard.instrument}
              </Badge>
              {post.tradeCard.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Title + content preview */}
          {post.title && (
            <p className="text-sm font-medium leading-tight">{post.title}</p>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2">
            {post.content}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
                Auto-posted
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
