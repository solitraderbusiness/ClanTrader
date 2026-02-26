import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { JournalDashboard } from "@/components/journal/JournalDashboard";

export const metadata = { title: "Trade Journal" };

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await db.clanMember.findMany({
    where: { userId: session.user.id },
    select: {
      clanId: true,
      clan: { select: { name: true } },
    },
  });

  const clans = memberships.map((m) => ({
    id: m.clanId,
    name: m.clan.name,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <JournalDashboard clans={clans} />
    </div>
  );
}
