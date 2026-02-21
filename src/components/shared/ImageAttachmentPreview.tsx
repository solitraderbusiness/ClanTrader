"use client";

import { X } from "lucide-react";

interface ImageAttachmentPreviewProps {
  previews: string[];
  onRemove: (index: number) => void;
}

export function ImageAttachmentPreview({
  previews,
  onRemove,
}: ImageAttachmentPreviewProps) {
  if (previews.length === 0) return null;

  return (
    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
      {previews.map((src, i) => (
        <div key={i} className="relative flex-shrink-0">
          <img
            src={src}
            alt={`Attachment ${i + 1}`}
            className="h-16 w-16 rounded-lg object-cover"
          />
          <button
            type="button"
            className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
            onClick={() => onRemove(i)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
