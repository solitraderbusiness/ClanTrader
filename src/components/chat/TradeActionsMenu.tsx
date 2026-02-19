"use client";

import { useState } from "react";
import { MoreVertical, ArrowDownUp, Target, XCircle, StickyNote, RefreshCw, Shield } from "lucide-react";
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
import { canPerformAction, type TradeActionKey } from "@/lib/trade-action-constants";
import { TradeActionDialog } from "./TradeActionDialog";

interface TradeActionsMenuProps {
  tradeId: string;
  clanId: string;
  currentUserId: string;
  userRole?: string;
  memberRole: string;
  isAuthor: boolean;
}

const ACTION_ITEMS: {
  key: TradeActionKey;
  icon: typeof MoreVertical;
  label: string;
  requiresInput: boolean;
}[] = [
  { key: "SET_BE", icon: Shield, label: "Set Break Even", requiresInput: false },
  { key: "MOVE_SL", icon: ArrowDownUp, label: "Move Stop Loss", requiresInput: true },
  { key: "CHANGE_TP", icon: Target, label: "Change Targets", requiresInput: true },
  { key: "CLOSE", icon: XCircle, label: "Close Trade", requiresInput: true },
  { key: "ADD_NOTE", icon: StickyNote, label: "Add Note", requiresInput: true },
  { key: "STATUS_CHANGE", icon: RefreshCw, label: "Change Status", requiresInput: true },
];

export function TradeActionsMenu({
  tradeId,
  clanId,
  userRole,
  memberRole,
  isAuthor,
}: TradeActionsMenuProps) {
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

  const availableActions = ACTION_ITEMS.filter((item) =>
    canPerformAction(userRole, memberRole, item.key, isAuthor)
  );

  if (availableActions.length === 0) return null;

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
                {item.label}
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
        />
      )}
    </>
  );
}
