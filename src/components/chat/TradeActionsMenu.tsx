"use client";

import { useState } from "react";
import { MoreVertical, ArrowDownUp, Target, XCircle, StickyNote, RefreshCw, Shield, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { TRADE_ACTIONS, canPerformAction, canPerformMtAction, type TradeActionKey } from "@/lib/trade-action-constants";
import { TradeActionDialog } from "./TradeActionDialog";
import { useTranslation } from "@/lib/i18n";

interface TradeActionsMenuProps {
  tradeId: string;
  clanId: string;
  currentUserId: string;
  userRole?: string;
  memberRole: string;
  isAuthor: boolean;
  mtLinked?: boolean;
  pendingActionType?: string | null;
}

const ACTION_ITEMS: {
  key: TradeActionKey;
  icon: typeof MoreVertical;
  requiresInput: boolean;
}[] = [
  { key: "SET_BE", icon: Shield, requiresInput: false },
  { key: "MOVE_SL", icon: ArrowDownUp, requiresInput: true },
  { key: "CHANGE_TP", icon: Target, requiresInput: true },
  { key: "CLOSE", icon: XCircle, requiresInput: true },
  { key: "ADD_NOTE", icon: StickyNote, requiresInput: true },
  { key: "STATUS_CHANGE", icon: RefreshCw, requiresInput: true },
];

export function TradeActionsMenu({
  tradeId,
  clanId,
  userRole,
  memberRole,
  isAuthor,
  mtLinked,
  pendingActionType,
}: TradeActionsMenuProps) {
  const { t } = useTranslation();
  const [dialogAction, setDialogAction] = useState<TradeActionKey | null>(null);

  function handleAction(actionType: TradeActionKey, requiresInput: boolean) {
    if (requiresInput) {
      setDialogAction(actionType);
    } else {
      emitAction(actionType);
    }
  }

  function emitAction(actionType: TradeActionKey, newValue?: string, note?: string) {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.EXECUTE_TRADE_ACTION, {
      tradeId,
      clanId,
      actionType,
      newValue,
      note,
    });
  }

  const availableActions = ACTION_ITEMS.filter((item) => {
    // Base permission check
    if (!canPerformAction(userRole, memberRole, item.key, isAuthor)) return false;
    // MT-linked permission check
    if (mtLinked && !canPerformMtAction(item.key, isAuthor)) return false;
    return true;
  });

  if (availableActions.length === 0) return null;

  // If there's a pending action, show spinner instead of menu
  if (pendingActionType) {
    return (
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled>
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableActions.map((item, i) => (
            <span key={item.key}>
              {i === 4 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => handleAction(item.key, item.requiresInput)}>
                <item.icon className="me-2 h-3 w-3" />
                {t(TRADE_ACTIONS[item.key].labelKey)}
              </DropdownMenuItem>
            </span>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogAction && (
        <TradeActionDialog
          open={!!dialogAction}
          onOpenChange={(open) => !open && setDialogAction(null)}
          actionType={dialogAction}
          onConfirm={(newValue, note) => emitAction(dialogAction, newValue, note)}
          mtLinked={mtLinked}
        />
      )}
    </>
  );
}
