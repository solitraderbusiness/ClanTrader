// ─── Rich task type for launch-control digest ───

export interface Task {
  id: string;
  title: string;
  phase: string;
  priority: string;
  column: string;
  dueDate: Date | null;
  completedAt: Date | null;
  startedAt: Date | null;
  category: string;
  isLaunchBlocker: boolean;
  result: string | null;
  // PM roadmap fields
  key: string | null;
  pmStatus: string | null;
  milestone: string | null;
  workstream: string | null;
  owner: string | null;
  dependencies: unknown; // Json — string[] of keys
  evidence: unknown; // Json — { files[], envVars[], tests[] }
  notes: string | null;
}

export interface DigestContext {
  tasks: Task[];
  now: Date;
  todayStart: Date;
  yesterdayStart: Date;
  tomorrowStart: Date;
  mode: DigestMode;
  depGraph: DependencyGraph;
}

export type DigestMode = "LAUNCH_GATE" | "STANDARD";

export interface StreakData {
  current: number;
  longest: number;
  lastDate: string; // YYYY-MM-DD
  history: number[]; // last 7 days, most recent last
}

export type DigestSection = (ctx: DigestContext) => string | null;

// ─── Dependency graph for blocker-clearing analysis ───

export interface DependencyGraph {
  /** key → set of keys that depend on it (downstream) */
  downstream: Map<string, Set<string>>;
  /** key → set of keys it depends on (upstream blockers) */
  upstream: Map<string, Set<string>>;
}

// ─── Digest metadata stored alongside content ───

export interface DigestMetadata {
  mode: DigestMode;
  blockerCount: number;
  verificationDebtCount: number;
  staleInProgressCount: number;
  velocity7d: number;
  focusItemIds: string[];
  riskAlerts: string[];
  milestone: string | null;
  streak?: StreakData;
}

// ─── PM Status progression ───

export const PM_STATUS_ORDER = [
  "PLANNED",
  "IMPLEMENTED",
  "INTEGRATED",
  "CONFIGURED",
  "VERIFIED",
  "HARDENED",
  "OPERABLE",
] as const;

export type PmStatus = (typeof PM_STATUS_ORDER)[number];

/** Statuses that indicate "built but not verified" */
export const VERIFICATION_DEBT_STATUSES: readonly string[] = [
  "IMPLEMENTED",
  "INTEGRATED",
  "CONFIGURED",
];

/** Statuses that are fully verified or beyond */
export const VERIFIED_STATUSES: readonly string[] = [
  "VERIFIED",
  "HARDENED",
  "OPERABLE",
];
