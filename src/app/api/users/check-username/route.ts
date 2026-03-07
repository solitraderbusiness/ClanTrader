import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usernameSchema } from "@/lib/validators";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const limited = await rateLimit(`pub:check-username:${getClientIp(request)}`, "PUBLIC_READ");
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ available: false, error: "Username is required" });
    }

    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      return NextResponse.json({
        available: false,
        error: parsed.error.issues[0].message,
      });
    }

    const existing = await db.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return NextResponse.json({ available: !existing });
  } catch (error) {
    console.error("Check username error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
