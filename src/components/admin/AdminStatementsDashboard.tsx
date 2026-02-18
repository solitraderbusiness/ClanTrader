"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MetricsDisplay } from "@/components/statements/MetricsDisplay";
import { FileText, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import type { StatementMetrics } from "@/types/statement";
import { toast } from "sonner";

interface StatementUser {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

interface AdminStatement {
  id: string;
  userId: string;
  user: StatementUser;
  filePath: string;
  originalFilename: string;
  verificationStatus: string;
  verificationMethod: string;
  extractedMetrics: StatementMetrics | null;
  reviewNotes: string | null;
  uploadedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

interface Counts {
  all: number;
  pending: number;
  verified: number;
  rejected: number;
  expired: number;
}

interface AdminStatementsDashboardProps {
  initialStatements: AdminStatement[];
  initialCounts: Counts;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  VERIFIED: { label: "Verified", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  EXPIRED: { label: "Expired", variant: "outline" },
};

export function AdminStatementsDashboard({
  initialStatements,
  initialCounts,
}: AdminStatementsDashboardProps) {
  const [statements, setStatements] = useState(initialStatements);
  const [counts, setCounts] = useState(initialCounts);
  const [activeTab, setActiveTab] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [reviewStatement, setReviewStatement] = useState<AdminStatement | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchStatements = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== "ALL") params.set("status", status);
      const res = await fetch(`/api/admin/statements?${params}`);
      const data = await res.json();
      if (res.ok) {
        setStatements(data.statements);
        setCounts(data.counts);
      }
    } catch {
      toast.error("Failed to fetch statements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatements(activeTab);
  }, [activeTab, fetchStatements]);

  const handleReview = async (status: "VERIFIED" | "REJECTED") => {
    if (!reviewStatement) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/statements/${reviewStatement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNotes: reviewNotes || undefined,
        }),
      });

      if (res.ok) {
        toast.success(
          status === "VERIFIED"
            ? "Statement approved"
            : "Statement rejected"
        );
        setReviewStatement(null);
        setReviewNotes("");
        fetchStatements(activeTab);
      } else {
        const data = await res.json();
        toast.error(data.error || "Review failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ALL">
            All ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="PENDING">
            Pending ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="VERIFIED">
            Verified ({counts.verified})
          </TabsTrigger>
          <TabsTrigger value="REJECTED">
            Rejected ({counts.rejected})
          </TabsTrigger>
          <TabsTrigger value="EXPIRED">
            Expired ({counts.expired})
          </TabsTrigger>
        </TabsList>

        {/* All tab contents share the same list */}
        {["ALL", "PENDING", "VERIFIED", "REJECTED", "EXPIRED"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : statements.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No statements found.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {statements.map((stmt) => {
                  const config = statusConfig[stmt.verificationStatus] || statusConfig.PENDING;
                  const initials = stmt.user.name
                    ? stmt.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                    : "U";
                  return (
                    <Card key={stmt.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={stmt.user.avatar || undefined} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-sm">
                                {stmt.user.name || stmt.user.email}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {stmt.originalFilename} &middot;{" "}
                                {new Date(stmt.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={config.variant}>{config.label}</Badge>
                            {stmt.verificationStatus === "PENDING" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setReviewStatement(stmt);
                                  setReviewNotes("");
                                }}
                              >
                                Review
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Review Dialog */}
      <Dialog
        open={!!reviewStatement}
        onOpenChange={(open) => {
          if (!open) {
            setReviewStatement(null);
            setReviewNotes("");
          }
        }}
      >
        {reviewStatement && (
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Statement</DialogTitle>
              <DialogDescription>
                {reviewStatement.user.name || reviewStatement.user.email} &middot;{" "}
                {reviewStatement.originalFilename}
              </DialogDescription>
            </DialogHeader>

            {reviewStatement.extractedMetrics && (
              <MetricsDisplay metrics={reviewStatement.extractedMetrics} />
            )}

            <a
              href={reviewStatement.filePath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View Original HTML
            </a>

            <div>
              <label
                htmlFor="reviewNotes"
                className="mb-1 block text-sm font-medium"
              >
                Review Notes (optional)
              </label>
              <textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about this review..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => handleReview("REJECTED")}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject
              </Button>
              <Button
                onClick={() => handleReview("VERIFIED")}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
