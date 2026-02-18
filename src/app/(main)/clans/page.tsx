import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserClans } from "@/services/clan.service";
import { ClanCard } from "@/components/clan/ClanCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

export const metadata = { title: "My Clans" };

export default async function ClansPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const clans = await getUserClans(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Clans</h1>
        <Button asChild>
          <Link href="/clans/create">
            <Plus className="me-2 h-4 w-4" />
            Create Clan
          </Link>
        </Button>
      </div>

      {clans.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12">
          <Users className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-lg font-semibold">No clans yet</h2>
            <p className="text-sm text-muted-foreground">
              Create your own clan or join one from the discover page.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/clans/create">Create Clan</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/discover">Discover Clans</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {clans.map((clan) => (
            <ClanCard
              key={clan.id}
              clan={clan}
              role={clan.role}
            />
          ))}
        </div>
      )}
    </div>
  );
}
