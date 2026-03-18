import { create } from 'zustand';
import type { Player } from '@/engine/types/player.ts';
import type { Team } from '@/engine/types/team.ts';
import { FreeAgentPool, generateFreeAgents, signPlayer } from '@/engine/gm/FreeAgency.ts';
import type { FreeAgent } from '@/engine/gm/FreeAgency.ts';
import { generateDraftClass, makePick } from '@/engine/gm/DraftEngine.ts';
import type { DraftClass, DraftProspect } from '@/engine/gm/DraftEngine.ts';
import { evaluatePlayer, evaluateTrade, wouldAccept } from '@/engine/gm/TradeEngine.ts';
import type { TradePackage } from '@/engine/gm/TradeEngine.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';

interface GMState {
  freeAgentPool: FreeAgentPool | null;
  draftClass: DraftClass | null;
  tradeHistory: string[];

  // Actions
  initGM: (seed?: number) => void;
  getFreeAgents: () => FreeAgent[];
  signFreeAgent: (
    userTeam: Team,
    playerId: string,
    years: number,
    salary: number
  ) => { success: boolean; reason?: string; player?: Player };
  releasePlayer: (team: Team, playerId: string) => void;
  evaluatePlayerValue: (player: Player) => number;
  evaluateTradePackages: (offering: TradePackage, receiving: TradePackage, allTeams: Team[]) => number;
  checkAIAccepts: (aiTeam: Team, offering: TradePackage, receiving: TradePackage, allTeams: Team[]) => boolean;
  executeTrade: (userTeam: Team, aiTeam: Team, userGiving: string[], userReceiving: string[]) => boolean;
  generateDraft: (teamsCount: number, year?: number) => void;
  draftPlayer: (userTeam: Team, prospectId: string) => Player | null;
  getDraftProspects: () => DraftProspect[];
}

export const useGMStore = create<GMState>((set, get) => ({
  freeAgentPool: null,
  draftClass: null,
  tradeHistory: [],

  initGM: (seed = Date.now()) => {
    const rng = new RandomProvider(seed);
    const pool = generateFreeAgents(40, rng);
    const draftClass = generateDraftClass(5, 16, rng);
    set({ freeAgentPool: pool, draftClass });
  },

  getFreeAgents: () => {
    const pool = get().freeAgentPool;
    return pool ? pool.getAll() : [];
  },

  signFreeAgent: (userTeam, playerId, years, salary) => {
    const pool = get().freeAgentPool;
    if (!pool) return { success: false, reason: 'GM not initialized' };
    const result = signPlayer(pool, userTeam.roster.players, userTeam.id, playerId, years, salary);
    // Trigger re-render by creating a shallow copy reference
    set({ freeAgentPool: pool });
    return result;
  },

  releasePlayer: (team, playerId) => {
    const pool = get().freeAgentPool;
    if (!pool) return;
    const idx = team.roster.players.findIndex(p => p.id === playerId);
    if (idx === -1) return;
    const [released] = team.roster.players.splice(idx, 1);
    // Add back to free agent pool
    pool.add({
      player: released,
      askingSalary: Math.round(evaluatePlayer(released) * 80),
      yearsDesired: 1,
    });
    set({ freeAgentPool: pool });
  },

  evaluatePlayerValue: (player) => evaluatePlayer(player),

  evaluateTradePackages: (offering, receiving, allTeams) =>
    evaluateTrade(offering, receiving, allTeams),

  checkAIAccepts: (aiTeam, offering, receiving, allTeams) =>
    wouldAccept(aiTeam, offering, receiving, allTeams),

  executeTrade: (userTeam, aiTeam, userGiving, userReceiving) => {
    // Move players userGiving from userTeam to aiTeam
    const movedToAI: Player[] = [];
    for (const pid of userGiving) {
      const idx = userTeam.roster.players.findIndex(p => p.id === pid);
      if (idx !== -1) {
        const [p] = userTeam.roster.players.splice(idx, 1);
        movedToAI.push(p);
      }
    }
    aiTeam.roster.players.push(...movedToAI);

    // Move userReceiving from aiTeam to userTeam
    const movedToUser: Player[] = [];
    for (const pid of userReceiving) {
      const idx = aiTeam.roster.players.findIndex(p => p.id === pid);
      if (idx !== -1) {
        const [p] = aiTeam.roster.players.splice(idx, 1);
        movedToUser.push(p);
      }
    }
    userTeam.roster.players.push(...movedToUser);

    const log = `Traded ${userGiving.length} player(s) for ${userReceiving.length} player(s)`;
    set(s => ({ tradeHistory: [log, ...s.tradeHistory] }));
    return true;
  },

  generateDraft: (teamsCount, year = 2026) => {
    const rng = new RandomProvider(Date.now());
    const draftClass = generateDraftClass(5, teamsCount, rng, year);
    set({ draftClass });
  },

  draftPlayer: (userTeam, prospectId) => {
    const { draftClass } = get();
    if (!draftClass) return null;
    const player = makePick(draftClass, userTeam.id, prospectId);
    if (player) {
      userTeam.roster.players.push(player);
      set({ draftClass: { ...draftClass } });
    }
    return player;
  },

  getDraftProspects: () => {
    const { draftClass } = get();
    return draftClass ? draftClass.prospects : [];
  },
}));
