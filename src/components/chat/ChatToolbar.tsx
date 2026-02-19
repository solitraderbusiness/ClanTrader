"use client";

import { BarChart3, Eye, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PanelType = "trades" | "watchlist" | "events" | "summary";

interface ChatToolbarProps {
  openPanel: PanelType | null;
  onTogglePanel: (panel: PanelType) => void;
}

const tools: Array<{ panel: PanelType; icon: typeof BarChart3; label: string }> = [
  { panel: "trades", icon: BarChart3, label: "Latest Trades" },
  { panel: "watchlist", icon: Eye, label: "Watchlist" },
  { panel: "events", icon: Calendar, label: "Events" },
  { panel: "summary", icon: FileText, label: "Summary" },
];

export function ChatToolbar({ openPanel, onTogglePanel }: ChatToolbarProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        {tools.map(({ panel, icon: Icon, label }) => (
          <Tooltip key={panel}>
            <TooltipTrigger asChild>
              <Button
                variant={openPanel === panel ? "secondary" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onTogglePanel(panel)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
