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
}

export interface DigestContext {
  tasks: Task[];
  now: Date;
  todayStart: Date;
  yesterdayStart: Date;
  tomorrowStart: Date;
}

export interface StreakData {
  current: number;
  longest: number;
  lastDate: string; // YYYY-MM-DD
  history: number[]; // last 7 days, most recent last
}

export type DigestSection = (ctx: DigestContext) => string | null;
