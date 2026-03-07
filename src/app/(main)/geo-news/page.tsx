"use client";

import { useTranslation } from "@/lib/i18n";
import { Globe, ExternalLink, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MapLink {
  key: string;
  url: string;
  color: string;
}

interface Section {
  sectionKey: string;
  icon: LucideIcon;
  maps: MapLink[];
}

const SECTIONS: Section[] = [
  {
    sectionKey: "iran",
    icon: Globe,
    maps: [
      { key: "Iran", url: "https://iran.liveuamap.com", color: "bg-amber-500" },
    ],
  },
  {
    sectionKey: "ukraine",
    icon: Globe,
    maps: [
      { key: "Ukraine", url: "https://liveuamap.com", color: "bg-blue-500" },
    ],
  },
  {
    sectionKey: "middleEast",
    icon: Globe,
    maps: [
      { key: "IsraelPalestine", url: "https://israelpalestine.liveuamap.com", color: "bg-red-500" },
      { key: "Syria", url: "https://syria.liveuamap.com", color: "bg-orange-500" },
      { key: "Iraq", url: "https://iraq.liveuamap.com", color: "bg-rose-500" },
      { key: "Yemen", url: "https://yemen.liveuamap.com", color: "bg-pink-500" },
      { key: "Kurds", url: "https://kurds.liveuamap.com", color: "bg-teal-500" },
      { key: "Emirates", url: "https://emirates.liveuamap.com", color: "bg-sky-500" },
    ],
  },
  {
    sectionKey: "world",
    icon: TrendingUp,
    maps: [
      { key: "TradeWars", url: "https://tradewars.liveuamap.com", color: "bg-emerald-500" },
    ],
  },
];

function MapCard({ map, t }: { map: MapLink; t: (key: string) => string }) {
  return (
    <a
      href={map.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${map.color}`}>
        <Globe className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t(`geoNews.map${map.key}`)}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

export default function GeoNewsPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24 lg:pb-6">
      <div>
        <h1 className="text-2xl font-bold">{t("geoNews.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("geoNews.subtitle")}
        </p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.sectionKey} className="space-y-2">
          <div className="flex items-center gap-2">
            <section.icon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {t(`geoNews.section${section.sectionKey[0].toUpperCase()}${section.sectionKey.slice(1)}`)}
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {section.maps.map((map) => (
              <MapCard key={map.key} map={map} t={t} />
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          {t("geoNews.disclaimer")}
        </p>
      </div>
    </div>
  );
}
