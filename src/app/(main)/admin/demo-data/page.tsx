"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";
import { Zap, Database } from "lucide-react";

export default function DemoDataPage() {
  const [clanCount, setClanCount] = useState(2);
  const [tradesPerClan, setTradesPerClan] = useState(15);
  const [loading, setLoading] = useState(false);
  const [populatingAll, setPopulatingAll] = useState(false);
  const [result, setResult] = useState<{
    clans: { id: string; name: string }[];
    totalTrades: number;
    rankingsCount?: number;
  } | null>(null);

  async function handleGenerate(populateAll = false) {
    if (populateAll) {
      setPopulatingAll(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/admin/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clanCount, tradesPerClan, populateAll }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setResult(data);

      if (populateAll) {
        toast.success(
          `Generated ${data.clans.length} clans, ${data.totalTrades} trades, ${data.rankingsCount || 0} rankings`
        );
      } else {
        toast.success(
          `Generated ${data.clans.length} clans with ${data.totalTrades} trades`
        );
      }
    } catch {
      toast.error("Failed to generate demo data");
    } finally {
      setLoading(false);
      setPopulatingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Demo Data</h1>
        <p className="text-sm text-muted-foreground">
          Generate realistic test data for development and demos. This creates
          fake clans with members, trade signals, and optionally computes all
          downstream data (statements, rankings).
        </p>
      </div>

      {/* Populate Everything */}
      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4 text-blue-500" />
            Populate Everything
            <InfoTip side="right">
              Creates demo clans &amp; trades, then runs the full pipeline:
              calculates trader statements (monthly performance summaries) for
              ALL clans and builds leaderboard rankings for all active seasons.
              After this, the dashboard, leaderboard, discover, and statements
              pages will all show data.
            </InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            One-click full pipeline: creates demo clans + trades, then
            calculates statements and leaderboard rankings. Use this when you
            want the entire platform to look alive with data.
          </p>

          <div className="flex gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Number of Clans
                <InfoTip>
                  How many demo clans to create. Each clan gets random members,
                  a chat topic, and its own set of trade signals.
                </InfoTip>
              </Label>
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
              <Label className="flex items-center gap-1">
                Trades per Clan
                <InfoTip>
                  How many trade signal cards to create inside each demo clan.
                  Each trade gets a random instrument (XAUUSD, EURUSD, etc.),
                  direction, entry/SL/TP, and a resolved status (win, loss, or
                  break-even).
                </InfoTip>
              </Label>
              <Input
                type="number"
                min={5}
                max={50}
                value={tradesPerClan}
                onChange={(e) =>
                  setTradesPerClan(parseInt(e.target.value) || 5)
                }
                className="max-w-[100px]"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => handleGenerate(true)}
              disabled={loading || populatingAll}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="me-1 h-4 w-4" />
              {populatingAll
                ? "Populating everything..."
                : "Populate Everything"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleGenerate(false)}
              disabled={loading || populatingAll}
            >
              <Database className="me-1 h-4 w-4" />
              {loading ? "Generating..." : "Generate Data Only"}
            </Button>
          </div>

          <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              What&apos;s the difference?
            </p>
            <p>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                Populate Everything
              </span>{" "}
              = Creates data + calculates statements + builds rankings. The
              full pipeline — dashboard, leaderboard, and discover will all
              show real data.
            </p>
            <p>
              <span className="font-medium">Generate Data Only</span> =
              Creates clans + trades only. Useful if you want raw data without
              recomputing statements and rankings (faster).
            </p>
          </div>

          {result && (
            <div className="mt-4 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                Generated {result.clans.length} clans, {result.totalTrades}{" "}
                trades
                {result.rankingsCount
                  ? `, ${result.rankingsCount} ranking entries`
                  : ""}
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
