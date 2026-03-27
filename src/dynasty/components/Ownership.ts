import type { Component, EntityId } from '../ecs/types.ts';

export type OwnershipStyle = 'hands_off' | 'active' | 'maniac';
export type OwnerHat = 'owner' | 'gm' | 'manager';

export interface StaffMember {
  entityId?: EntityId;
  name: string;
  role: 'gm' | 'manager' | 'coach_hitting' | 'coach_pitching' | 'coach_bench' | 'scout';
  competence: number;  // 1-100
  salary: number;      // thousands per year
}

export interface OwnershipComponent extends Component {
  type: 'Ownership';
  teamId: string;
  purchasePrice: number;     // thousands
  franchiseValue: number;    // thousands (fluctuates)
  style: OwnershipStyle;
  hats: OwnerHat[];          // roles owner is personally filling
  staff: StaffMember[];
  revenue: {
    tickets: number;
    tv: number;
    merch: number;
    naming: number;
    postseason: number;
  };
  expenses: {
    payroll: number;
    staffSalaries: number;
    facilities: number;
    scouting: number;
    marketing: number;
  };
  yearsOwned: number;
  scandalBudget: number;     // annual investment to reduce team wildcard
}

export function createOwnership(teamId: string, price: number): OwnershipComponent {
  return {
    type: 'Ownership',
    teamId,
    purchasePrice: price,
    franchiseValue: price,
    style: 'active',
    hats: ['owner'],
    staff: [],
    revenue: { tickets: 80000, tv: 100000, merch: 30000, naming: 10000, postseason: 0 },
    expenses: { payroll: 0, staffSalaries: 8000, facilities: 5000, scouting: 3000, marketing: 2000 },
    yearsOwned: 0,
    scandalBudget: 0,
  };
}

/** Calculate annual salary savings from wearing multiple hats */
export function getHatSavings(hats: OwnerHat[]): number {
  let savings = 0;
  if (hats.includes('gm')) savings += 4000;     // $4M
  if (hats.includes('manager')) savings += 2000; // $2M
  return savings;
}

/** Get reputation penalty for current hat configuration */
export function getHatRepPenalty(hats: OwnerHat[]): { media: number; fan: number } {
  if (hats.includes('manager') && hats.includes('gm')) {
    return { media: -30, fan: -25 };
  }
  if (hats.includes('gm')) {
    return { media: -15, fan: -10 };
  }
  return { media: 0, fan: 0 };
}

/** Calculate franchise profit/loss for a season */
export function calculateProfitLoss(ownership: OwnershipComponent): number {
  const totalRevenue = Object.values(ownership.revenue).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(ownership.expenses).reduce((a, b) => a + b, 0);
  const hatSavings = getHatSavings(ownership.hats);
  return totalRevenue - totalExpenses + hatSavings - ownership.scandalBudget;
}
