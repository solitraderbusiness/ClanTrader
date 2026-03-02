"use client";

import { Download, Link2, Users, Trophy } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function Features() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: Download,
      titleKey: "landing.stepInstallEaTitle",
      descKey: "landing.stepInstallEaDesc",
    },
    {
      icon: Link2,
      titleKey: "landing.stepConnectTitle",
      descKey: "landing.stepConnectDesc",
    },
    {
      icon: Users,
      titleKey: "landing.stepJoinTitle",
      descKey: "landing.stepJoinDesc",
    },
    {
      icon: Trophy,
      titleKey: "landing.stepCompeteTitle",
      descKey: "landing.stepCompeteDesc",
    },
  ];

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold">{t("landing.howItWorks")}</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          {t("landing.howItWorksSubtitle")}
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.titleKey}
              className="glass-card relative rounded-xl p-6 text-center"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-sm font-bold text-green-400">
                {i + 1}
              </div>
              <div className="mb-3 flex justify-center">
                <step.icon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{t(step.titleKey)}</h3>
              <p className="text-sm text-muted-foreground">
                {t(step.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
