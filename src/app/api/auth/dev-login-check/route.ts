import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIp(request);

  const match = await db.devLoginIp.findUnique({ where: { ip } });

  return NextResponse.json({ allowed: !!match, ip });
}
