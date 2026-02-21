import type { BadgeCategory } from "@prisma/client";

// --- Badge Requirements (stored in requirementsJson) ---

export interface RankBadgeRequirements {
  type: "rank";
  min_closed_trades: number;
}

export interface PerformanceBadgeRequirements {
  type: "performance";
  metric: "net_r" | "avg_r" | "max_drawdown_r" | "win_rate";
  window: number;
  op: ">=" | "<=" | ">" | "<";
  value: number;
}

export interface TrophyBadgeRequirements {
  type: "trophy";
  season_id: string; // "*" = most recent ACTIVE/COMPLETED
  lens: string;
  rank_min: number;
  rank_max: number;
}

export interface ManualBadgeRequirements {
  type: "manual";
}

export type BadgeRequirements =
  | RankBadgeRequirements
  | PerformanceBadgeRequirements
  | TrophyBadgeRequirements
  | ManualBadgeRequirements;

// --- Rank Ladder ---

export const RANK_LADDER = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "A",
  "S",
  "SS",
  "SSS",
  "Divine",
] as const;

export type RankName = (typeof RANK_LADDER)[number];

// --- Badge Definition (API response shape) ---

export interface BadgeDefinitionDTO {
  id: string;
  key: string;
  category: BadgeCategory;
  name: string;
  description: string | null;
  iconUrl: string | null;
  iconAssetKey: string | null;
  requirementsJson: BadgeRequirements;
  enabled: boolean;
  displayOrder: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { userBadges: number };
}

// --- User Badge (API response shape) ---

export interface UserBadgeDTO {
  id: string;
  userId: string;
  badgeDefinitionId: string;
  awardedAt: string;
  metadataJson: Record<string, unknown> | null;
  isActive: boolean;
  revokedAt: string | null;
  evaluatedAt: string;
  badgeDefinition: {
    id: string;
    key: string;
    category: BadgeCategory;
    name: string;
    description: string | null;
    iconUrl: string | null;
    requirementsJson: BadgeRequirements;
    displayOrder: number;
  };
}

// --- Evaluation Results ---

export interface UserBadgeResult {
  userId: string;
  rankBadge: string | null;
  performanceBadges: string[];
  trophyBadges: string[];
  totalActive: number;
}

export interface DryRunEntry {
  userId: string;
  userName: string | null;
  currentValue: number | null;
}

export interface DryRunResult {
  wouldGain: DryRunEntry[];
  wouldLose: DryRunEntry[];
  unchanged: number;
}

export interface RecomputeProgress {
  jobId: string;
  total: number;
  processed: number;
  errors: number;
  status: "running" | "completed" | "failed";
}
