"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClanProfileTabsProps {
  channelContent: React.ReactNode;
  membersContent: React.ReactNode;
}

export function ClanProfileTabs({
  channelContent,
  membersContent,
}: ClanProfileTabsProps) {
  return (
    <Tabs defaultValue="channel" className="space-y-4">
      <TabsList>
        <TabsTrigger value="channel">Channel</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
      </TabsList>

      <TabsContent value="channel">{channelContent}</TabsContent>
      <TabsContent value="members">{membersContent}</TabsContent>
    </Tabs>
  );
}
