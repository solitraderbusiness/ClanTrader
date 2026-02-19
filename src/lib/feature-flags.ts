import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

const FLAG_CACHE_PREFIX = "ff:";
const FLAG_CACHE_TTL = 60; // 60 seconds

export async function isFeatureEnabled(key: string): Promise<boolean> {
  // Check Redis cache first
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const cached = await redis.get(`${FLAG_CACHE_PREFIX}${key}`);
    if (cached !== null) {
      return cached === "1";
    }
  } catch {
    // Redis unavailable, fall through to DB
  }

  // Query DB
  const flag = await db.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });

  const enabled = flag?.enabled ?? false;

  // Cache the result
  try {
    await redis.set(`${FLAG_CACHE_PREFIX}${key}`, enabled ? "1" : "0", "EX", FLAG_CACHE_TTL);
  } catch {
    // Redis unavailable
  }

  return enabled;
}

export async function getAllFlags() {
  return db.featureFlag.findMany({
    orderBy: { key: "asc" },
  });
}

export async function invalidateFlag(key: string) {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    await redis.del(`${FLAG_CACHE_PREFIX}${key}`);
  } catch {
    // Redis unavailable
  }
}
