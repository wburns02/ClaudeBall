import { create } from 'zustand';
import type { Team } from '@/engine/types/index.ts';
import { useFranchiseStore } from './franchiseStore.ts';

export interface SaveSlot {
  id: string;
  name: string;
  date: string;       // ISO string
  teamName: string;
  teamCity: string;
  season: number;
  day: number;
  franchiseData: string; // JSON serialized snapshot
}

interface FranchiseSnapshot {
  userTeamId: string;
  teams: Team[];
  leagueStructure: Record<string, Record<string, string[]>>;
  // We store a plain-object version of SeasonState (standings is serialized separately)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  season: Record<string, unknown>;
}

const STORAGE_KEY = 'claudeball_saves';
const MAX_SLOTS = 10;

function loadSaves(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SaveSlot[];
  } catch {
    return [];
  }
}

function persistSaves(saves: SaveSlot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  } catch {
    // Ignore storage errors silently
  }
}

interface SaveStoreState {
  saves: SaveSlot[];
  listSaves: () => SaveSlot[];
  saveGame: (name: string, slotId?: string) => SaveSlot | null;
  loadGame: (slotId: string) => boolean;
  deleteSave: (slotId: string) => void;
  refresh: () => void;
}

export const useSaveStore = create<SaveStoreState>((set, get) => ({
  saves: loadSaves(),

  listSaves: () => get().saves,

  saveGame: (name: string, slotId?: string) => {
    const franchise = useFranchiseStore.getState();
    if (!franchise.isInitialized || !franchise.season) return null;

    const saves = [...get().saves];

    const userTeam = franchise.teams.find((t) => t.id === franchise.userTeamId);

    const snapshot: FranchiseSnapshot = {
      userTeamId: franchise.userTeamId ?? '',
      teams: franchise.teams,
      leagueStructure: franchise.leagueStructure,
      season: franchise.season as unknown as Record<string, unknown>,
    };

    const slot: SaveSlot = {
      id: slotId ?? `save_${Date.now()}`,
      name,
      date: new Date().toISOString(),
      teamName: userTeam?.name ?? 'Unknown',
      teamCity: userTeam?.city ?? '',
      season: (franchise.season.year as number) ?? 2026,
      day: (franchise.season.currentDay as number) ?? 0,
      franchiseData: JSON.stringify(snapshot),
    };

    if (slotId) {
      const idx = saves.findIndex((s) => s.id === slotId);
      if (idx >= 0) {
        saves[idx] = slot;
      } else {
        saves.unshift(slot);
      }
    } else {
      saves.unshift(slot);
      if (saves.length > MAX_SLOTS) saves.length = MAX_SLOTS;
    }

    persistSaves(saves);
    set({ saves: [...saves] });
    return slot;
  },

  loadGame: (slotId: string) => {
    const slot = get().saves.find((s) => s.id === slotId);
    if (!slot) return false;

    try {
      const data = JSON.parse(slot.franchiseData) as FranchiseSnapshot;

      // Re-initialize the franchise (rebuilds SeasonEngine from scratch)
      useFranchiseStore.getState().startFranchise(
        data.teams,
        data.leagueStructure,
        data.userTeamId,
      );

      // Overwrite the freshly-generated season state with the saved one
      // Cast needed because StandingsTracker is a class but we have a plain object
      useFranchiseStore.setState({
        season: data.season as never,
      });

      return true;
    } catch {
      return false;
    }
  },

  deleteSave: (slotId: string) => {
    const saves = get().saves.filter((s) => s.id !== slotId);
    persistSaves(saves);
    set({ saves });
  },

  refresh: () => {
    set({ saves: loadSaves() });
  },
}));
