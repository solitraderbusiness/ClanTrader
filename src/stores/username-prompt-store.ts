import { create } from "zustand";

interface UsernamePromptStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useUsernamePromptStore = create<UsernamePromptStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
