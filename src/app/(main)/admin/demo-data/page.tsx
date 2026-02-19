"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DemoDataPage() {
  const [clanCount, setClanCount] = useState(2);
  const [tradesPerClan, setTradesPerClan] = useState(15);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    clans: { id: string; name: string }[];
    totalTrades: number;
  } | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clanCount, tradesPerClan }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setResult(data);
      toast.success(`Generated ${data.clans.length} clans with ${data.totalTrades} trades`);
    } catch {
      toast.error("Failed to generate demo data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Demo Data</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Generate Demo Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Creates demo clans with traders, trade cards, tracked trades, and
            calculated statements for testing.
          </p>

          <div className="flex gap-4">
            <div className="space-y-2">
              <Label>Number of Clans</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={clanCount}
                onChange={(e) => setClanCount(parseInt(e.target.value) || 1)}
                className="max-w-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Trades per Clan</Label>
              <Input
                type="number"
                min={5}
                max={50}
                value={tradesPerClan}
                onChange={(e) => setTradesPerClan(parseInt(e.target.value) || 5)}
                className="max-w-[100px]"
              />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate Demo Data"}
          </Button>

          {result && (
            <div className="mt-4 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                Generated {result.clans.length} clans, {result.totalTrades} total
                trades
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {result.clans.map((clan) => (
                  <li key={clan.id}>{clan.name}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
