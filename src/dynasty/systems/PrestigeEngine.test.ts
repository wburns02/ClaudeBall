import { describe, it, expect } from 'vitest';
import { PrestigeEngine } from './PrestigeEngine.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { createCareer } from '../components/Career.ts';
import { createReputation, adjustReputation } from '../components/Reputation.ts';
import { createRelationships, adjustAffinity } from '../components/Relationships.ts';
import { createPersonalFinances } from '../components/PersonalFinances.ts';
import type { PersonalityComponent } from '../components/Personality.ts';

function makePersonality(): PersonalityComponent {
  return {
    type: 'Personality', workEthic: 70, ego: 50, loyalty: 60, charisma: 65,
    baseballIQ: 70, composure: 60, leadership: 65, aggression: 40, coachability: 55, integrity: 70,
  };
}

describe('PrestigeEngine', () => {
  it('calculates prestige for a rookie with no history', () => {
    const em = new EntityManager();
    const engine = new PrestigeEngine(em);
    const id = em.createEntity();
    em.addComponent(id, createCareer('player', 'team1'));

    const score = engine.calculate(id);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.tier).toBe('Prospect');
    expect(score.hofProjection).toBe('no_chance');
  });

  it('MVP winner gets higher prestige than average player', () => {
    const em = new EntityManager();
    const engine = new PrestigeEngine(em);

    // Average player
    const avg = em.createEntity();
    em.addComponent(avg, createCareer('player', 'team1'));
    em.addComponent(avg, createReputation());

    // MVP winner
    const mvp = em.createEntity();
    const mvpCareer = createCareer('player', 'team1');
    mvpCareer.awards.push({ type: 'MVP', season: 2026 });
    mvpCareer.awards.push({ type: 'MVP', season: 2027 });
    em.addComponent(mvp, mvpCareer);
    em.addComponent(mvp, createReputation());

    expect(engine.calculate(mvp).total).toBeGreaterThan(engine.calculate(avg).total);
    expect(engine.calculate(mvp).milestones).toContain('2x MVP');
  });

  it('GM with good reputation scores Elite or Legend', () => {
    const em = new EntityManager();
    const engine = new PrestigeEngine(em);
    const id = em.createEntity();

    const career = createCareer('gm', 'team1');
    career.history.push({ role: 'player', teamId: 'team1', startSeason: 2026 });
    career.history.push({ role: 'scout', teamId: 'team1', startSeason: 2036 });
    career.history.push({ role: 'manager', teamId: 'team1', startSeason: 2040 });
    career.awards.push({ type: 'MVP', season: 2028 }, { type: 'MVP', season: 2030 });
    em.addComponent(id, career);

    const rep = createReputation();
    adjustReputation(rep, 'clubhouse', 70);
    adjustReputation(rep, 'media', 60);
    adjustReputation(rep, 'fan', 80);
    em.addComponent(id, rep);

    const rels = createRelationships();
    for (let i = 0; i < 12; i++) {
      adjustAffinity(rels, `friend_${i}`, 30, 'friendship', 2026);
    }
    em.addComponent(id, rels);

    const pf = createPersonalFinances(25000);
    pf.netWorth = 120000;
    em.addComponent(id, pf);

    const score = engine.calculate(id);
    expect(score.total).toBeGreaterThanOrEqual(55);
    expect(['Elite', 'Legend', 'All-Star']).toContain(score.tier);
    expect(score.milestones.length).toBeGreaterThan(3);
  });

  it('wealthy owner gets max wealth score', () => {
    const em = new EntityManager();
    const engine = new PrestigeEngine(em);
    const id = em.createEntity();
    em.addComponent(id, createCareer('owner', 'team1'));
    const pf = createPersonalFinances(50000);
    pf.netWorth = 600000;
    em.addComponent(id, pf);

    const score = engine.calculate(id);
    expect(score.breakdown.wealth).toBe(10);
    expect(score.milestones).toContain('Mogul ($500M+)');
  });

  it('HOF projection scales with achievements', () => {
    const em = new EntityManager();
    const engine = new PrestigeEngine(em);

    // No awards
    const nobody = em.createEntity();
    em.addComponent(nobody, createCareer('player', 'team1'));
    expect(engine.calculate(nobody).hofProjection).toBe('no_chance');

    // 3 MVPs + long career
    const legend = em.createEntity();
    const legendCareer = createCareer('gm', 'team1');
    legendCareer.awards.push(
      { type: 'MVP', season: 2026 }, { type: 'MVP', season: 2028 }, { type: 'MVP', season: 2030 }
    );
    legendCareer.history = Array.from({ length: 15 }, (_, i) => ({ role: 'player' as const, teamId: 'team1', startSeason: 2026 + i }));
    em.addComponent(legend, legendCareer);

    const legendScore = engine.calculate(legend);
    expect(['first_ballot', 'likely']).toContain(legendScore.hofProjection);
  });
});
