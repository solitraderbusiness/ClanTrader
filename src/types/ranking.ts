export type LeaderboardLens =
  | "profit"
  | "low_risk"
  | "consistency"
  | "risk_adjusted"
  | "activity"
  | "composite";

export interface RankingWeights {
  profit: number;
  low_risk: number;
  consistency: number;
  risk_adjusted: number;
  activity: number;
}
