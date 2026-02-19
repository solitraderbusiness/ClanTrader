"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const requestedTab = searchParams.get("tab");

  // Derive active tab from URL
  let activeTab = "channel";
  if (requestedTab === "chat" && chatContent) activeTab = "chat";
  else if (requestedTab === "channel") activeTab = "channel";
  else if (requestedTab === "members") activeTab = "members";
  else if (requestedTab === "statements" && statementsContent)
    activeTab = "statements";

  const handleTabChange = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
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
