import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserConversations } from "@/services/dm.service";
import { DmConversationList } from "@/components/dm/DmConversationList";

export const metadata = { title: "Direct Messages" };

export default async function DmPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const conversations = await getUserConversations(session.user.id);

  return (
    <div className="h-full">
      <DmConversationList conversations={conversations} />
    </div>
  );
}
