import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserConversations } from "@/services/dm.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await getUserConversations(session.user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Get DM conversations error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
