"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { StatementHistory } from "@/components/statements/StatementHistory";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { TraderStatementMetrics } from "@/types/trader-statement";

interface Statement {
  id: string;
  periodType: string;
  periodKey: string;
  tradeCount: number;
  metrics: TraderStatementMetrics;
  calculatedAt: string;
  user: { id: string; name: string | null; avatar: string | null };
}

export default function ClanStatementsPage() {
  const params = useParams();
  const clanId = params.clanId as string;
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<string>("MONTHLY");

  const fetchStatements = useCallback(async () => {
    try {
      const res = await fetch(`/api/clans/${clanId}/statements?periodType=${periodType}`);
      const data = await res.json();
      setStatements(data.statements || []);
    } catch {
      toast.error("Failed to load statements");
    } finally {
      setLoading(false);
    }
  }, [clanId, periodType]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statements</h1>
        <div className="flex gap-1">
          {(["MONTHLY", "SEASONAL", "ALL_TIME"] as const).map((pt) => (
            <Button
              key={pt}
              variant={periodType === pt ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodType(pt)}
            >
              {pt.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <StatementHistory statements={statements} showUser={true} />
      )}
    </div>
  );
}
