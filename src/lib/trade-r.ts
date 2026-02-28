// ────────────────────────────────────────────
// Shared R-multiple computation
// ────────────────────────────────────────────

export interface TradeRow {
  id: string;
  status: string;
  finalRR: number | null;
  netProfit: number | null;
  closePrice: number | null;
  closedAt: Date | null;
  createdAt: Date;
  initialEntry: number | null;
  initialStopLoss: number | null;
  initialTakeProfit: number | null;
  initialRiskAbs: number | null;
  mtClosePrice: number | null; // from matched MtTrade
  tradeCard: {
    instrument: string;
    direction: string;
    entry: number;
    stopLoss: number;
    targets: number[];
    tags: string[];
  };
}

export function getR(trade: TradeRow): number | null {
  if (trade.finalRR !== null) return trade.finalRR;

  const entry = trade.initialEntry || trade.tradeCard.entry;
  const sl = trade.initialStopLoss || trade.tradeCard.stopLoss;
  const riskAbs = (trade.initialRiskAbs && trade.initialRiskAbs > 0)
    ? trade.initialRiskAbs
    : Math.abs(entry - sl);
  if (riskAbs === 0) return null;

  // Use closePrice from Trade or from matched MtTrade
  const closePrice = trade.closePrice ?? trade.mtClosePrice ?? null;

  // If we have a closePrice, compute actual R regardless of status
  if (closePrice != null) {
    const dir = trade.tradeCard.direction === "LONG" ? 1 : -1;
    return Math.round((dir * (closePrice - entry)) / riskAbs * 100) / 100;
  }

  switch (trade.status) {
    case "TP_HIT": {
      const tp =
        (trade.initialTakeProfit || trade.tradeCard.targets[0]) ?? entry;
      return Math.round(Math.abs(tp - entry) / riskAbs * 100) / 100;
    }
    case "SL_HIT":
      return -1;
    case "BE":
      return 0;
    case "CLOSED":
      // Without close price, we can't know actual R — mark unknown
      return null;
    default:
      return null;
  }
}
