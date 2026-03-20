"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";

interface ClanProfileTabsProps {
  headerContent?: React.ReactNode;
  channelContent: React.ReactNode;
  membersContent: React.ReactNode;
  chatContent?: React.ReactNode;
}

export function ClanProfileTabs({
  headerContent,
  channelContent,
  membersContent,
  chatContent,
}: ClanProfileTabsProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedTab = searchParams.get("tab");

  // Default to channel
  let activeTab = "channel";
  if (requestedTab === "channel") activeTab = "channel";
  else if (requestedTab === "chat" && chatContent) activeTab = "chat";
  else if (requestedTab === "members") activeTab = "members";

  const isChatActive = activeTab === "chat";

  const handleTabChange = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return (
    <>
      {/* Hide header on mobile when chat is active */}
      {headerContent && (
        <div className={isChatActive ? "hidden lg:block" : ""}>
          {headerContent}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="sticky top-0 z-20 w-full bg-background/95 backdrop-blur-sm">
          <TabsTrigger value="channel" data-testid="tab-channel">
            {t("clan.tabChannel")}
          </TabsTrigger>
          {chatContent && (
            <TabsTrigger value="chat" data-testid="tab-chat">
              {t("clan.tabChat")}
            </TabsTrigger>
          )}
          <TabsTrigger value="members" data-testid="tab-members">
            {t("clan.tabMembers")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channel" className="mt-4">{channelContent}</TabsContent>
        {chatContent && (
          <TabsContent value="chat" className="-mx-4 mt-0 lg:mx-0">{chatContent}</TabsContent>
        )}
        <TabsContent value="members" className="mt-4">{membersContent}</TabsContent>
      </Tabs>
    </>
  );
}
