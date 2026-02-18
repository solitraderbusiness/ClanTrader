export interface StatementMetrics {
  totalNetProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  tradingPeriodStart: string;
  tradingPeriodEnd: string;
  pairsTraded: string[];
  sharpeRatio: number | null;
}
