export const TRADE_ACTIONS = {
  SET_BE: {
    labelKey: "trade.setBe",
    descriptionKey: "trade.setBeDesc",
    requiresInput: false,
  },
  MOVE_SL: {
    labelKey: "trade.moveSl",
    descriptionKey: "trade.moveSlDesc",
    requiresInput: true,
    inputLabelKey: "trade.newSl",
    inputType: "number" as const,
  },
  CHANGE_TP: {
    labelKey: "trade.changeTp",
    descriptionKey: "trade.changeTpDesc",
    requiresInput: true,
    inputLabelKey: "trade.newTargets",
    inputType: "text" as const,
  },
  CLOSE: {
    labelKey: "trade.closeTrade",
    descriptionKey: "trade.closeTradeDesc",
    requiresInput: true,
    inputLabelKey: "trade.closePrice",
    inputType: "number" as const,
    inputOptional: true,
  },
  ADD_NOTE: {
    labelKey: "trade.addNote",
    descriptionKey: "trade.addNoteDesc",
    requiresInput: true,
    inputLabelKey: "trade.noteLabel",
    inputType: "text" as const,
  },
  STATUS_CHANGE: {
    labelKey: "trade.changeStatus",
    descriptionKey: "trade.changeStatusDesc",
    requiresInput: true,
    inputLabelKey: "trade.newStatus",
    inputType: "select" as const,
    options: ["TP_HIT", "SL_HIT", "BE", "CLOSED"],
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

/**
 * For MT-linked trades, only the owner can perform execution actions.
 * ADD_NOTE is open to anyone with base permissions.
 * STATUS_CHANGE is hidden for MT-linked trades.
 */
export function canPerformMtAction(
  actionType: TradeActionKey,
  isAuthor: boolean
): boolean {
  if (actionType === "ADD_NOTE") return true;
  if (actionType === "STATUS_CHANGE") return false;
  return isAuthor; // Owner-only for MT execution
}
