import type { StreakData } from "./types";

const REDIS_KEY = "digest:streak";

const DEFAULT_STREAK: StreakData = {
  current: 0,
  longest: 0,
  lastDate: "",
  history: [],
};

/**
 * Load streak data from Redis. Returns default if unavailable.
 * Accepts any ioredis-compatible client.
 */
export async function loadStreak(
  redisClient: { get(key: string): Promise<string | null> }
): Promise<StreakData> {
  try {
    const raw = await redisClient.get(REDIS_KEY);
    if (!raw) return { ...DEFAULT_STREAK };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { ...DEFAULT_STREAK };
  }
}

/**
 * Save streak data to Redis.
 */
export async function saveStreak(
  redisClient: { set(key: string, value: string): Promise<unknown> },
  data: StreakData
): Promise<void> {
  try {
    await redisClient.set(REDIS_KEY, JSON.stringify(data));
  } catch {
    // Graceful fallback — don't crash digest if Redis is down
  }
}

/**
 * Update streak based on today's completions.
 * Call this from the evening digest after counting completed tasks.
 */
export function updateStreak(
  streak: StreakData,
  todayCompleted: number,
  todayDate: string // YYYY-MM-DD
): StreakData {
  const updated = { ...streak };

  if (todayCompleted > 0) {
    if (streak.lastDate) {
      const last = new Date(streak.lastDate);
      const today = new Date(todayDate);
      const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

      if (diffDays === 1) {
        // Consecutive day
        updated.current = streak.current + 1;
      } else if (diffDays === 0) {
        // Same day update — keep current streak, just update history
        updated.current = Math.max(streak.current, 1);
      } else {
        // Gap — reset streak
        updated.current = 1;
      }
    } else {
      updated.current = 1;
    }
  } else {
    // No completions today — streak will break tomorrow
    // Don't reset yet (evening might be called before work is done)
    updated.current = streak.lastDate === todayDate ? streak.current : 0;
  }

  updated.longest = Math.max(updated.longest, updated.current);
  updated.lastDate = todayDate;

  // Update history (keep last 7 days)
  const history = [...streak.history, todayCompleted];
  updated.history = history.slice(-7);

  return updated;
}
