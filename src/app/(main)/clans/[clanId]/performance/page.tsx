import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getClan } from "@/services/clan.service";
import { ClanPerformanceTab } from "@/components/clan/ClanPerformanceTab";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clanId: string }>;
}) {
  const { clanId } = await params;
  try {
    const clan = await getClan(clanId);
    return { title: `${clan.name} — Performance` };
  } catch {
    return { title: "Clan Performance" };
  }
}

export default async function ClanPerformancePage({
  params,
}: {
  params: Promise<{ clanId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { clanId } = await params;

  try {
    await getClan(clanId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clans/${clanId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Performance</h1>
      </div>
      <ClanPerformanceTab clanId={clanId} />
    </div>
  );
}
