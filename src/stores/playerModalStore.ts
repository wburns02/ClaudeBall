import { create } from 'zustand';

interface PlayerModalState {
  openPlayerId: string | null;
  openPlayer: (id: string) => void;
  closePlayer: () => void;
}

export const usePlayerModal = create<PlayerModalState>((set) => ({
  openPlayerId: null,
  openPlayer: (id) => set({ openPlayerId: id }),
  closePlayer: () => set({ openPlayerId: null }),
}));
