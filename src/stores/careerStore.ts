import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CareerState } from '@/engine/player/CareerEngine.ts';
import {
  emptySeasonStats,
  emptyCareerStats,
  simulateMinorLeagueDay,
  checkPromotion,
  promotePlayer,
  advanceOffseason as doAdvanceOffseason,
  getTeamForLevel,
} from '@/engine/player/CareerEngine.ts';
import { generatePlayer } from '@/engine/player/PlayerGenerator.ts';
import type { GeneratePlayerOptions } from '@/engine/player/PlayerGenerator.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';

interface CareerStore {
  careerState: CareerState | null;
  isInitialized: boolean;

  // Actions
  createPlayer: (opts: GeneratePlayerOptions) => void;
  advanceDay: () => void;
  simWeek: () => void;
  simToCallUp: () => void;
  advanceOffseason: () => void;
  dismissPromotion: () => void;
  resetCareer: () => void;
}

function makeRng(): RandomProvider {
  return new RandomProvider(Date.now() ^ (Math.random() * 0xffffffff) | 0);
}

export const useCareerStore = create<CareerStore>()(
  persist(
    (set, get) => ({
      careerState: null,
      isInitialized: false,

      createPlayer: (opts) => {
        const rng = makeRng();
        const player = generatePlayer(opts);
        const startTeam = getTeamForLevel('A', rng);

        const state: CareerState = {
          player,
          currentTeam: startTeam,
          year: 2024,
          level: 'A',
          seasonStats: emptySeasonStats(),
          careerStats: emptyCareerStats(),
          dayOfSeason: 0,
          promotionPending: false,
          promotionMessage: null,
          recentEvents: [`Career begins! Welcome to ${startTeam}.`],
        };
        set({ careerState: state, isInitialized: true });
      },

      advanceDay: () => {
        const { careerState } = get();
        if (!careerState) return;
        const rng = makeRng();
        let next = simulateMinorLeagueDay(careerState, rng);

        if (checkPromotion(next) && next.level !== 'MLB') {
          next = promotePlayer(next, rng);
        }
        set({ careerState: next });
      },

      simWeek: () => {
        const { careerState } = get();
        if (!careerState) return;
        const rng = makeRng();
        let current = careerState;

        for (let i = 0; i < 7; i++) {
          if (current.dayOfSeason >= 140) break;
          current = simulateMinorLeagueDay(current, rng);
          if (checkPromotion(current) && current.level !== 'MLB') {
            current = promotePlayer(current, rng);
            break;
          }
        }
        set({ careerState: current });
      },

      simToCallUp: () => {
        const { careerState } = get();
        if (!careerState) return;
        const rng = makeRng();
        let current = careerState;
        let maxDays = 140;

        while (maxDays-- > 0 && current.dayOfSeason < 140) {
          current = simulateMinorLeagueDay(current, rng);
          if (checkPromotion(current)) {
            current = promotePlayer(current, rng);
            break;
          }
        }

        // If sim ended and no promotion, show end-of-season message
        if (!current.promotionPending && current.dayOfSeason >= 140) {
          current = {
            ...current,
            recentEvents: ['Season ended without a call-up. Keep grinding!'],
          };
        }
        set({ careerState: current });
      },

      advanceOffseason: () => {
        const { careerState } = get();
        if (!careerState) return;
        const rng = makeRng();
        set({ careerState: doAdvanceOffseason(careerState, rng) });
      },

      dismissPromotion: () => {
        const { careerState } = get();
        if (!careerState) return;
        set({ careerState: { ...careerState, promotionPending: false, promotionMessage: null } });
      },

      resetCareer: () => {
        set({ careerState: null, isInitialized: false });
      },
    }),
    { name: 'claudeball-career' }
  )
);
