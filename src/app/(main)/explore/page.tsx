import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getExploreClans } from "@/services/explore.service";
import { ExploreFilterBar } from "@/components/explore/ExploreFilterBar";
import { ExploreClanCard } from "@/components/explore/ExploreClanCard";
import { ExploreLoadMore } from "@/components/explore/ExploreLoadMore";
import { Button } from "@/components/ui/button";
import { CreateClanButton } from "@/components/clan/CreateClanButton";
import { t } from "@/lib/i18n-core";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "Explore" };

interface Props {
  searchParams: Promise<Record<string, string>>;
}

export default async function ExplorePage({ searchParams }: Props) {
  const params = await searchParams;
  const sort = (params.sort as "totalR" | "winRate" | "avgTradesPerWeek" | "followers") || "totalR";
  const tradingFocus = params.tradingFocus || undefined;
  const minWinRate = params.minWinRate ? Number(params.minWinRate) : undefined;
  const q = params.q || undefined;
  const page = params.page ? Number(params.page) : 1;

  const { clans, total } = await getExploreClans({
    sort,
    tradingFocus,
    minWinRate,
    q,
    page,
    limit: 20,
  });

  const hasMore = clans.length < total;

  // Fetch auth + membership for create clan guard
  const session = await auth();
  let isInClan = false;
  let currentClanInfo: {
    id: string;
    name: string;
    memberCount: number;
    userRole: string;
    members?: { userId: string; name: string }[];
  } | null = null;

  if (session?.user?.id) {
    const membership = await db.clanMember.findFirst({
      where: { userId: session.user.id },
      include: {
        clan: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    if (membership) {
      isInClan = true;
      currentClanInfo = {
        id: membership.clan.id,
        name: membership.clan.name,
        memberCount: membership.clan._count.members,
        userRole: membership.role,
      };

      // If leader with >1 members, fetch non-leader members for transfer picker
      if (membership.role === "LEADER" && membership.clan._count.members > 1) {
        const otherMembers = await db.clanMember.findMany({
          where: { clanId: membership.clan.id, role: { not: "LEADER" } },
          include: { user: { select: { id: true, name: true } } },
          take: 50,
        });
        currentClanInfo.members = otherMembers.map((m) => ({
          userId: m.userId,
          name: m.user.name || "Unknown",
        }));
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("en", "explore.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("en", "explore.subtitle")}
          </p>
        </div>
        {session?.user?.id ? (
          <CreateClanButton
            isInClan={isInClan}
            currentClanInfo={currentClanInfo}
            currentUserId={session.user.id}
            label={t("en", "explore.createClan")}
          />
        ) : (
          <Button asChild>
            <Link href="/clans/create">
              <Plus className="me-2 h-4 w-4" />
              {t("en", "explore.createClan")}
            </Link>
          </Button>
        )}
      </div>

      <Suspense>
        <ExploreFilterBar />
      </Suspense>

      {clans.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("en", "explore.noClansFound")}
        </p>
      ) : (
        <div className="grid gap-3">
          {clans.map((clan) => (
            <ExploreClanCard key={clan.id} clan={clan} />
          ))}
        </div>
      )}

      {hasMore && (
        <Suspense>
          <ExploreLoadMore page={page} />
        </Suspense>
      )}
    </div>
  );
}
