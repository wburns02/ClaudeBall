import { describe, it, expect, vi } from 'vitest';
import { FinanceSystem } from './FinanceSystem.ts';
import { PersonalFinanceSystem } from './PersonalFinanceSystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import { createTeamFinances } from '../components/TeamFinances.ts';
import { createPersonalFinances, processAnnualFinances } from '../components/PersonalFinances.ts';
import type { TeamFinancesComponent } from '../components/TeamFinances.ts';
import type { PersonalFinancesComponent } from '../components/PersonalFinances.ts';
import type { ContractSignedEvent, SeasonPhaseChangedEvent } from '../ecs/types.ts';

describe('TeamFinances component', () => {
  it('creates with market-size appropriate revenue', () => {
    const small = createTeamFinances(100000, 'small');
    const large = createTeamFinances(200000, 'large');
    expect(small.revenue).toBeLessThan(large.revenue);
    expect(small.marketSize).toBe('small');
  });
});

describe('PersonalFinances component', () => {
  it('processes annual finances — salary in, expenses out', () => {
    const pf = createPersonalFinances(5000); // $5M salary
    pf.lifestyleTier = 'comfortable'; // $500K expenses
    pf.agentFeePct = 5;

    const result = processAnnualFinances(pf);

    // $5M salary - 5% agent ($250K) - $500K expenses = $4.25M net
    expect(result.netChange).toBeCloseTo(4250, 0);
    expect(pf.bankAccount).toBeCloseTo(4300, 0); // started with 50
    expect(result.isBankrupt).toBe(false);
  });

  it('detects bankruptcy when expenses exceed income', () => {
    const pf = createPersonalFinances(700); // $700K salary (league minimum)
    pf.lifestyleTier = 'extravagant'; // $8M expenses!
    pf.bankAccount = 0;

    const result = processAnnualFinances(pf);
    expect(result.netChange).toBeLessThan(0);
    expect(result.isBankrupt).toBe(true);
  });

  it('tracks investment returns', () => {
    const pf = createPersonalFinances(5000);
    pf.investments = [{
      id: 'inv1', name: 'Rental Property', type: 'real_estate',
      investedAmount: 1000, currentValue: 1000, annualReturn: 10, risk: 'low',
    }];

    processAnnualFinances(pf);

    expect(pf.investments[0].currentValue).toBeCloseTo(1100, 0); // 10% return
    expect(pf.netWorth).toBeGreaterThan(pf.bankAccount); // includes investment value
  });

  it('tracks career earnings', () => {
    const pf = createPersonalFinances(10000);
    pf.endorsementIncome = 2000;

    processAnnualFinances(pf);
    expect(pf.careerEarnings).toBe(12000); // salary + endorsements
  });
});

describe('FinanceSystem', () => {
  it('updates payroll on ContractSigned', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');
    const sys = new FinanceSystem(em, bus);
    runner.addSystem(sys);

    // Create team entity with finances
    const teamEntity = em.createEntity();
    em.addComponent(teamEntity, createTeamFinances(150000, 'medium'));

    bus.emit({
      type: 'ContractSigned', timestamp: 1,
      data: { playerId: 'p1', teamId: 't1', years: 3, salary: 5000 },
    } as ContractSignedEvent);

    const finances = em.getComponent<TeamFinancesComponent>(teamEntity, 'TeamFinances')!;
    expect(finances.payroll).toBe(5000);
  });

  it('calculates luxury tax when payroll exceeds threshold', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');
    const sys = new FinanceSystem(em, bus);
    runner.addSystem(sys);

    const teamEntity = em.createEntity();
    const finances = createTeamFinances(250000, 'large');
    finances.luxuryTaxThreshold = 230000;
    em.addComponent(teamEntity, finances);

    // Sign a player that puts payroll over threshold
    bus.emit({
      type: 'ContractSigned', timestamp: 1,
      data: { playerId: 'p1', teamId: 't1', years: 1, salary: 240000 },
    } as ContractSignedEvent);

    const updated = em.getComponent<TeamFinancesComponent>(teamEntity, 'TeamFinances')!;
    expect(updated.luxuryTaxPaid).toBeGreaterThan(0);
    expect(updated.luxuryTaxPaid).toBe(Math.round(10000 * 0.20)); // $10M over × 20%
  });
});

describe('PersonalFinanceSystem', () => {
  it('processes finances on offseason transition (living mode only)', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'living');
    const sys = new PersonalFinanceSystem(em, bus);
    runner.addSystem(sys);

    const playerEntity = em.createEntity();
    const pf = createPersonalFinances(10000);
    em.addComponent(playerEntity, pf);

    bus.emit({
      type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    const updated = em.getComponent<PersonalFinancesComponent>(playerEntity, 'PersonalFinances')!;
    expect(updated.careerEarnings).toBe(10000);
    expect(updated.bankAccount).toBeGreaterThan(50); // Started with 50, added salary minus expenses
  });

  it('emits bankruptcy event when broke', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'living');
    const sys = new PersonalFinanceSystem(em, bus);
    runner.addSystem(sys);

    const handler = vi.fn();
    bus.on('FinancialEvent', handler);

    const playerEntity = em.createEntity();
    const pf = createPersonalFinances(700);
    pf.lifestyleTier = 'extravagant';
    pf.bankAccount = 0;
    em.addComponent(playerEntity, pf);

    bus.emit({
      type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.category).toBe('bankruptcy');
  });

  it('is NOT active in classic mode', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic'); // Classic mode
    const sys = new PersonalFinanceSystem(em, bus);
    runner.addSystem(sys);

    const playerEntity = em.createEntity();
    em.addComponent(playerEntity, createPersonalFinances(10000));

    // Fire offseason event — should NOT process because classic mode
    bus.emit({
      type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    const pf = em.getComponent<PersonalFinancesComponent>(playerEntity, 'PersonalFinances')!;
    expect(pf.careerEarnings).toBe(0); // Not processed
  });
});
