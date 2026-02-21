import type { CandleData, CandleProvider } from "@/types/trade-integrity";

/**
 * Stub candle provider — returns empty candles (safe no-op).
 * Replace with a real provider when market data API is available.
 */
class StubCandleProvider implements CandleProvider {
  async fetchOneMinuteCandles(
    _instrument: string,
    _from: Date,
    _to: Date
  ): Promise<CandleData[]> {
    return [];
  }
}

let provider: CandleProvider = new StubCandleProvider();

export function getCandleProvider(): CandleProvider {
  return provider;
}

export function setCandleProvider(p: CandleProvider): void {
  provider = p;
}
