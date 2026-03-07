export interface SparklinePoint {
  week: string; // ISO week label e.g. "2024-W12"
  cumR: number;
}

export interface ExploreClanPerf {
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  avgTradesPerWeek: number;
  maxDrawdownR: number;
  sparkline: SparklinePoint[];
}

export interface ExploreClanItem {
  id: string;
  name: string;
  avatar: string | null;
  tradingFocus: string | null;
  tier: string;
  followerCount: number;
  memberCount: number;
  perf: ExploreClanPerf;
}
