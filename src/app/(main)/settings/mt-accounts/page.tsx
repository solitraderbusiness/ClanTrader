import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserMtAccounts } from "@/services/ea.service";
import { MtAccountManager } from "@/components/settings/MtAccountManager";
import Link from "next/link";
import { t } from "@/lib/i18n-core";
import type { Locale } from "@/lib/locale";

export default async function MtAccountsSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "fa";
  const accounts = await getUserMtAccounts(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t(locale, "mtSettings.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(locale, "mtSettings.subtitle")}
        </p>
      </div>

      <MtAccountManager accounts={accounts} />

      {accounts.length === 0 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-medium">{t(locale, "mtSettings.whatEaDoes")}</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{t(locale, "mtSettings.eaDoes1")}</li>
              <li>{t(locale, "mtSettings.eaDoes2")}</li>
              <li>{t(locale, "mtSettings.eaDoes3")}</li>
            </ul>
            <h3 className="mt-3 text-sm font-medium">{t(locale, "mtSettings.whatEaDoesNot")}</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{t(locale, "mtSettings.eaDoesNot1")}</li>
              <li>{t(locale, "mtSettings.eaDoesNot2")}</li>
              <li>{t(locale, "mtSettings.eaDoesNot3")}</li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">{t(locale, "mtSettings.eaVsStatement")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-green-500/5 border border-green-500/20 p-3">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{t(locale, "mtSettings.eaLabel")}</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  <li>{t(locale, "mtSettings.eaPro1")}</li>
                  <li>{t(locale, "mtSettings.eaPro2")}</li>
                  <li>{t(locale, "mtSettings.eaPro3")}</li>
                </ul>
              </div>
              <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{t(locale, "mtSettings.statementLabel")}</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  <li>{t(locale, "mtSettings.statementPro1")}</li>
                  <li>{t(locale, "mtSettings.statementPro2")}</li>
                  <li>{t(locale, "mtSettings.statementPro3")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="text-sm font-medium">{t(locale, "mtSettings.connectNew")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(locale, "mtSettings.connectNewDesc")}
        </p>
        <Link
          href="/download"
          className="mt-2 inline-block text-sm text-primary underline"
        >
          {t(locale, "mtSettings.downloadEa")}
        </Link>
      </div>
    </div>
  );
}
