"use client";

import { useTranslation } from "@/lib/i18n";

export default function DownloadPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t("download.title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("download.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-6 space-y-3">
          <h2 className="text-lg font-semibold">{t("download.mt4")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("download.mt4Desc")}
          </p>
          <a
            href="/ea/ClanTrader_EA.mq4"
            download
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("download.downloadMq4")}
          </a>
        </div>
        <div className="rounded-lg border p-6 space-y-3">
          <h2 className="text-lg font-semibold">{t("download.mt5")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("download.mt5Desc")}
          </p>
          <a
            href="/ea/ClanTrader_EA.mq5"
            download
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("download.downloadMq5")}
          </a>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t("download.installGuide")}</h2>

        <div className="space-y-3">
          <Step number={1} title={t("download.step1Title")}>
            {t("download.step1Desc")}
          </Step>
          <Step number={2} title={t("download.step2Title")}>
            {t("download.step2Desc")}
          </Step>
          <Step number={3} title={t("download.step3Title")}>
            {t("download.step3Desc")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              https://clantrader.ir
            </code>
          </Step>
          <Step number={4} title={t("download.step4Title")}>
            {t("download.step4Desc")}
          </Step>
          <Step number={5} title={t("download.step5Title")}>
            {t("download.step5Desc")}
          </Step>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {number}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
