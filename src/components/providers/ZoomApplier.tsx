"use client";

import { useLayoutEffect } from "react";
import { useZoomStore } from "@/stores/zoom-store";

/**
 * Scales the UI by adjusting the root font-size.
 * All Tailwind utilities are rem-based so text, padding, gaps etc. scale up.
 * Viewport units (h-screen), px values (h-[600px]), and responsive breakpoints
 * stay unchanged — the layout never breaks on mobile.
 */
export function ZoomApplier() {
  const zoom = useZoomStore((s) => s.zoom);

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (zoom === 100) {
      html.style.removeProperty("font-size");
    } else {
      // Default browser font-size is 16px; scale proportionally
      html.style.fontSize = `${(zoom / 100) * 16}px`;
    }
  }, [zoom]);

  return null;
}
