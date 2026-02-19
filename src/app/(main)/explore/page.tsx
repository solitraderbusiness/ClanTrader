import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClanCard } from "@/components/clan/ClanCard";
import { FreeAgentCard } from "@/components/discover/FreeAgentCard";
import { FilterBar } from "@/components/discover/FilterBar";
import { LeaderboardClient } from "@/components/explore/LeaderboardClient";
import { Suspense } from "react";

export const metadata = { title: "Explore" };

async function FreeAgentsList({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const params = new URLSearchParams(searchParams);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/discover/free-agents?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return (
      <p className="text-sm text-muted-foreground">
        Failed to load free agents.
      </p>
    );
  }

  const data = await res.json();

  if (data.freeAgents.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No free agents found matching your filters.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {data.freeAgents.map(
        (agent: {
          id: string;
          name: string | null;
          avatar: string | null;
          tradingStyle: string | null;
          preferredPairs: string[];
          metrics: {
            winRate: number;
            profitFactor: number;
            totalTrades: number;
          };
        }) => (
          <FreeAgentCard key={agent.id} agent={agent} />
        )
      )}
    </div>
  );
}

async function ClansList({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const params = new URLSearchParams(searchParams);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(
    `${baseUrl}/api/discover/clans?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return (
      <p className="text-sm text-muted-foreground">Failed to load clans.</p>
    );
  }

  const data = await res.json();

  if (data.clans.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No clans found matching your filters.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {data.clans.map(
        (clan: {
          id: string;
          name: string;
          description?: string | null;
          avatar?: string | null;
          tradingFocus?: string | null;
          tier: string;
          _count: { members: number };
          followerCount: number;
        }) => (
          <ClanCard key={clan.id} clan={clan} />
        )
      )}
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams.tab || "clans";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Explore</h1>
        <p className="text-sm text-muted-foreground">
          Discover clans, traders, and rankings.
        </p>
      </div>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="clans">Clans</TabsTrigger>
          <TabsTrigger value="agents">Free Agents</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="clans" className="space-y-4">
          <Suspense fallback={null}>
            <FilterBar mode="clans" />
          </Suspense>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading...</p>
            }
          >
            <ClansList searchParams={resolvedSearchParams} />
          </Suspense>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Suspense fallback={null}>
            <FilterBar mode="agents" />
          </Suspense>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading...</p>
            }
          >
            <FreeAgentsList searchParams={resolvedSearchParams} />
          </Suspense>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <LeaderboardClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
