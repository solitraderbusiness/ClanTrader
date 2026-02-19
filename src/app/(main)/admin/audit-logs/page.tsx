"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityType", entityFilter);
      params.set("page", String(page));

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Every admin action and important system event is logged here. Use the
          filters to find specific actions.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="space-y-1">
          <Input
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="max-w-[200px]"
          />
          <p className="text-[10px] text-muted-foreground ps-1">
            e.g. TOGGLE, CREATE, DELETE
          </p>
        </div>
        <div className="space-y-1">
          <Input
            placeholder="Filter by entity type..."
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="max-w-[200px]"
          />
          <p className="text-[10px] text-muted-foreground ps-1">
            e.g. FeatureFlag, Trade, Clan
          </p>
        </div>
        <div className="pt-0.5">
          <InfoTip>
            Audit logs track all admin actions: toggling feature flags, managing
            clans, generating demo data, calculating rankings, and more.
            Metadata contains the details of each action.
          </InfoTip>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground">
          No audit logs found. Try adjusting your filters, or perform some admin
          actions first.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {pagination?.total || 0} logs found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between border-b pb-2 text-sm last:border-0"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {log.action}
                        </Badge>
                        <span className="text-muted-foreground">
                          {log.entityType}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {log.entityId}
                      </p>
                      {log.actorId && (
                        <p className="text-xs text-muted-foreground">
                          Actor: {log.actorId.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
