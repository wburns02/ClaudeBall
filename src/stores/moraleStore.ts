import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player } from '@/engine/types/index.ts';
import {
  initPlayerMorale, computeDailyMoraleChange, computeTeamChemistry,
  getMoraleLabel, getMoraleColor,
} from '@/engine/player/MoraleEngine.ts';
import type { MoraleEvent, TeamChemistry } from '@/engine/player/MoraleEngine.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';

export type { MoraleEvent };

interface MoraleState {
  // playerId → morale value (0-100)
  playerMorales: Record<string, number>;

  // Recent morale events (last 50)
  recentEvents: MoraleEvent[];

  // Cached team chemistry
  teamChemistry: TeamChemistry | null;

  // Last day morale was processed — used to catch up when simming multiple days
  lastProcessedDay: number;

  // Actions
  initMorales: (players: Player[]) => void;
  applyDailyUpdate: (params: DailyUpdateParams) => void;
  /** Process multiple days in a single batch (single set() call for performance) */
  applyMultiDayUpdate: (params: Omit<DailyUpdateParams, 'day'>, fromDay: number, toDay: number) => void;
  getPlayerMorale: (playerId: string) => number;
  applyManualBoost: (playerId: string, playerName: string, delta: number, reason: string, day: number) => void;
  clearMorales: () => void;
}

export interface DailyUpdateParams {
  players: Player[];
  teamWins: number;
  teamLosses: number;
  recentWins: number;
  recentLosses: number;
  gamesPlayed: number;
  /** playerId → games in lineup */
  gamesInLineupMap: Record<string, number>;
  /** playerId → contract years remaining */
  contractYearsMap: Record<string, number>;
  /** playerId → salary pct diff vs market */
  salaryPercDiffMap: Record<string, number>;
  day: number;
}

const MAX_EVENTS = 60;

export const useMoraleStore = create<MoraleState>()(
  persist(
    (set, get) => ({
      playerMorales: {},
      recentEvents: [],
      teamChemistry: null,
      lastProcessedDay: 0,

      initMorales: (players) => {
        const { playerMorales } = get();
        const next = { ...playerMorales };
        let anyNew = false;
        for (const p of players) {
          if (!(p.id in next)) {
            next[p.id] = initPlayerMorale(p);
            anyNew = true;
          }
        }
        if (anyNew) set({ playerMorales: next });
      },

      applyDailyUpdate: (params) => {
        const { players, teamWins, teamLosses, recentWins, recentLosses,
                gamesPlayed, gamesInLineupMap, contractYearsMap, salaryPercDiffMap, day } = params;
        const rng = new RandomProvider(day * 31337 + teamWins * 7);
        const { playerMorales, recentEvents } = get();

        const next = { ...playerMorales };
        const newEvents: MoraleEvent[] = [];

        for (const player of players) {
          const current = next[player.id] ?? initPlayerMorale(player);
          const gamesInLineup = gamesInLineupMap[player.id] ?? 0;
          const contractYearsLeft = contractYearsMap[player.id] ?? 1;
          const salaryPercDiff = salaryPercDiffMap[player.id] ?? 0;
          const isStarter = player.position !== 'P';

          const { delta, reason } = computeDailyMoraleChange({
            player, currentMorale: current,
            teamWins, teamLosses, recentWins, recentLosses,
            gamesPlayed, gamesInLineup, contractYearsLeft, salaryPercDiff,
            isStarter, day, rng,
          });

          if (delta !== 0) {
            next[player.id] = Math.round(Math.max(5, Math.min(99, current + delta)));
            if (reason && Math.abs(delta) >= 1) {
              newEvents.push({
                playerId: player.id,
                playerName: `${player.firstName} ${player.lastName}`,
                delta: Math.round(delta),
                reason,
                day,
              });
            }
          } else {
            next[player.id] = current;
          }
        }

        // Recompute team chemistry
        const chemistry = computeTeamChemistry(players, next, teamWins, teamLosses);

        const allEvents = [...newEvents, ...recentEvents].slice(0, MAX_EVENTS);
        set({ playerMorales: next, recentEvents: allEvents, teamChemistry: chemistry, lastProcessedDay: day });
      },

      applyMultiDayUpdate: (params, fromDay, toDay) => {
        const { players, teamWins, teamLosses, recentWins, recentLosses,
                gamesPlayed, gamesInLineupMap, contractYearsMap, salaryPercDiffMap } = params;
        const { playerMorales, recentEvents } = get();

        // Work with a mutable copy — single set() at the end
        const next = { ...playerMorales };
        const newEvents: MoraleEvent[] = [];

        for (let day = fromDay; day <= toDay; day++) {
          const rng = new RandomProvider(day * 31337 + teamWins * 7);

          for (const player of players) {
            const current = next[player.id] ?? initPlayerMorale(player);
            const gamesInLineup = gamesInLineupMap[player.id] ?? 0;
            const contractYearsLeft = contractYearsMap[player.id] ?? 1;
            const salaryPercDiff = salaryPercDiffMap[player.id] ?? 0;
            const isStarter = player.position !== 'P';

            const { delta, reason } = computeDailyMoraleChange({
              player, currentMorale: current,
              teamWins, teamLosses, recentWins, recentLosses,
              gamesPlayed, gamesInLineup, contractYearsLeft, salaryPercDiff,
              isStarter, day, rng,
            });

            if (delta !== 0) {
              next[player.id] = Math.round(Math.max(5, Math.min(99, current + delta)));
              if (reason && Math.abs(delta) >= 1) {
                newEvents.push({
                  playerId: player.id,
                  playerName: `${player.firstName} ${player.lastName}`,
                  delta: Math.round(delta),
                  reason,
                  day,
                });
              }
            } else {
              next[player.id] = current;
            }
          }
        }

        // Recompute team chemistry based on final morales
        const chemistry = computeTeamChemistry(players, next, teamWins, teamLosses);

        // Keep only the most recent events
        const allEvents = [...newEvents, ...recentEvents].slice(0, MAX_EVENTS);
        set({ playerMorales: next, recentEvents: allEvents, teamChemistry: chemistry, lastProcessedDay: toDay });
      },

      getPlayerMorale: (playerId) => {
        return get().playerMorales[playerId] ?? 60;
      },

      applyManualBoost: (playerId, playerName, delta, reason, day) => {
        const { playerMorales, recentEvents } = get();
        const current = playerMorales[playerId] ?? 60;
        const next = {
          ...playerMorales,
          [playerId]: Math.round(Math.max(5, Math.min(99, current + delta))),
        };
        const event: MoraleEvent = { playerId, playerName, delta, reason, day };
        set({ playerMorales: next, recentEvents: [event, ...recentEvents].slice(0, MAX_EVENTS) });
      },

      clearMorales: () => set({ playerMorales: {}, recentEvents: [], teamChemistry: null, lastProcessedDay: 0 }),
    }),
    {
      name: 'claudeball-morale',
      partialize: (s) => ({
        playerMorales: s.playerMorales,
        recentEvents: s.recentEvents,
        teamChemistry: s.teamChemistry,
        lastProcessedDay: s.lastProcessedDay,
      }),
    }
  )
);

// Re-export helpers so consumers don't need to import from engine directly
export { getMoraleLabel, getMoraleColor };
