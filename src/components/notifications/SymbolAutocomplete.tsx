"use client";

import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface SymbolAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  symbols: string[];
  loading?: boolean;
  placeholder?: string;
  id?: string;
}

export function SymbolAutocomplete({
  value,
  onChange,
  symbols,
  loading,
  placeholder,
  id,
}: SymbolAutocompleteProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const filtered = symbols.filter((sym) =>
    sym.includes(value.toUpperCase())
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value.toUpperCase());
      setOpen(true);
      setSelectedIndex(0);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (sym: string) => {
      onChange(sym);
      setOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [open, filtered, selectedIndex, handleSelect]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpen(true);
    setSelectedIndex(0);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimeout.current = setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={loading ? t("priceAlerts.loadingSymbols") : placeholder}
        className="uppercase"
        autoComplete="off"
        disabled={loading}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full start-0 z-50 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md max-h-48 overflow-y-auto">
          {filtered.map((sym, i) => (
            <button
              key={sym}
              type="button"
              className={cn(
                "flex w-full items-center rounded px-2 py-1.5 text-start text-sm font-mono",
                i === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(sym);
              }}
            >
              {sym}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && value.trim() && !loading && (
        <div className="absolute top-full start-0 z-50 mt-1 w-full rounded-lg border bg-popover p-2 shadow-md">
          <p className="text-sm text-muted-foreground">
            {t("priceAlerts.noMatchingSymbol")}
          </p>
        </div>
      )}
    </div>
  );
}
