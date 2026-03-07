import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExploreClans } from "@/services/explore.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const querySchema = z.object({
  sort: z
    .enum(["totalR", "winRate", "avgTradesPerWeek", "followers"])
    .default("totalR"),
  tradingFocus: z.string().optional(),
  minWinRate: z.coerce.number().min(0).max(100).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  const limited = await rateLimit(`pub:explore:${getClientIp(req)}`, "PUBLIC_READ");
  if (limited) return limited;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", code: "INVALID_PARAMS" },
      { status: 400 }
    );
  }

  const result = await getExploreClans(parsed.data);

  return NextResponse.json(result);
}
