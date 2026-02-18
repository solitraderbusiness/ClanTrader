import { auth } from "@/lib/auth";
import {
  getInviteByCode,
  InviteServiceError,
} from "@/services/invite.service";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { InviteJoinButton } from "./InviteJoinButton";

export const metadata = { title: "Clan Invite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  let invite;
  let error: string | null = null;
  try {
    invite = await getInviteByCode(code);
  } catch (e) {
    if (e instanceof InviteServiceError) {
      error = e.message;
    } else {
      error = "Something went wrong";
    }
  }

  if (error || !invite) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Invite</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error || "This invite link is not valid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user is already a member
  let isMember = false;
  if (session?.user?.id) {
    const membership = await db.clanMember.findUnique({
      where: {
        userId_clanId: { userId: session.user.id, clanId: invite.clanId },
      },
    });
    isMember = !!membership;
  }

  const clan = invite.clan;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader className="text-center">
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={clan.avatar || undefined} alt={clan.name} />
            <AvatarFallback className="text-xl">
              {clan.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h2 className="text-xl font-bold">{clan.name}</h2>
            {clan.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {clan.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {clan._count.members} members
            </span>
            {clan.tradingFocus && (
              <Badge variant="secondary">{clan.tradingFocus}</Badge>
            )}
          </div>

          <InviteJoinButton
            code={code}
            isLoggedIn={!!session?.user?.id}
            isMember={isMember}
          />
        </CardContent>
      </Card>
    </div>
  );
}
