export const TRADE_ACTIONS = {
  SET_BE: {
    label: "Set Break Even",
    description: "Move stop loss to entry price",
    requiresInput: false,
  },
  MOVE_SL: {
    label: "Move Stop Loss",
    description: "Change the stop loss price",
    requiresInput: true,
    inputLabel: "New Stop Loss",
    inputType: "number" as const,
  },
  CHANGE_TP: {
    label: "Change Targets",
    description: "Update target prices",
    requiresInput: true,
    inputLabel: "New Targets (comma-separated)",
    inputType: "text" as const,
  },
  CLOSE: {
    label: "Close Trade",
    description: "Close the trade manually",
    requiresInput: true,
    inputLabel: "Close Price (optional)",
    inputType: "number" as const,
    inputOptional: true,
  },
  ADD_NOTE: {
    label: "Add Note",
    description: "Add a note to this trade",
    requiresInput: true,
    inputLabel: "Note",
    inputType: "text" as const,
  },
  STATUS_CHANGE: {
    label: "Change Status",
    description: "Update trade status",
    requiresInput: true,
    inputLabel: "New Status",
    inputType: "select" as const,
    options: ["TP1_HIT", "TP2_HIT", "SL_HIT", "BE", "CLOSED"],
  },
} as const;

export type TradeActionKey = keyof typeof TRADE_ACTIONS;

export function canPerformAction(
  userRole: string | undefined,
  memberRole: string,
  actionType: TradeActionKey,
  isAuthor: boolean
): boolean {
  // ADMIN users can do everything
  if (userRole === "ADMIN") return true;

  // Trade author can do everything
  if (isAuthor) return true;

  // LEADER and CO_LEADER can do everything
  if (memberRole === "LEADER" || memberRole === "CO_LEADER") return true;

  // Regular MEMBER can only add notes
  if (actionType === "ADD_NOTE") return true;

  return false;
}
