"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  Rocket,
  PartyPopper,
  Compass,
  Eye,
  Users,
  BarChart3,
  Send,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Compass,
  Eye,
  Users,
  BarChart3,
  Send,
};

interface Mission {
  id: string;
  labelKey: string;
  descriptionKey: string;
  completed: boolean;
  href: string;
  icon: string;
}

export function MissionDashboard() {
  const { t } = useTranslation();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("missions_dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) return;
    fetch("/api/users/me/missions")
      .then((res) => res.json())
      .then((data) => setMissions(data.missions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dismissed]);

  if (loading || dismissed) return null;

  const completedCount = missions.filter((m) => m.completed).length;
  const allComplete = completedCount === missions.length && missions.length > 0;
  const spotlightIndex = missions.findIndex((m) => !m.completed);

  if (allComplete) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="flex items-center gap-3 py-3">
          <PartyPopper className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {t("missions.allComplete")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              try { localStorage.setItem("missions_dismissed", "1"); } catch {}
              setDismissed(true);
            }}
          >
            {t("common.dismiss")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const progressPercent =
    missions.length > 0 ? (completedCount / missions.length) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            {t("missions.getStarted")}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {t("missions.progress", {
              completed: String(completedCount),
              total: String(missions.length),
            })}
          </span>
        </CardTitle>
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted mt-1">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {missions.map((mission, idx) => {
          const Icon = ICON_MAP[mission.icon] || Compass;
          const isCompleted = mission.completed;
          const isSpotlight = idx === spotlightIndex;
          const isFuture = !isCompleted && !isSpotlight;

          // Completed: compact row with green check
          if (isCompleted) {
            return (
              <div
                key={mission.id}
                className="flex items-center gap-3 rounded-md p-2 opacity-60"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                <p className="text-sm line-through text-muted-foreground">
                  {t(mission.labelKey)}
                </p>
              </div>
            );
          }

          // Spotlight: expanded card with border, description, CTA
          if (isSpotlight) {
            return (
              <div
                key={mission.id}
                className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 my-2"
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-semibold">
                      {t(mission.labelKey)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(mission.descriptionKey)}
                    </p>
                    <Button asChild size="sm" className="w-full sm:w-auto">
                      <Link href={mission.href}>
                        {t("missions.spotlightCta")}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          // Future: dimmed, not clickable
          if (isFuture) {
            return (
              <div
                key={mission.id}
                className="flex items-center gap-3 rounded-md p-2 opacity-40"
              >
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t(mission.labelKey)}
                </p>
              </div>
            );
          }

          return null;
        })}
      </CardContent>
    </Card>
  );
}
