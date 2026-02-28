"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  level: "INFO" | "WARN" | "ERROR";
  category: "AUTH" | "EA" | "TRADE" | "CHAT" | "ADMIN" | "SYSTEM";
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  info24h: number;
  warn24h: number;
  error24h: number;
}

const CATEGORIES = ["ALL", "AUTH", "EA", "TRADE", "CHAT", "ADMIN", "SYSTEM"] as const;

const LEVEL_COLORS: Record<string, string> = {
  INFO: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  WARN: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  ERROR: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const CATEGORY_COLORS: Record<string, string> = {
  AUTH: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  EA: "bg-green-500/15 text-green-700 dark:text-green-400",
  TRADE: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  CHAT: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  ADMIN: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  SYSTEM: "bg-gray-500/15 text-gray-700 dark:text-gray-400",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [category, setCategory] = useState<string>("ALL");
  const [level, setLevel] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [liveMode, setLiveMode] = useState(false);

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce timer for search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (level !== "ALL") params.set("level", level);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("to", new Date(dateTo).toISOString());
      params.set("page", String(page));
      params.set("limit", "50");

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination);
      if (data.stats) setStats(data.stats);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [category, level, debouncedSearch, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Live mode polling
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [liveMode, fetchLogs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">
            Structured activity log for all system and admin events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="live-mode" className="text-sm text-muted-foreground">
            Live
          </Label>
          <Switch
            id="live-mode"
            checked={liveMode}
            onCheckedChange={setLiveMode}
          />
        </div>
      </div>

      {/* Stats badges */}
      {stats && (
        <div className="flex gap-3">
          <Card className="flex-1 py-3">
            <CardContent className="p-0 px-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">INFO (24h)</span>
              <Badge className={LEVEL_COLORS.INFO}>{stats.info24h}</Badge>
            </CardContent>
          </Card>
          <Card className="flex-1 py-3">
            <CardContent className="p-0 px-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">WARN (24h)</span>
              <Badge className={LEVEL_COLORS.WARN}>{stats.warn24h}</Badge>
            </CardContent>
          </Card>
          <Card className="flex-1 py-3">
            <CardContent className="p-0 px-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">ERROR (24h)</span>
              <Badge className={LEVEL_COLORS.ERROR}>{stats.error24h}</Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category tabs */}
      <Tabs
        value={category}
        onValueChange={(val) => {
          setCategory(val);
          setPage(1);
        }}
      >
        <TabsList className="flex-wrap">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={level}
          onValueChange={(val) => {
            setLevel(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Levels</SelectItem>
            <SelectItem value="INFO">INFO</SelectItem>
            <SelectItem value="WARN">WARN</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search actions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[200px]"
        />

        <Input
          type="datetime-local"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
          placeholder="From"
        />
        <Input
          type="datetime-local"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
          placeholder="To"
        />

        {(category !== "ALL" || level !== "ALL" || debouncedSearch || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategory("ALL");
              setLevel("ALL");
              setSearch("");
              setDebouncedSearch("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Log list */}
      {loading && logs.length === 0 ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground">
          No logs found. Try adjusting your filters.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">
                {pagination?.total || 0} logs found
                {liveMode && (
                  <span className="ms-2 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {logs.map((log) => (
                  <div key={log.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-start hover:bg-muted/50 transition-colors"
                      onClick={() =>
                        setExpandedId(expandedId === log.id ? null : log.id)
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            className={`${LEVEL_COLORS[log.level]} text-[10px] font-mono shrink-0`}
                          >
                            {log.level}
                          </Badge>
                          <Badge
                            className={`${CATEGORY_COLORS[log.category]} text-[10px] font-mono shrink-0`}
                          >
                            {log.category}
                          </Badge>
                          <span className="text-sm font-medium truncate">
                            {log.action}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {timeAgo(log.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {log.entityType}
                          {log.entityId !== "-" && `:${log.entityId.slice(0, 8)}`}
                        </span>
                        {log.actorId && (
                          <span>actor:{log.actorId.slice(0, 8)}</span>
                        )}
                      </div>
                    </button>
                    {expandedId === log.id && log.metadata && (
                      <div className="px-4 pb-3">
                        <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-64">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
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
