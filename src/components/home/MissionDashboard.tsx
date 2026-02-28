"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ArrowRight,
  Rocket,
  PartyPopper,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Mission {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
}

export function MissionDashboard() {
  const { t } = useTranslation();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/users/me/missions")
      .then((res) => res.json())
      .then((data) => setMissions(data.missions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || dismissed) return null;

  const completedCount = missions.filter((m) => m.completed).length;
  const allComplete = completedCount === missions.length && missions.length > 0;

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
            onClick={() => setDismissed(true)}
          >
            {t("common.dismiss")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4 text-primary" />
          {t("missions.getStarted", { count: `${completedCount}/${missions.length}` })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {missions.map((mission) => (
          <div
            key={mission.id}
            className={`flex items-center gap-3 rounded-md p-2 ${
              mission.completed ? "opacity-60" : ""
            }`}
          >
            <CheckCircle2
              className={`h-4 w-4 shrink-0 ${
                mission.completed
                  ? "text-green-500"
                  : "text-muted-foreground/30"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm ${
                  mission.completed
                    ? "line-through text-muted-foreground"
                    : "font-medium"
                }`}
              >
                {mission.label}
              </p>
              {!mission.completed && (
                <p className="text-xs text-muted-foreground truncate">
                  {mission.description}
                </p>
              )}
            </div>
            {!mission.completed && (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href={mission.href}>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
