export interface MtAccountSummary {
  id: string;
  accountNumber: number;
  broker: string;
  serverName: string | null;
  accountType: "DEMO" | "LIVE";
  platform: "MT4" | "MT5";
  balance: number;
  equity: number;
  currency: string;
  leverage: number | null;
  isActive: boolean;
  lastHeartbeat: string | null;
  connectedAt: string;
  tradeCount: number;
}

export interface MtTradeRecord {
  id: string;
  ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  openPrice: number;
  closePrice: number | null;
  openTime: string;
  closeTime: string | null;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number | null;
  commission: number | null;
  swap: number | null;
  isOpen: boolean;
  matchedTradeId: string | null;
}

export interface MtAccountStats {
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  avgDuration: string;
  topInstruments: string[];
  matchedSignals: number;
  currency: string;
}
