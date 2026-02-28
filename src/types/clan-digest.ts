export type DigestPeriod = "today" | "week" | "month";

export interface DigestMemberTrade {
  tradeId: string;
  instrument: string;
  direction: string;
  status: string;
  r: number | null;
  cardType: string;
  createdAt: string;
  closedAt: string | null;
}

export interface DigestMemberStats {
  userId: string;
  name: string;
  avatar: string | null;
  signalCount: number;
  analysisCount: number;
  tpHit: number;
  slHit: number;
  be: number;
  openCount: number;
  winRate: number;
  totalR: number;
  avgR: number;
  trades: DigestMemberTrade[];
}

export interface DigestSummary {
  totalCards: number;
  totalSignals: number;
  totalAnalysis: number;
  tpHit: number;
  slHit: number;
  be: number;
  openCount: number;
  winRate: number;
  totalR: number;
  avgR: number;
  activeMemberCount: number;
}

export interface ClanDigestData {
  period: DigestPeriod;
  summary: DigestSummary;
  members: DigestMemberStats[];
}
