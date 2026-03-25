import type { Component } from '../ecs/types.ts';

export type SalarySystem = 'no_cap' | 'luxury_tax' | 'soft_cap' | 'hard_cap';

export interface TeamFinancesComponent extends Component {
  type: 'TeamFinances';
  budget: number;              // Annual budget in thousands (e.g. 150000 = $150M)
  payroll: number;             // Current total payroll in thousands
  revenue: number;             // Annual revenue in thousands
  ticketRevenue: number;
  tvRevenue: number;
  merchRevenue: number;
  postseasonBonus: number;
  luxuryTaxPaid: number;
  luxuryTaxThreshold: number;
  revenueShareReceived: number;
  revenueSharePaid: number;
  marketSize: 'small' | 'medium' | 'large';
}

export function createTeamFinances(budget = 150000, marketSize: 'small' | 'medium' | 'large' = 'medium'): TeamFinancesComponent {
  const revenueByMarket = { small: 180000, medium: 250000, large: 350000 };
  return {
    type: 'TeamFinances',
    budget,
    payroll: 0,
    revenue: revenueByMarket[marketSize],
    ticketRevenue: revenueByMarket[marketSize] * 0.35,
    tvRevenue: revenueByMarket[marketSize] * 0.40,
    merchRevenue: revenueByMarket[marketSize] * 0.15,
    postseasonBonus: 0,
    luxuryTaxPaid: 0,
    luxuryTaxThreshold: 230000,
    revenueShareReceived: 0,
    revenueSharePaid: 0,
    marketSize,
  };
}
