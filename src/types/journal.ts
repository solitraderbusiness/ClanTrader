export interface JournalSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  closed: number;
  unknownR: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  totalR: number;
  bestR: number;
  worstR: number;
}

export interface EquityCurvePoint {
  date: string;
  r: number;
  cumulativeR: number;
  instrument: string;
  tradeIndex: number;
}

export interface CalendarDayData {
  date: string;
  totalR: number;
  tradeCount: number;
}

export interface InstrumentStats {
  instrument: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  totalR: number;
}

export interface DirectionStats {
  direction: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  totalR: number;
}

export interface TagStats {
  tag: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  totalR: number;
}

export interface TimeSlotStats {
  label: string;
  trades: number;
  winRate: number;
  avgR: number;
  totalR: number;
}

export interface StreakInfo {
  currentStreak: number;
  currentStreakType: "win" | "loss" | "none";
  maxWinStreak: number;
  maxLossStreak: number;
}

export interface PeriodComparisonData {
  current: { label: string } & JournalSummary;
  previous: { label: string } & JournalSummary;
}

export interface JournalData {
  summary: JournalSummary;
  equityCurve: EquityCurvePoint[];
  calendarData: CalendarDayData[];
  instrumentBreakdown: InstrumentStats[];
  directionBreakdown: DirectionStats[];
  tagBreakdown: TagStats[];
  dayOfWeekAnalysis: TimeSlotStats[];
  monthAnalysis: TimeSlotStats[];
  streaks: StreakInfo;
  periodComparison: PeriodComparisonData | null;
}
