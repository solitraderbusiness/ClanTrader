// ────────────────────────────────────────────
// Activity Digest v2 — Constants & Thresholds
// ────────────────────────────────────────────

/** Redis cache TTL for digest v2 (seconds) */
export const DIGEST_V2_CACHE_TTL = 90;

/** Feature flag key for digest v2 */
export const DIGEST_V2_FLAG = "digest_v2";

// ─── Open Trade Health Thresholds ───

/** Entry deviation from planned, normalized by risk distance */
export const ENTRY_QUALITY_PRECISE = 0.10;
export const ENTRY_QUALITY_GOOD = 0.25;
export const ENTRY_QUALITY_LATE = 0.50;
// Above LATE → CHASED

/** SL widening threshold: > 10% of original risk distance → BROKEN */
export const SL_WIDENED_BROKEN_THRESHOLD = 0.10;

/** TP change threshold: > 25% of original target distance → DRIFTED */
export const TP_CHANGED_DRIFTED_THRESHOLD = 0.25;

/** Distance to SL as ratio of risk distance — below this → NEAR_INVALIDATION */
export const APPROACHING_SL_THRESHOLD = 0.25;

/** Max items in attention queue */
export const ATTENTION_QUEUE_MAX = 5;

/** Max attention items per member */
export const ATTENTION_PER_MEMBER_MAX = 2;

/** Tracking status thresholds (seconds since last heartbeat) */
export const TRACKING_STALE_SECONDS = 60;
export const TRACKING_LOST_SECONDS = 120;
