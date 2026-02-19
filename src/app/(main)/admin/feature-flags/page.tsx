"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  updatedAt: string;
}

const FLAG_TIPS: Record<string, string> = {
  trade_cards: "When ON, traders can create structured trade signal cards (with entry, SL, TP) inside clan chat instead of plain text messages.",
  trade_tracking: "When ON, trade cards get tracked over time — their status (TP hit, SL hit, etc.) is recorded and used for performance stats.",
  trade_actions: "When ON, traders can use the action menu on trade cards to Set BE, Move SL, Change TP, Close, or Add Notes.",
  topics: "When ON, clan chats can be organized into multiple topic channels (e.g. 'General', 'Gold Signals').",
  auto_post: "When ON, trade cards tagged as 'signal' are automatically posted to the clan's public channel feed.",
  channel_posts: "When ON, clans have a broadcast channel feed where leaders can publish posts visible to followers.",
  leaderboard: "When ON, the seasonal leaderboard page shows trader rankings based on their signal performance.",
  discover: "When ON, the Discover page is available for users to browse and find public clans and free agents.",
  summary: "When ON, AI-powered chat summaries can be generated for clan conversations (requires AI API).",
  paywall: "When ON, paywall rules are enforced — free users see redacted signal details in the public channel.",
  alerts: "When ON, users can set price alerts and event notifications (not yet implemented).",
  ai_features: "When ON, AI-powered analysis features like trade suggestions are available (not yet implemented).",
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/feature-flags")
      .then((r) => r.json())
      .then((data) => setFlags(data.flags || []))
      .catch(() => toast.error("Failed to load flags"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFlag(key: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) throw new Error();

      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled } : f))
      );
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle flag");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground">
          Turn platform features on or off globally.{" "}
          <span className="font-medium">{enabledCount}/{flags.length}</span> enabled.
        </p>
      </div>

      {flags.length === 0 ? (
        <p className="text-muted-foreground">
          No feature flags configured. Run seed to create defaults.
        </p>
      ) : (
        <div className="space-y-2">
          {flags.map((flag) => (
            <Card
              key={flag.id}
              className={flag.enabled ? "border-green-200 dark:border-green-900" : ""}
            >
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {flag.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {flag.key}
                    </Badge>
                    {FLAG_TIPS[flag.key] && (
                      <InfoTip>{FLAG_TIPS[flag.key]}</InfoTip>
                    )}
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={(checked) => toggleFlag(flag.key, checked)}
                  />
                </div>
                {flag.description && (
                  <p className="text-xs text-muted-foreground pt-1">
                    {flag.description}
                  </p>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
