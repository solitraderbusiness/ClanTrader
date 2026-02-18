"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClanSettingsForm } from "./ClanSettingsForm";
import { MemberList } from "./MemberList";
import { InviteManager } from "./InviteManager";

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
  };
  members: Member[];
  currentUserRole: string;
  currentUserId: string;
}

export function ClanManagementPanel({
  clan,
  members,
  currentUserRole,
  currentUserId,
}: ClanManagementPanelProps) {
  return (
    <Tabs defaultValue="settings" className="space-y-4">
      <TabsList>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="invites">Invites</TabsTrigger>
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

      <TabsContent value="invites">
        <InviteManager clanId={clan.id} />
      </TabsContent>
    </Tabs>
  );
}
