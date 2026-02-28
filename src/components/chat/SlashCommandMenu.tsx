"use client";

import { BarChart3, Eye, Calendar, FileText, ClipboardList } from "lucide-react";

type PanelType = "trades" | "watchlist" | "events" | "summary" | "digest";

const COMMANDS: Array<{
  command: string;
  label: string;
  description: string;
  icon: typeof BarChart3;
  panel: PanelType;
}> = [
  {
    command: "/trades",
    label: "Latest Trades",
    description: "Browse tracked trades",
    icon: BarChart3,
    panel: "trades",
  },
  {
    command: "/watchlist",
    label: "Watchlist",
    description: "Your watched instruments",
    icon: Eye,
    panel: "watchlist",
  },
  {
    command: "/events",
    label: "Events",
    description: "Upcoming trading events",
    icon: Calendar,
    panel: "events",
  },
  {
    command: "/summary",
    label: "Summary",
    description: "Topic summary & stats",
    icon: FileText,
    panel: "summary",
  },
  {
    command: "/digest",
    label: "Activity Digest",
    description: "Clan activity breakdown",
    icon: ClipboardList,
    panel: "digest",
  },
];

interface SlashCommandMenuProps {
  query: string;
  selectedIndex: number;
  onSelect: (panel: PanelType) => void;
}

export function SlashCommandMenu({
  query,
  selectedIndex,
  onSelect,
}: SlashCommandMenuProps) {
  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.command.startsWith(`/${query}`) ||
      cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full start-0 z-10 mb-1 w-64 rounded-lg border bg-popover p-1 shadow-md">
      {filtered.map((cmd, i) => {
        const Icon = cmd.icon;
        return (
          <button
            key={cmd.command}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm ${
              i === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(cmd.panel);
            }}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="font-medium">{cmd.command}</span>
              <span className="ms-2 text-xs text-muted-foreground">
                {cmd.description}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function getSlashCommands() {
  return COMMANDS;
}
