export interface TraderStatementMetrics {
  signalCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  closed: number;
  open: number;
  winRate: number;
  avgRMultiple: number;
  bestRMultiple: number;
  worstRMultiple: number;
  totalRMultiple: number;
  profitFactor: number;
  instrumentDistribution: Record<string, number>;
  directionDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
}

/** Live open risk overlay — computed on-demand, not stored in statement */
export interface LiveOpenRisk {
  openOfficialCount: number;
  liveFloatingPnl: number;
  liveFloatingR: number;
  /** NAV-based (cash-flow-neutral) — public performance display */
  currentNavDrawdownPct: number;
  maxNavDrawdownPct: number;
  /** Raw equity-based — internal account health */
  currentEquityDrawdownPct: number;
  maxEquityDrawdownPct: number;
  biggestOpenLoserR: number;
  unprotectedCount: number;
  staleWarning: boolean;
  lastUpdate: string | null;
  isEstimated?: boolean;
}

/** Effective rank view — combines closed R with open risk penalty */
export interface EffectiveRankView {
  closedOfficialR: number;
  openRiskPenalty: number;
  effectiveRankR: number;
}

/** Full 3-block statement page response */
export interface StatementPageData {
  closedPerformance: TraderStatementMetrics;
  liveOpenRisk: LiveOpenRisk;
  effectiveRank: EffectiveRankView;
}

export function emptyMetrics(): TraderStatementMetrics {
  return {
    signalCount: 0,
    wins: 0,
    losses: 0,
    breakEven: 0,
    closed: 0,
    open: 0,
    winRate: 0,
    avgRMultiple: 0,
    bestRMultiple: 0,
    worstRMultiple: -Infinity,
    totalRMultiple: 0,
    profitFactor: 0,
    instrumentDistribution: {},
    directionDistribution: {},
    tagDistribution: {},
  };
}
