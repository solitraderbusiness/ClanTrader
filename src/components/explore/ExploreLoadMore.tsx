"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

interface Props {
  page: number;
}

export function ExploreLoadMore({ page }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLoadMore = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page + 1));
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex justify-center">
      <button
        onClick={handleLoadMore}
        className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
      >
        {t("common.loadMore")}
      </button>
    </div>
  );
}
