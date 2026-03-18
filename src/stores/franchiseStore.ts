import { create } from 'zustand';
import type { Team } from '@/engine/types/index.ts';
import type { SeasonState } from '@/engine/season/index.ts';
import { SeasonEngine } from '@/engine/season/index.ts';

interface FranchiseState {
  // State
  engine: SeasonEngine | null;
  season: SeasonState | null;
  userTeamId: string | null;
  teams: Team[];
  leagueStructure: Record<string, Record<string, string[]>>;
  isInitialized: boolean;

  // Actions
  startFranchise: (teams: Team[], leagueStructure: Record<string, Record<string, string[]>>, userTeamId: string) => void;
  advanceDay: () => ReturnType<SeasonEngine['advanceDay']>;
  simDays: (count: number) => void;
  simGame: (gameId: string) => void;
  recordGameResult: (gameId: string, awayScore: number, homeScore: number) => void;
  refresh: () => void;
}

export const useFranchiseStore = create<FranchiseState>((set, get) => ({
  engine: null,
  season: null,
  userTeamId: null,
  teams: [],
  leagueStructure: {},
  isInitialized: false,

  startFranchise: (teams, leagueStructure, userTeamId) => {
    const engine = new SeasonEngine(teams, leagueStructure, userTeamId);
    set({
      engine,
      season: engine.getState(),
      userTeamId,
      teams,
      leagueStructure,
      isInitialized: true,
    });
  },

  advanceDay: () => {
    const { engine } = get();
    if (!engine) return null;
    const userGame = engine.advanceDay();
    set({ season: { ...engine.getState() } });
    return userGame;
  },

  simDays: (count) => {
    const { engine } = get();
    if (!engine) return;
    engine.simDays(count);
    set({ season: { ...engine.getState() } });
  },

  simGame: (gameId) => {
    const { engine } = get();
    if (!engine) return;
    const game = engine.getState().schedule.find(g => g.id === gameId);
    if (game && !game.played) {
      engine.simGame(game);
      set({ season: { ...engine.getState() } });
    }
  },

  recordGameResult: (gameId, awayScore, homeScore) => {
    const { engine } = get();
    if (!engine) return;
    engine.recordUserGameResult(gameId, awayScore, homeScore);
    set({ season: { ...engine.getState() } });
  },

  refresh: () => {
    const { engine } = get();
    if (!engine) return;
    set({ season: { ...engine.getState() } });
  },
}));
