import type { LeaderboardLens, RankingWeights } from "@/types/ranking";

export const DEFAULT_LENSES: LeaderboardLens[] = [
  "composite",
  "profit",
  "low_risk",
  "consistency",
  "risk_adjusted",
  "activity",
];

export const DEFAULT_WEIGHTS: RankingWeights = {
  profit: 0.3,
  low_risk: 0.15,
  consistency: 0.25,
  risk_adjusted: 0.2,
  activity: 0.1,
};

export const LENS_LABELS: Record<LeaderboardLens, string> = {
  composite: "Overall",
  profit: "Profit",
  low_risk: "Low Risk",
  consistency: "Consistency",
  risk_adjusted: "Risk-Adjusted",
  activity: "Activity",
};

export const MIN_TRADES_DEFAULT = 10;
