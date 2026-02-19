import { create } from "zustand";

interface TradePanelState {
  statusFilter: string | null;
  instrumentFilter: string | null;
  directionFilter: string | null;
  setStatusFilter: (status: string | null) => void;
  setInstrumentFilter: (instrument: string | null) => void;
  setDirectionFilter: (direction: string | null) => void;
  resetFilters: () => void;
}

export const useTradePanelStore = create<TradePanelState>((set) => ({
  statusFilter: null,
  instrumentFilter: null,
  directionFilter: null,
  setStatusFilter: (status) => set({ statusFilter: status }),
  setInstrumentFilter: (instrument) => set({ instrumentFilter: instrument }),
  setDirectionFilter: (direction) => set({ directionFilter: direction }),
  resetFilters: () =>
    set({
      statusFilter: null,
      instrumentFilter: null,
      directionFilter: null,
    }),
}));
