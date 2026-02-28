import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ImpersonatePanel } from "@/components/admin/ImpersonatePanel";
import { t } from "@/lib/i18n-core";
import type { Locale } from "@/lib/locale";

export default async function ImpersonatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/home");

  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "fa";

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isPro: true,
      avatar: true,
      _count: { select: { clanMemberships: true } },
    },
    orderBy: { name: "asc" },
  });

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isPro: u.isPro,
    avatar: u.avatar,
    clanCount: u._count.clanMemberships,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t(locale, "impersonate.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(locale, "impersonate.desc", { name: session.user.name || "" })}
        </p>
      </div>
      <ImpersonatePanel users={serializedUsers} currentUserId={session.user.id} />
    </div>
  );
}
