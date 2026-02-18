import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ImpersonatePanel } from "@/components/admin/ImpersonatePanel";

export default async function ImpersonatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
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
    role: u.role,
    isPro: u.isPro,
    avatar: u.avatar,
    clanCount: u._count.clanMemberships,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Impersonate User</h1>
        <p className="text-sm text-muted-foreground">
          Click any user to switch to their account. You are currently signed in
          as <strong>{session.user.name}</strong>.
        </p>
      </div>
      <ImpersonatePanel users={serializedUsers} currentUserId={session.user.id} />
    </div>
  );
}
