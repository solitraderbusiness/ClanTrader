"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Save } from "lucide-react";
import { toast } from "sonner";

interface BadgeItem {
  id: string;
  key: string;
  name: string;
  displayOrder: number;
}

interface BadgeReorderListProps {
  badges: BadgeItem[];
  onSaved: () => void;
}

export function BadgeReorderList({ badges: initial, onSaved }: BadgeReorderListProps) {
  const [items, setItems] = useState<BadgeItem[]>(
    [...initial].sort((a, b) => a.displayOrder - b.displayOrder)
  );
  const [saving, setSaving] = useState(false);

  function moveUp(index: number) {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setItems(newItems);
  }

  function moveDown(index: number) {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setItems(newItems);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        items: items.map((item, i) => ({ id: item.id, displayOrder: i })),
      };

      const res = await fetch("/api/admin/badges/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();
      toast.success("Badge order saved");
      onSaved();
    } catch {
      toast.error("Failed to save order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
        >
          <span className="w-6 text-center text-xs text-muted-foreground">
            {i}
          </span>
          <span className="flex-1 text-sm font-medium">{item.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {item.key}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => moveUp(i)}
            disabled={i === 0}
            className="h-7 w-7 p-0"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => moveDown(i)}
            disabled={i === items.length - 1}
            className="h-7 w-7 p-0"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button onClick={save} disabled={saving} size="sm" className="mt-2">
        <Save className="me-2 h-3 w-3" />
        {saving ? "Saving..." : "Save Order"}
      </Button>
    </div>
  );
}
