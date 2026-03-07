"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { ExploreFilterBar } from "./ExploreFilterBar";
import { ExploreClanCard } from "./ExploreClanCard";
import type { ExploreClanItem } from "@/types/explore";

export function ExploreClient() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const [clans, setClans] = useState<ExploreClanItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClans = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        setError(null);
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(pageNum));
        if (!params.has("limit")) params.set("limit", "20");

        const res = await fetch(`/api/explore/clans?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API ${res.status}: ${text}`);
        }
        const data = await res.json();

        if (append) {
          setClans((prev) => [...prev, ...data.clans]);
        } else {
          setClans(data.clans);
        }
        setTotal(data.total);
      } catch (err) {
        console.error("[ExploreClient] fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchParams, t]
  );

  // Re-fetch when filters change
  useEffect(() => {
    setPage(1);
    fetchClans(1, false);
  }, [fetchClans]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchClans(nextPage, true);
  };

  const hasMore = clans.length < total;

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{t("explore.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("explore.subtitle")}
          </p>
        </div>
        <ExploreFilterBar />
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("explore.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("explore.subtitle")}
        </p>
      </div>
      <ExploreFilterBar />

      {error && (
        <p className="py-4 text-center text-sm text-red-500">
          {error}
        </p>
      )}

      {clans.length === 0 && !error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("explore.noClansFound")}
        </p>
      ) : (
        <div className="grid gap-3">
          {clans.map((clan) => (
            <ExploreClanCard key={clan.id} clan={clan} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {loadingMore ? t("common.loading") : t("common.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
