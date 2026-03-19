import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CareerState, TrainingPlan, TrainingFocus, Milestone } from '@/engine/player/CareerEngine.ts';
import {
  emptySeasonStats,
  emptyCareerStats,
  simulateMinorLeagueDay,
  checkPromotion,
  promotePlayer,
  advanceOffseason as doAdvanceOffseason,
  getTeamForLevel,
  defaultTeamDynamics,
  rookieContract,
  defaultTrainingPlan,
  emptyHofStatus,
  generateContractOffers,
} from '@/engine/player/CareerEngine.ts';
import { generatePlayer } from '@/engine/player/PlayerGenerator.ts';
import type { GeneratePlayerOptions } from '@/engine/player/PlayerGenerator.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';

interface ContractOffer {
  teamName: string;
  years: number;
  salary: number;
}

interface CareerStore {
  careerState: CareerState | null;
  isInitialized: boolean;
  contractOffers: ContractOffer[];
  showContractNegotiation: boolean;

  // Actions
  createPlayer: (opts: GeneratePlayerOptions) => void;
  advanceDay: () => void;
  simWeek: () => void;
  simToCallUp: () => void;
  advanceOffseason: () => void;
  dismissPromotion: () => void;
  resetCareer: () => void;
  dismissPendingMilestone: (id: string) => void;
  setTrainingPlan: (plan: TrainingPlan) => void;
  openContractNegotiation: () => void;
  signContract: (offer: ContractOffer) => void;
  dismissContractNegotiation: () => void;
  retirePlayer: () => void;
  grantMilestone: (id: string) => void;
}

function makeRng(): RandomProvider {
  return new RandomProvider(Date.now() ^ (Math.random() * 0xffffffff) | 0);
}

