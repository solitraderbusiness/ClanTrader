"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricsDisplay } from "@/components/statements/MetricsDisplay";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { StatementMetrics } from "@/types/statement";

interface Statement {
  id: string;
  originalFilename: string;
  verificationStatus: string;
  verificationMethod: string;
  extractedMetrics: StatementMetrics | null;
  reviewNotes: string | null;
  uploadedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

interface StatementListProps {
  statements: Statement[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  VERIFIED: { label: "Verified", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  EXPIRED: { label: "Expired", variant: "outline" },
};

export function StatementList({ statements }: StatementListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (statements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No statements uploaded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {statements.map((stmt) => {
        const config = statusConfig[stmt.verificationStatus] || statusConfig.PENDING;
        const isExpanded = expanded.has(stmt.id);

        return (
          <Card key={stmt.id}>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-sm">{stmt.originalFilename}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(stmt.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={config.variant}>{config.label}</Badge>
                  {stmt.extractedMetrics && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(stmt.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {isExpanded && stmt.extractedMetrics && (
              <CardContent>
                <MetricsDisplay metrics={stmt.extractedMetrics} />
              </CardContent>
            )}
            {stmt.verificationStatus === "REJECTED" && stmt.reviewNotes && (
              <CardContent className="pt-0">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <p className="text-xs font-medium text-red-600">Review Notes</p>
                  <p className="text-sm text-red-600">{stmt.reviewNotes}</p>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
