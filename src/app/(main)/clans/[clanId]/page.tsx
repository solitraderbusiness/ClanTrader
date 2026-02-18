import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getClan } from "@/services/clan.service";
import { isFollowing } from "@/services/follow.service";
import { getMemberLimit } from "@/services/clan.service";
import { db } from "@/lib/db";
import { ClanProfileHeader } from "@/components/clan/ClanProfileHeader";
import { JoinClanButton } from "@/components/clan/JoinClanButton";
import { FollowButton } from "@/components/clan/FollowButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Settings } from "lucide-react";
import type { ClanTier } from "@prisma/client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clanId: string }>;
}) {
  const { clanId } = await params;
  try {
    const clan = await getClan(clanId);
    return { title: clan.name };
  } catch {
    return { title: "Clan" };
  }
}

export default async function ClanPage({
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

  const [following, members, membership] = await Promise.all([
    isFollowing(session.user.id, clanId),
    db.clanMember.findMany({
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
    }),
    db.clanMember.findUnique({
      where: { userId_clanId: { userId: session.user.id, clanId } },
    }),
  ]);

  const isMember = !!membership;
  const isLeader = membership?.role === "LEADER";
  const isLeaderOrCoLeader =
    membership?.role === "LEADER" || membership?.role === "CO_LEADER";
  const memberLimit = getMemberLimit(clan.tier as ClanTier);
  const isFull = clan._count.members >= memberLimit;

  return (
    <div className="space-y-6">
      <ClanProfileHeader
        clan={clan}
        memberCount={clan._count.members}
        followerCount={clan.followerCount}
      >
        <FollowButton clanId={clanId} initialFollowing={following} />
        <JoinClanButton
          clanId={clanId}
          isMember={isMember}
          isLeader={isLeader}
          isFull={isFull}
          isPublic={clan.isPublic}
          currentUserId={session.user.id}
        />
        {isLeaderOrCoLeader && (
          <Button variant="outline" size="icon" asChild>
            <Link href={`/clans/${clanId}/manage`}>
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </ClanProfileHeader>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Members ({clan._count.members}/{memberLimit})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={member.user.avatar || undefined}
                  alt={member.user.name || ""}
                />
                <AvatarFallback>
                  {(member.user.name || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {member.user.name || "Unknown"}
                  </span>
                  <Badge
                    variant={
                      member.role === "LEADER"
                        ? "default"
                        : member.role === "CO_LEADER"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {member.role}
                  </Badge>
                </div>
                {member.user.tradingStyle && (
                  <p className="text-xs text-muted-foreground">
                    {member.user.tradingStyle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
