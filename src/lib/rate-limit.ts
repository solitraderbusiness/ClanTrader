import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in seconds */
  windowSec: number;
}

/**
 * Pre-defined rate limit tiers.
 *
 * AUTH_STRICT  — login, signup, forgot-password, reset-password (5 req / 60s per IP)
 * AUTH_OTP     — OTP send/verify (3 req / 300s per IP — already enforced per-route, this is a safety net)
 * EA           — EA API routes keyed by API key (60 req / 60s)
 * PUBLIC_READ  — unauthenticated read routes like explore, leaderboard (60 req / 60s per IP)
 * AUTHENTICATED — general authenticated routes (120 req / 60s per user)
 * UPLOAD       — file uploads (10 req / 60s per user)
 */
export const RATE_LIMITS = {
  AUTH_STRICT:   { max: 5,   windowSec: 60 },
  AUTH_OTP:      { max: 3,   windowSec: 300 },
  EA:            { max: 60,  windowSec: 60 },
  PUBLIC_READ:   { max: 60,  windowSec: 60 },
  AUTHENTICATED: { max: 120, windowSec: 60 },
  UPLOAD:        { max: 10,  windowSec: 60 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitTier = keyof typeof RATE_LIMITS;

/**
 * Check rate limit using Redis sliding window counter.
 * Returns null if allowed, or a 429 NextResponse if blocked.
 *
 * @param key  - Unique identifier (e.g. IP, userId, apiKey)
 * @param tier - One of the pre-defined tiers, or a custom config
 */
export async function rateLimit(
  key: string,
  tier: RateLimitTier | RateLimitConfig
): Promise<NextResponse | null> {
  const config = typeof tier === "string" ? RATE_LIMITS[tier] : tier;
  const redisKey = `rl:${key}`;

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, config.windowSec);
    }

    if (count > config.max) {
      const ttl = await redis.ttl(redisKey);
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "Retry-After": String(ttl > 0 ? ttl : config.windowSec),
            "X-RateLimit-Limit": String(config.max),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    return null; // Allowed
  } catch {
    // If Redis is down, allow the request (fail-open)
    return null;
  }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
