import type { InstrumentStats } from "./journal";

export interface ClanPerformanceData {
  summary: ClanPerfSummary;
  topProviders: ProviderStats[];
  recentSignals: RecentSignal[];
  instrumentBreakdown: InstrumentStats[];
}

export interface ClanPerfSummary {
  totalSignals: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  totalR: number;
  bestR: number;
  worstR: number;
}

export interface ProviderStats {
  userId: string;
  name: string;
  avatar: string | null;
  signals: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
}

export interface RecentSignal {
  tradeId: string;
  instrument: string;
  direction: string;
  r: number | null;
  status: string;
  closedAt: string;
  providerName: string;
  providerAvatar: string | null;
  providerId: string;
}
