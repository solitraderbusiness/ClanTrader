import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getClan } from "@/services/clan.service";
import { getPendingRequestCount } from "@/services/join-request.service";
import { db } from "@/lib/db";
import { ClanManagementPanel } from "@/components/clan/ClanManagementPanel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Manage Clan" };

export default async function ManageClanPage({
  params,
}: {
  params: Promise<{ clanId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { clanId } = await params;

  let clan;
  try {
    clan = await getClan(clanId);
  } catch {
    notFound();
  }

  // Check permissions
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId: session.user.id, clanId } },
  });

  if (
    !membership ||
    !["LEADER", "CO_LEADER"].includes(membership.role)
  ) {
    redirect(`/clans/${clanId}`);
  }

  const pendingCount = await getPendingRequestCount(clanId);

  const members = await db.clanMember.findMany({
    where: { clanId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
          tradingStyle: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  // Serialize dates for client component
  const serializedMembers = members.map((m) => ({
    ...m,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clans/${clanId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Manage {clan.name}</h1>
      </div>

      <ClanManagementPanel
        clan={{
          ...clan,
          settings: (clan.settings as Record<string, unknown>) || null,
        }}
        members={serializedMembers}
        currentUserRole={membership.role}
        currentUserId={session.user.id}
        pendingRequestCount={pendingCount}
      />
    </div>
  );
}
