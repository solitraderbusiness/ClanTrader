import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClanCard } from "@/components/clan/ClanCard";
import { FreeAgentCard } from "@/components/discover/FreeAgentCard";
import { FilterBar } from "@/components/discover/FilterBar";
import { Suspense } from "react";

export const metadata = { title: "Discover" };

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
    return <p className="text-sm text-muted-foreground">Failed to load free agents.</p>;
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
          metrics: { winRate: number; profitFactor: number; totalTrades: number };
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
    return <p className="text-sm text-muted-foreground">Failed to load clans.</p>;
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

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams.tab || "agents";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Discover</h1>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="agents">Free Agents</TabsTrigger>
          <TabsTrigger value="clans">Clans</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
