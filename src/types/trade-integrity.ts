import type { IntegrityReason } from "@prisma/client";

export interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type InstrumentType = "CRYPTO" | "FOREX" | "CFD";

export type EvalResult =
  | { action: "NOOP" }
  | { action: "ENTER"; timestamp: Date }
  | { action: "RESOLVE_TP"; timestamp: Date }
  | { action: "RESOLVE_SL"; timestamp: Date }
  | {
      action: "MARK_UNVERIFIED";
      reason: IntegrityReason;
      details: Record<string, unknown>;
    };

export interface CandleProvider {
  fetchOneMinuteCandles(
    instrument: string,
    from: Date,
    to: Date
  ): Promise<CandleData[]>;
}
