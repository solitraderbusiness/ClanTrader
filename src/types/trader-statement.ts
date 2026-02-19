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
  instrumentDistribution: Record<string, number>;
  directionDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
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
    instrumentDistribution: {},
    directionDistribution: {},
    tagDistribution: {},
  };
}
