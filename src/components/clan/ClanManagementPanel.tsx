"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClanSettingsForm } from "./ClanSettingsForm";
import { MemberList } from "./MemberList";
import { InviteManager } from "./InviteManager";
import { JoinRequestManager } from "./JoinRequestManager";
import { ChannelPostManager } from "@/components/channel/ChannelPostManager";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
    tradingStyle: string | null;
  };
}

interface ClanManagementPanelProps {
  clan: {
    id: string;
    name: string;
    description: string | null;
    avatar: string | null;
    tradingFocus: string | null;
    isPublic: boolean;
    settings: Record<string, unknown> | null;
  };
  members: Member[];
  currentUserRole: string;
  currentUserId: string;
  pendingRequestCount: number;
}

export function ClanManagementPanel({
  clan,
  members,
  currentUserRole,
  currentUserId,
  pendingRequestCount,
}: ClanManagementPanelProps) {
  return (
    <Tabs defaultValue="settings" className="space-y-4">
      <TabsList>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="requests" className="gap-1.5">
          Requests
          {pendingRequestCount > 0 && (
            <Badge
              variant="destructive"
              className="h-5 min-w-5 px-1 text-[10px] leading-none"
            >
              {pendingRequestCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="invites">Invites</TabsTrigger>
        <TabsTrigger value="channel">Channel</TabsTrigger>
      </TabsList>

      <TabsContent value="settings">
        <ClanSettingsForm clan={clan} />
      </TabsContent>

      <TabsContent value="members">
        <MemberList
          clanId={clan.id}
          members={members}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
        />
      </TabsContent>

      <TabsContent value="requests">
        <JoinRequestManager clanId={clan.id} />
      </TabsContent>

      <TabsContent value="invites">
        <InviteManager clanId={clan.id} />
      </TabsContent>

      <TabsContent value="channel">
        <ChannelPostManager clanId={clan.id} />
      </TabsContent>
    </Tabs>
  );
}
