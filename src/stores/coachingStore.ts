import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';
import {
  generateStaff, generateHiringPool, calculateStaffBonus,
  type Coach, type CoachRole, type StaffBonus,
} from '@/engine/staff/CoachingStaff.ts';

interface CoachingState {
  staff: Coach[];
  hiringPool: Coach[];
  hiringRole: CoachRole | null;
  staffBonus: StaffBonus;

  // Actions
  initStaff: (seed?: number) => void;
  hireCoach: (coachId: string) => void;
  fireCoach: (role: CoachRole) => void;
  openHiring: (role: CoachRole, seed?: number) => void;
  closeHiring: () => void;
  refreshBonus: () => void;
  clear: () => void;
}

const DEFAULT_BONUS: StaffBonus = { battingDev: 0, pitchingDev: 0, morale: 0, gameStrategy: 0, scoutAccuracy: 0 };

export const useCoachingStore = create<CoachingState>()(
  persist(
    (set, get) => ({
      staff: [],
      hiringPool: [],
      hiringRole: null,
      staffBonus: DEFAULT_BONUS,

      initStaff: (seed) => {
        if (get().staff.length > 0) return; // already initialized
        const rng = new RandomProvider(seed ?? Date.now());
        const staff = generateStaff(rng);
        set({ staff, staffBonus: calculateStaffBonus(staff) });
      },

      hireCoach: (coachId) => {
        const { hiringPool, staff, hiringRole } = get();
        const coach = hiringPool.find(c => c.id === coachId);
        if (!coach || !hiringRole) return;
        // Replace existing coach in that role
        const newStaff = staff.filter(c => c.role !== hiringRole).concat(coach);
        set({
          staff: newStaff,
          hiringPool: [],
          hiringRole: null,
          staffBonus: calculateStaffBonus(newStaff),
        });
      },

      fireCoach: (role) => {
        const newStaff = get().staff.filter(c => c.role !== role);
        set({ staff: newStaff, staffBonus: calculateStaffBonus(newStaff) });
      },

      openHiring: (role, seed) => {
        const rng = new RandomProvider(seed ?? Date.now());
        const pool = generateHiringPool(role, 5, rng);
        set({ hiringPool: pool, hiringRole: role });
      },

      closeHiring: () => set({ hiringPool: [], hiringRole: null }),

      refreshBonus: () => {
        set({ staffBonus: calculateStaffBonus(get().staff) });
      },

      clear: () => set({ staff: [], hiringPool: [], hiringRole: null, staffBonus: DEFAULT_BONUS }),
    }),
    {
      name: 'claudeball-coaching',
      partialize: (s) => ({ staff: s.staff, staffBonus: s.staffBonus }),
    }
  )
);
