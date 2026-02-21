import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getClan, getMemberLimit } from "@/services/clan.service";
import { isFollowing } from "@/services/follow.service";
import { getChannelPosts } from "@/services/channel.service";
import { getTopics } from "@/services/topic.service";
import { getUserJoinRequestStatus } from "@/services/join-request.service";
import { db } from "@/lib/db";
import { ClanProfileHeader } from "@/components/clan/ClanProfileHeader";
import { ClanProfileTabs } from "@/components/clan/ClanProfileTabs";
import { JoinClanButton } from "@/components/clan/JoinClanButton";
import { FollowButton } from "@/components/clan/FollowButton";
import { ChannelFeed } from "@/components/channel/ChannelFeed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { TraderBadge } from "@/components/shared/TraderBadge";
import { Settings, Mail } from "lucide-react";
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

  const [following, members, membership, channelData, topics] = await Promise.all([
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
            role: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    db.clanMember.findUnique({
      where: { userId_clanId: { userId: session.user.id, clanId } },
    }),
    getChannelPosts(clanId, {
      page: 1,
      userId: session.user.id,
      isPro: session.user.isPro ?? false,
    }),
    getTopics(clanId),
  ]);

  const isMember = !!membership;
  const isLeader = membership?.role === "LEADER";
  const isLeaderOrCoLeader =
    membership?.role === "LEADER" || membership?.role === "CO_LEADER";
  const memberLimit = getMemberLimit(clan.tier as ClanTier);
  const isFull = clan._count.members >= memberLimit;

  // Join request & one-clan data for non-members
  const [joinRequestStatus, existingClanMembership] = await Promise.all([
    !isMember
      ? getUserJoinRequestStatus(clanId, session.user.id)
      : Promise.resolve(null),
    !isMember
      ? db.clanMember.findFirst({ where: { userId: session.user.id } })
      : Promise.resolve(null),
  ]);

  const clanSettings = (clan.settings as Record<string, unknown>) || {};
  const joinRequestsEnabled = !!clanSettings.joinRequestsEnabled;
  const isInAnotherClan = !!existingClanMembership;

  // Serialize for client components
  const serializedPosts = channelData.posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    images: p.images,
    isPremium: p.isPremium,
    locked: p.locked,
    viewCount: p.viewCount,
    reactions: (p.reactions as Record<string, string[]>) || null,
    createdAt:
      p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    author: p.author,
  }));

  const serializedTopics = topics.map((t) => ({
    id: t.id,
    clanId: t.clanId,
    name: t.name,
    description: t.description,
    isDefault: t.isDefault,
    status: t.status,
    sortOrder: t.sortOrder,
  }));

  const membersContent = (
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
                <TraderBadge role={member.user.role} />
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
            {member.user.id !== session.user.id && (
              <Link
                href={`/dm/${member.user.id}`}
                className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Message"
              >
                <Mail className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const chatContent = isMember ? (
    <ChatPanel
      clanId={clanId}
      currentUserId={session.user.id}
      memberRole={membership!.role}
      initialTopics={serializedTopics}
    />
  ) : null;

  const channelContent = (
    <ChannelFeed
      clanId={clanId}
      initialPosts={serializedPosts}
      initialPagination={channelData.pagination}
      currentUserId={session.user.id}
    />
  );

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
          joinRequestsEnabled={joinRequestsEnabled}
          existingRequestStatus={joinRequestStatus}
          isInAnotherClan={isInAnotherClan}
        />
        {isLeaderOrCoLeader && (
          <Button variant="outline" size="icon" asChild>
            <Link href={`/clans/${clanId}/manage`}>
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </ClanProfileHeader>

      <ClanProfileTabs
        channelContent={channelContent}
        membersContent={membersContent}
        chatContent={chatContent}
      />
    </div>
  );
}
