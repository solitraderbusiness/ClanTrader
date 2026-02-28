import { cookies } from "next/headers";
import { ClanCreateForm } from "@/components/clan/ClanCreateForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { t } from "@/lib/i18n-core";
import type { Locale } from "@/lib/locale";

export const metadata = { title: "Create Clan" };

export default async function CreateClanPage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "fa";

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, "myClans.createNewClan")}</CardTitle>
          <CardDescription>
            {t(locale, "myClans.createNewClanDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClanCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
