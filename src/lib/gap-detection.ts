import type { CandleData, InstrumentType } from "@/types/trade-integrity";
import { COMMON_INSTRUMENTS } from "@/lib/chat-constants";

// Default weekend window (UTC). Override with env vars.
const DEFAULT_FOREX_WEEKEND_START = "FRI 21:00";
const DEFAULT_FOREX_WEEKEND_END = "MON 00:00";

const CRYPTO_PATTERNS = [
  "BTC", "ETH", "XRP", "SOL", "DOGE", "ADA", "DOT", "AVAX",
  "LINK", "MATIC", "LTC", "SHIB", "BNB",
];

const CFD_PATTERNS = [
  "US30", "NAS100", "SPX500", "USOIL", "UKOIL", "DAX", "FTSE",
  "GER40", "UK100", "JP225",
];

/**
 * Determines the instrument type from the instrument name.
 * Uses COMMON_INSTRUMENTS list + known patterns.
 * Default: FOREX.
 */
export function getInstrumentType(instrument: string): InstrumentType {
  const upper = instrument.toUpperCase();

  // Check crypto patterns
  if (CRYPTO_PATTERNS.some((p) => upper.includes(p))) {
    return "CRYPTO";
  }

  // Check CFD patterns
  if (CFD_PATTERNS.some((p) => upper.includes(p))) {
    return "CFD";
  }

  // Check if it's in the known instruments list
  const known = COMMON_INSTRUMENTS as readonly string[];
  if (known.includes(upper)) {
    // XAUUSD, XAGUSD are metals — trade like forex hours
    return "FOREX";
  }

  // Default to FOREX
  return "FOREX";
}

/**
 * Parses a weekend boundary string like "FRI 21:00" into { dayOfWeek, hour, minute }.
 */
function parseWeekendBoundary(str: string): { dayOfWeek: number; hour: number; minute: number } {
  const dayMap: Record<string, number> = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
  };

  const parts = str.trim().split(/\s+/);
  const day = dayMap[parts[0]?.toUpperCase()] ?? 5;
  const [hour, minute] = (parts[1] ?? "21:00").split(":").map(Number);
  return { dayOfWeek: day, hour: hour ?? 21, minute: minute ?? 0 };
}

/**
 * Returns true if the given timestamp falls inside the forex weekend window.
 */
function isInsideWeekend(timestamp: Date): boolean {
  const startStr = process.env.FOREX_WEEKEND_START_UTC ?? DEFAULT_FOREX_WEEKEND_START;
  const endStr = process.env.FOREX_WEEKEND_END_UTC ?? DEFAULT_FOREX_WEEKEND_END;

  const start = parseWeekendBoundary(startStr);
  const end = parseWeekendBoundary(endStr);

  const day = timestamp.getUTCDay();
  const minuteOfDay = timestamp.getUTCHours() * 60 + timestamp.getUTCMinutes();

  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;

  // Weekend: after Friday 21:00 UTC through Monday 00:00 UTC
  if (day === start.dayOfWeek && minuteOfDay >= startMinute) return true;
  if (day === 6) return true; // Saturday
  if (day === 0) return true; // Sunday
  if (day === end.dayOfWeek && minuteOfDay < endMinute) return true;

  return false;
}

/**
 * Returns true if the market should be open for this instrument type at the given time.
 * - CRYPTO: always open
 * - FOREX/CFD: not during weekend window
 */
export function marketShouldBeOpen(instrumentType: InstrumentType, now: Date): boolean {
  if (instrumentType === "CRYPTO") return true;
  return !isInsideWeekend(now);
}

/**
 * Detects if there is a data gap between two consecutive candles.
 *
 * - If deltaSeconds > 90, check instrument type
 * - CRYPTO: always a gap (24/7 market)
 * - FOREX/CFD: not a gap if the interval falls inside the weekend window
 */
export function isGap(
  prevCandle: CandleData,
  currCandle: CandleData,
  instrumentType: InstrumentType
): boolean {
  const deltaMs = currCandle.timestamp.getTime() - prevCandle.timestamp.getTime();
  const deltaSeconds = deltaMs / 1000;

  // Normal gap: 1-min candles should be ~60s apart
  if (deltaSeconds <= 90) return false;

  // CRYPTO markets are 24/7 — any gap is a real gap
  if (instrumentType === "CRYPTO") return true;

  // FOREX/CFD: check if the gap spans a weekend
  // If the previous candle is before weekend and current is after, it's expected
  if (isInsideWeekend(prevCandle.timestamp) || isInsideWeekend(currCandle.timestamp)) {
    return false;
  }

  // Gap during market hours — real gap
  return true;
}
