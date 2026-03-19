import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';
import { generateScoutingReport, defaultScoutingStaff, STAFF_TIERS } from '@/engine/gm/ScoutingEngine.ts';
import type { ScoutingStaff, PlayerScoutingReport } from '@/engine/gm/ScoutingEngine.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';

interface ScoutingState {
  staff: ScoutingStaff;
  reports: Record<string, PlayerScoutingReport>; // keyed by playerId
  pendingScouts: Set<string>;                    // playerIds currently being "scouted"
}

interface ScoutingActions {
  /** Generate a scouting report for a player. isOwnPlayer=true gives perfect accuracy. */
  scoutPlayer: (playerId: string, teamId: string, isOwnPlayer?: boolean) => void;
  /** Get a cached report, or null if not scouted. */
  getReport: (playerId: string) => PlayerScoutingReport | null;
  /** Upgrade the scouting staff to a higher tier. Returns false if already at or above. */
  upgradeStaff: (level: ScoutingStaff['level']) => boolean;
  /** Re-scout own players with perfect accuracy (called on new season start). */
  scoutOwnRoster: (teamId: string) => void;
  /** Clear all reports (e.g. new franchise). */
  reset: () => void;
  isPending: (playerId: string) => boolean;
}

const rng = new RandomProvider(Date.now());

export const useScoutingStore = create<ScoutingState & ScoutingActions>()(
  persist(
    (set, get) => ({
      staff: defaultScoutingStaff(),
      reports: {},
      pendingScouts: new Set(),

      scoutPlayer: (playerId, teamId, isOwnPlayer = false) => {
        const { pendingScouts, reports, staff } = get();
        if (pendingScouts.has(playerId) && !isOwnPlayer) return; // already in progress

        // Find the player in the franchise store
        const franchiseState = useFranchiseStore.getState();
        const allTeams = franchiseState.teams;
        const player = allTeams.flatMap(t => t.roster.players).find(p => p.id === playerId);
        if (!player) return;

        const currentDay = franchiseState.season?.currentDay ?? 0;

        if (!isOwnPlayer) {
          // Add to pending set for animation
          const newPending = new Set(pendingScouts);
          newPending.add(playerId);
          set({ pendingScouts: newPending });

          // Simulate async scouting (500ms delay for UX)
          setTimeout(() => {
            const report = generateScoutingReport(player, teamId, currentDay, staff, rng, false);
            set(s => {
              const newPending2 = new Set(s.pendingScouts);
              newPending2.delete(playerId);
              return {
                reports: { ...s.reports, [playerId]: report },
                pendingScouts: newPending2,
              };
            });
          }, 500);
        } else {
          // Own players: instant perfect report
          const report = generateScoutingReport(player, teamId, currentDay, staff, rng, true);
          set({ reports: { ...reports, [playerId]: report } });
        }
      },

      getReport: (playerId) => {
        return get().reports[playerId] ?? null;
      },

      upgradeStaff: (level) => {
        const current = get().staff;
        const currentIdx = STAFF_TIERS.findIndex(t => t.level === current.level);
        const targetIdx  = STAFF_TIERS.findIndex(t => t.level === level);
        if (targetIdx <= currentIdx) return false;
        const tier = STAFF_TIERS[targetIdx]!;
        set({ staff: { accuracy: tier.accuracy, budget: tier.budget, level: tier.level, specialties: current.specialties } });
        return true;
      },

      scoutOwnRoster: (teamId) => {
        const franchiseState = useFranchiseStore.getState();
        const team = franchiseState.teams.find(t => t.id === teamId);
        if (!team) return;
        const { staff, reports } = get();
        const currentDay = franchiseState.season?.currentDay ?? 0;
        const newReports = { ...reports };
        for (const player of team.roster.players) {
          const report = generateScoutingReport(player, teamId, currentDay, staff, rng, true);
          newReports[player.id] = report;
        }
        set({ reports: newReports });
      },

      reset: () => set({ reports: {}, pendingScouts: new Set(), staff: defaultScoutingStaff() }),

      isPending: (playerId) => get().pendingScouts.has(playerId),
    }),
    {
      name: 'claudeball-scouting',
      partialize: (state) => ({
        staff: state.staff,
        reports: state.reports,
        // pendingScouts (Set) can't be serialized — reset on reload
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // @ts-ignore — reset pending scouts on reload (not serializable)
          state.pendingScouts = new Set();
        }
      },
    }
  )
);
