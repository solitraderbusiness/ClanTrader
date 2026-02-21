import { describe, it, expect } from "vitest";
import { isGap, getInstrumentType, marketShouldBeOpen } from "../gap-detection";
import type { CandleData } from "@/types/trade-integrity";

function makeCandle(timestamp: Date): CandleData {
  return { timestamp, open: 100, high: 101, low: 99, close: 100.5 };
}

describe("getInstrumentType", () => {
  it("detects CRYPTO instruments", () => {
    expect(getInstrumentType("BTCUSD")).toBe("CRYPTO");
    expect(getInstrumentType("ETHUSD")).toBe("CRYPTO");
  });

  it("detects CFD instruments", () => {
    expect(getInstrumentType("US30")).toBe("CFD");
    expect(getInstrumentType("NAS100")).toBe("CFD");
    expect(getInstrumentType("USOIL")).toBe("CFD");
  });

  it("defaults to FOREX for known forex pairs", () => {
    expect(getInstrumentType("EURUSD")).toBe("FOREX");
    expect(getInstrumentType("XAUUSD")).toBe("FOREX");
    expect(getInstrumentType("GBPUSD")).toBe("FOREX");
  });

  it("defaults to FOREX for unknown instruments", () => {
    expect(getInstrumentType("UNKNOWN")).toBe("FOREX");
  });
});

describe("marketShouldBeOpen", () => {
  it("CRYPTO is always open", () => {
    // Saturday at noon
    const saturday = new Date("2026-02-21T12:00:00Z"); // This is a Saturday
    expect(marketShouldBeOpen("CRYPTO", saturday)).toBe(true);
  });

  it("FOREX is closed during weekend", () => {
    // Saturday
    const saturday = new Date("2026-02-21T12:00:00Z");
    expect(marketShouldBeOpen("FOREX", saturday)).toBe(false);
  });

  it("FOREX is open on weekdays", () => {
    // Wednesday at noon
    const wednesday = new Date("2026-02-18T12:00:00Z");
    expect(marketShouldBeOpen("FOREX", wednesday)).toBe(true);
  });
});

describe("isGap", () => {
  it("60s gap is not a gap", () => {
    const prev = makeCandle(new Date("2026-02-18T12:00:00Z"));
    const curr = makeCandle(new Date("2026-02-18T12:01:00Z"));
    expect(isGap(prev, curr, "CRYPTO")).toBe(false);
    expect(isGap(prev, curr, "FOREX")).toBe(false);
  });

  it("91s gap crypto → real gap", () => {
    const prev = makeCandle(new Date("2026-02-18T12:00:00Z"));
    const curr = makeCandle(new Date("2026-02-18T12:01:31Z"));
    expect(isGap(prev, curr, "CRYPTO")).toBe(true);
  });

  it("91s gap forex during weekend → not a gap", () => {
    // Friday 21:30 to Saturday 00:00
    const prev = makeCandle(new Date("2026-02-20T21:30:00Z")); // Friday
    const curr = makeCandle(new Date("2026-02-21T00:00:00Z")); // Saturday
    expect(isGap(prev, curr, "FOREX")).toBe(false);
  });

  it("91s gap forex during weekday → real gap", () => {
    const prev = makeCandle(new Date("2026-02-18T12:00:00Z")); // Wednesday
    const curr = makeCandle(new Date("2026-02-18T12:01:31Z")); // Wednesday
    expect(isGap(prev, curr, "FOREX")).toBe(true);
  });
});
