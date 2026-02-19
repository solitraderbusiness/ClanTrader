import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUpcomingEvents } from "@/services/event.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const events = await getUpcomingEvents();
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Get events error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
