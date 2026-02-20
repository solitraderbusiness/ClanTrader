"use client";

import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useFontStore,
  EN_FONT_OPTIONS,
  FA_FONT_OPTIONS,
} from "@/stores/font-store";

export function FontSwitch() {
  const { enFont, faFont, setEnFont, setFaFont } = useFontStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Type className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Switch font</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>English Font</DropdownMenuLabel>
        {EN_FONT_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setEnFont(opt.value)}
            className={enFont === opt.value ? "bg-accent" : ""}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Persian Font</DropdownMenuLabel>
        {FA_FONT_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setFaFont(opt.value)}
            className={faFont === opt.value ? "bg-accent" : ""}
          >
            {opt.label} ({opt.labelFa})
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
