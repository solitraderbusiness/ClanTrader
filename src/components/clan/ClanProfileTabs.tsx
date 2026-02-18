"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClanProfileTabsProps {
  channelContent: React.ReactNode;
  membersContent: React.ReactNode;
  chatContent?: React.ReactNode;
}

export function ClanProfileTabs({
  channelContent,
  membersContent,
  chatContent,
}: ClanProfileTabsProps) {
  return (
    <Tabs defaultValue="channel" className="space-y-4">
      <TabsList>
        <TabsTrigger value="channel">Channel</TabsTrigger>
        {chatContent && <TabsTrigger value="chat">Chat</TabsTrigger>}
        <TabsTrigger value="members">Members</TabsTrigger>
      </TabsList>

      <TabsContent value="channel">{channelContent}</TabsContent>
      {chatContent && (
        <TabsContent value="chat">{chatContent}</TabsContent>
      )}
      <TabsContent value="members">{membersContent}</TabsContent>
    </Tabs>
  );
}
