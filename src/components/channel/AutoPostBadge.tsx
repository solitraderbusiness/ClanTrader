"use client";

import { MessageSquareShare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AutoPostBadge() {
  return (
    <Badge variant="secondary" className="gap-1 text-[10px]">
      <MessageSquareShare className="h-3 w-3" />
      From clan chat
    </Badge>
  );
}
