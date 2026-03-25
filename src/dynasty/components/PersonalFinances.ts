import type { Component } from '../ecs/types.ts';

export type LifestyleTier = 'modest' | 'comfortable' | 'lavish' | 'extravagant';

export interface Investment {
  id: string;
  name: string;
  type: 'real_estate' | 'business' | 'stocks' | 'startup';
  investedAmount: number;       // thousands
  currentValue: number;         // thousands
  annualReturn: number;         // percentage (-20 to +30)
  risk: 'low' | 'medium' | 'high';
}

export interface PersonalFinancesComponent extends Component {
  type: 'PersonalFinances';
  bankAccount: number;          // thousands
  annualSalary: number;         // thousands
  endorsementIncome: number;    // thousands per year
  lifestyleTier: LifestyleTier;
  annualExpenses: number;       // thousands
  agentFeePct: number;          // 4-10%
  investments: Investment[];
  netWorth: number;             // thousands (computed)
  careerEarnings: number;       // thousands (cumulative)
}

const LIFESTYLE_COSTS: Record<LifestyleTier, number> = {
  modest: 150,         // $150K/year
  comfortable: 500,    // $500K/year
  lavish: 2000,        // $2M/year
  extravagant: 8000,   // $8M/year
};

export function createPersonalFinances(salary = 700): PersonalFinancesComponent {
  return {
    type: 'PersonalFinances',
    bankAccount: 50,
    annualSalary: salary,
    endorsementIncome: 0,
    lifestyleTier: 'modest',
    annualExpenses: LIFESTYLE_COSTS.modest,
    agentFeePct: 5,
    investments: [],
    netWorth: 50,
    careerEarnings: 0,
  };
}

/** Process one year of finances — salary in, expenses out, investment returns */
export function processAnnualFinances(pf: PersonalFinancesComponent): { netChange: number; isBankrupt: boolean } {
  const grossIncome = pf.annualSalary + pf.endorsementIncome;
  const agentFees = grossIncome * (pf.agentFeePct / 100);
  const expenses = LIFESTYLE_COSTS[pf.lifestyleTier];
  pf.annualExpenses = expenses;

  // Investment returns
  let investmentIncome = 0;
  for (const inv of pf.investments) {
    const returnAmt = inv.currentValue * (inv.annualReturn / 100);
    inv.currentValue = Math.max(0, inv.currentValue + returnAmt);
    investmentIncome += returnAmt;
  }

  const netChange = grossIncome - agentFees - expenses + investmentIncome;
  pf.bankAccount += netChange;
  pf.careerEarnings += grossIncome;

  // Recalculate net worth
  const investmentTotal = pf.investments.reduce((sum, inv) => sum + inv.currentValue, 0);
  pf.netWorth = pf.bankAccount + investmentTotal;

  const isBankrupt = pf.bankAccount < -500; // $500K in debt

  return { netChange, isBankrupt };
}
