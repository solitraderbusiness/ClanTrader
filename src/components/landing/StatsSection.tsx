"use client";

import { useTranslation } from "@/lib/i18n";

export function StatsSection() {
  const { t } = useTranslation();

  const stats = [
    { value: "2,400+", labelKey: "landing.activeTraders" },
    { value: "180K+", labelKey: "landing.verifiedTrades" },
    { value: "320+", labelKey: "landing.activeClans" },
    { value: "12", labelKey: "landing.monthlySeasons" },
  ];

  return (
    <section className="border-y border-white/10 py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.labelKey} className="text-center">
            <p className="text-3xl font-bold text-green-400">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t(stat.labelKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