export const useCareerStore = create<CareerStore>()(
  persist(
    (set, get) => ({
      careerState: null,
      isInitialized: false,
      contractOffers: [],
      showContractNegotiation: false,

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
          milestones: [],
          pendingMilestones: [],
          seasonLog: [],
          teamDynamics: defaultTeamDynamics(),
          contract: rookieContract(startTeam),
          trainingPlan: defaultTrainingPlan(),
          hofStatus: emptyHofStatus(),
          retired: false,
          currentSeasonAwards: [],
        };
        set({ careerState: state, isInitialized: true, contractOffers: [], showContractNegotiation: false });
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
        const next = doAdvanceOffseason(careerState, rng);

        // After offseason, check if contract is up
        const needsContract = next.contract.yearsRemaining <= 0;
        if (needsContract) {
          const offers = generateContractOffers(next, rng);
          set({
            careerState: next,
            contractOffers: offers,
            showContractNegotiation: true,
          });
        } else {
          set({ careerState: next });
        }
      },

      dismissPromotion: () => {
        const { careerState } = get();
        if (!careerState) return;
        set({ careerState: { ...careerState, promotionPending: false, promotionMessage: null } });
      },

      resetCareer: () => {
        set({ careerState: null, isInitialized: false, contractOffers: [], showContractNegotiation: false });
      },

      dismissPendingMilestone: (id: string) => {
        const { careerState } = get();
        if (!careerState) return;
        set({
          careerState: {
            ...careerState,
            pendingMilestones: careerState.pendingMilestones.filter((m: Milestone) => m.id !== id),
          },
        });
      },

      setTrainingPlan: (plan: TrainingPlan) => {
        const { careerState } = get();
        if (!careerState) return;
        set({ careerState: { ...careerState, trainingPlan: plan } });
      },

      openContractNegotiation: () => {
        const { careerState } = get();
        if (!careerState) return;
        const rng = makeRng();
        const offers = generateContractOffers(careerState, rng);
        set({ contractOffers: offers, showContractNegotiation: true });
      },

      signContract: (offer: ContractOffer) => {
        const { careerState } = get();
        if (!careerState) return;
        const contract = {
          teamName: offer.teamName,
          yearsRemaining: offer.years,
          totalYears: offer.years,
          annualSalary: offer.salary,
          isFA: offer.teamName !== careerState.currentTeam,
        };
        const newTeam = offer.teamName;
        set({
          careerState: {
            ...careerState,
            currentTeam: newTeam,
            contract,
            recentEvents: [`Signed ${offer.years}-year, $${(offer.salary / 1000).toFixed(1)}M/yr deal with ${offer.teamName}!`],
          },
          contractOffers: [],
          showContractNegotiation: false,
        });
      },

      dismissContractNegotiation: () => {
        set({ showContractNegotiation: false, contractOffers: [] });
      },

      retirePlayer: () => {
        const { careerState } = get();
        if (!careerState) return;
        const isPitcher = careerState.player.position === 'P';
        const cs = careerState.careerStats;
        // HOF eligibility
        let hofScore = 0;
        if (isPitcher) {
          hofScore += Math.min(40, (cs.pitching.wins / 300) * 40);
          hofScore += Math.min(30, (cs.pitching.so_p / 3000) * 30);
          hofScore += Math.min(20, cs.seasons >= 15 ? 20 : (cs.seasons / 15) * 20);
          hofScore += Math.min(10, (cs.seasons / 20) * 10);
        } else {
          hofScore += Math.min(30, (cs.batting.h / 3000) * 30);
          hofScore += Math.min(25, (cs.batting.hr / 500) * 25);
          hofScore += Math.min(20, (cs.batting.rbi / 1500) * 20);
          hofScore += Math.min(15, (cs.batting.sb / 300) * 15);
          const avg = cs.batting.ab > 0 ? cs.batting.h / cs.batting.ab : 0;
          hofScore += Math.min(10, (avg / 0.300) * 10);
        }
        hofScore = Math.min(100, Math.round(hofScore));

        const inducted = hofScore >= 75;
        const hofStatus = {
          eligible: true,
          inducted,
          inductionYear: inducted ? careerState.year + 5 : null,
          hofScore,
          retirementYear: careerState.year,
        };

        set({
          careerState: {
            ...careerState,
            retired: true,
            hofStatus,
            recentEvents: [
              `${careerState.player.firstName} ${careerState.player.lastName} retires after ${cs.seasons} seasons.`,
              inducted ? `HOF INDUCTEE! Score: ${hofScore}/100` : `HOF Score: ${hofScore}/100 (threshold: 75)`,
            ],
          },
        });
      },

      grantMilestone: (id: string) => {
        const { careerState } = get();
        if (!careerState) return;
        const updated = careerState.milestones.map((m: Milestone) =>
          m.id === id ? { ...m, achieved: true, year: careerState.year } : m
        );
        // If it wasn't in the list, add it
        const exists = updated.some((m: Milestone) => m.id === id);
        if (!exists) {
          const allMilestoneDefs: { id: string; label: string; description: string }[] = [
            { id: 'all_star',   label: 'All-Star Selection',  description: 'Selected to the All-Star Game.' },
            { id: 'award_mvp',  label: 'MVP Award',           description: 'Win the Most Valuable Player award.' },
            { id: 'award_cy',   label: 'Cy Young Award',      description: 'Win the Cy Young Award.' },
            { id: 'award_roty', label: 'Rookie of the Year',  description: 'Win Rookie of the Year.' },
            { id: 'award_gs',   label: 'Gold Glove',          description: 'Win the Gold Glove Award.' },
          ];
          const def = allMilestoneDefs.find(d => d.id === id);
          if (def) {
            const newM: Milestone = { ...def, achieved: true, year: careerState.year };
            updated.push(newM);
            set({
              careerState: {
                ...careerState,
                milestones: updated,
                pendingMilestones: [...careerState.pendingMilestones, newM],
              },
            });
            return;
          }
        }
        set({ careerState: { ...careerState, milestones: updated } });
      },
    }),
    { name: 'claudeball-career' }
  )
);
