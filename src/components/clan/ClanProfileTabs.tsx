"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClanProfileTabsProps {
  channelContent: React.ReactNode;
  membersContent: React.ReactNode;
  chatContent?: React.ReactNode;
  statementsContent?: React.ReactNode;
}

export function ClanProfileTabs({
  channelContent,
  membersContent,
  chatContent,
  statementsContent,
}: ClanProfileTabsProps) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");

  // Default to requested tab if valid, otherwise "channel"
  let defaultTab = "channel";
  if (requestedTab === "chat" && chatContent) defaultTab = "chat";
  else if (requestedTab === "channel") defaultTab = "channel";
  else if (requestedTab === "members") defaultTab = "members";
  else if (requestedTab === "statements" && statementsContent)
    defaultTab = "statements";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="channel">Channel</TabsTrigger>
        {chatContent && <TabsTrigger value="chat">Chat</TabsTrigger>}
        <TabsTrigger value="members">Members</TabsTrigger>
        {statementsContent && (
          <TabsTrigger value="statements">Statements</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="channel">{channelContent}</TabsContent>
      {chatContent && (
        <TabsContent value="chat">{chatContent}</TabsContent>
      )}
      <TabsContent value="members">{membersContent}</TabsContent>
      {statementsContent && (
        <TabsContent value="statements">{statementsContent}</TabsContent>
      )}
    </Tabs>
  );
}
