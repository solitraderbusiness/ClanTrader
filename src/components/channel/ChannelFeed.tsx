"use client";

import { useState } from "react";
import { ChannelPostCard } from "./ChannelPostCard";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface PostData {
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
}

interface ChannelFeedProps {
  clanId: string;
  initialPosts: PostData[];
  initialPagination: {
    page: number;
    total: number;
    totalPages: number;
  };
  currentUserId: string | null;
}

export function ChannelFeed({
  clanId,
  initialPosts,
  initialPagination,
  currentUserId,
}: ChannelFeedProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<PostData[]>(initialPosts);
  const [page, setPage] = useState(initialPagination.page);
  const [totalPages, setTotalPages] = useState(initialPagination.totalPages);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(
        `/api/clans/${clanId}/posts?page=${nextPage}`
      );

      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [...prev, ...data.posts]);
        setPage(nextPage);
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMore(false);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Megaphone className="h-12 w-12 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">{t("chat.noPostsYet")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("chat.noPostsDesc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <ChannelPostCard
          key={post.id}
          post={post}
          clanId={clanId}
          currentUserId={currentUserId}
        />
      ))}

      {page < totalPages && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? t("common.loading") : t("common.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
