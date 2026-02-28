import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ZoomLevel = 100 | 125 | 150 | 175 | 200;

export const ZOOM_OPTIONS: { value: ZoomLevel; label: string }[] = [
  { value: 100, label: "100%" },
  { value: 125, label: "125%" },
  { value: 150, label: "150%" },
  { value: 175, label: "175%" },
  { value: 200, label: "200%" },
];

interface ZoomState {
  zoom: ZoomLevel;
  setZoom: (level: ZoomLevel) => void;
}

export const useZoomStore = create<ZoomState>()(
  persist(
    (set) => ({
      zoom: 100,
      setZoom: (level) => set({ zoom: level }),
    }),
    { name: "clantrader-zoom" }
  )
);
