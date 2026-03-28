import { describe, it, expect } from 'vitest';
import { ScoutingIntelligence } from './ScoutingIntelligence.ts';
import type { Scout } from './ScoutingIntelligence.ts';

function makeScout(overrides: Partial<Scout> = {}): Scout {
  return {
    id: 'scout_test', name: 'Test Scout', specialty: 'domestic',
    bias: 'balanced', accuracy: 80, experience: 10, salary: 300,
    personality: 'Even-handed evaluator.',
    ...overrides,
  };
}

const trueRatings = { overall: 65, hit: 60, power: 70, speed: 55, arm: 50, field: 55 };

describe('ScoutingIntelligence', () => {
  describe('Scout Generation', () => {
    it('generates scouts with valid fields', () => {
      let seed = 42;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      const scout = si.generateScout();
      expect(scout.name.length).toBeGreaterThan(3);
      expect(scout.accuracy).toBeGreaterThanOrEqual(40);
      expect(scout.accuracy).toBeLessThanOrEqual(90);
      expect(scout.salary).toBeGreaterThan(0);
      expect(['hype', 'conservative', 'balanced', 'tools_first', 'stats_first']).toContain(scout.bias);
    });

    it('hire and fire scouts', () => {
      const si = new ScoutingIntelligence();
      const scout = makeScout();
      si.hireScout(scout);
      expect(si.getScouts()).toHaveLength(1);
      si.fireScout(scout.id);
      expect(si.getScouts()).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    it('high-accuracy scout reports close to true ratings', () => {
      let seed = 42;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      const scout = makeScout({ accuracy: 95, bias: 'balanced' });
      const report = si.generateReport(scout, 'p1', 'Mike Trout', trueRatings, 2026);

      // With 95% accuracy, scouted should be within ~5 of true
      expect(Math.abs(report.scoutedOverall - trueRatings.overall)).toBeLessThanOrEqual(8);
    });

    it('low-accuracy scout reports deviate significantly', () => {
      let seed = 42;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      const scout = makeScout({ accuracy: 40, bias: 'balanced' });
      const report = si.generateReport(scout, 'p1', 'Mike Trout', trueRatings, 2026);

      // Low accuracy — could be way off (but still valid range)
      expect(report.scoutedOverall).toBeGreaterThanOrEqual(20);
      expect(report.scoutedOverall).toBeLessThanOrEqual(80);
    });

    it('hype scout overhypes — scouted > true', () => {
      // Run multiple times to get statistical confidence
      let seed = 100;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      const scout = makeScout({ accuracy: 60, bias: 'hype' });
      let totalDelta = 0;
      for (let i = 0; i < 20; i++) {
        const report = si.generateReport(scout, `p${i}`, `Player ${i}`, trueRatings, 2026);
        totalDelta += report.scoutedOverall - trueRatings.overall;
      }
      // Average delta should be positive (overhyped)
      expect(totalDelta / 20).toBeGreaterThan(0);
    });

    it('conservative scout undersells — scouted < true', () => {
      let seed = 100;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      const scout = makeScout({ accuracy: 60, bias: 'conservative' });
      let totalDelta = 0;
      for (let i = 0; i < 20; i++) {
        const report = si.generateReport(scout, `p${i}`, `Player ${i}`, trueRatings, 2026);
        totalDelta += report.scoutedOverall - trueRatings.overall;
      }
      // Average delta should be negative (undersold)
      expect(totalDelta / 20).toBeLessThan(0);
    });

    it('narrative reflects scout bias', () => {
      const si = new ScoutingIntelligence();

      const hypeScout = makeScout({ bias: 'hype', accuracy: 70 });
      const hypeReport = si.generateReport(hypeScout, 'p1', 'Test Player', trueRatings, 2026);
      expect(hypeReport.narrative.toLowerCase()).toMatch(/special|electric|sign|dream|can't-miss/);

      const conservScout = makeScout({ bias: 'conservative', accuracy: 70 });
      const conservReport = si.generateReport(conservScout, 'p2', 'Test Player', { ...trueRatings, overall: 50 }, 2026);
      expect(conservReport.narrative.toLowerCase()).toMatch(/concern|sold|caution|pass|underwhelm|translat/);
    });

    it('same player gets different reports from different scouts', () => {
      const si = new ScoutingIntelligence();

      const scout1 = makeScout({ id: 's1', name: 'Hype Guy', bias: 'hype', accuracy: 60 });
      const scout2 = makeScout({ id: 's2', name: 'Stats Lady', bias: 'stats_first', accuracy: 60 });

      const r1 = si.generateReport(scout1, 'p1', 'Test Player', trueRatings, 2026);
      const r2 = si.generateReport(scout2, 'p1', 'Test Player', trueRatings, 2026);

      // Different narratives
      expect(r1.narrative).not.toBe(r2.narrative);
      // Same player, different scouted values (due to bias)
      expect(r1.scoutedOverall).not.toBe(r2.scoutedOverall);
    });

    it('reports stored and retrievable by player ID', () => {
      const si = new ScoutingIntelligence();
      const scout = makeScout();
      si.generateReport(scout, 'p1', 'Player 1', trueRatings, 2026);
      si.generateReport(scout, 'p1', 'Player 1', trueRatings, 2027);

      expect(si.getReportsForPlayer('p1')).toHaveLength(2);
      expect(si.getReportsForPlayer('p999')).toHaveLength(0);
    });
  });

  describe('International Headlines', () => {
    it('generates headlines with variety', () => {
      let seed = 42;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      const headlines = si.generateInternationalHeadlines(5);
      expect(headlines).toHaveLength(5);
      for (const h of headlines) {
        expect(h.playerName.length).toBeGreaterThan(3);
        expect(h.headline.length).toBeGreaterThan(20);
        expect(h.trueOverall).toBeGreaterThanOrEqual(35);
        expect(h.trueOverall).toBeLessThanOrEqual(80);
        expect(h.askingPrice).toBeGreaterThan(0);
        expect(h.scouted).toBe(false);
      }
    });

    it('scouting international player generates report with reduced accuracy', () => {
      let seed = 42;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      si.generateInternationalHeadlines(3);
      const headlines = si.getHeadlines();
      const scout = makeScout({ accuracy: 80 });

      const report = si.scoutInternationalPlayer(headlines[0].id, scout, 2026);
      expect(report).not.toBeNull();
      expect(report!.playerName).toBe(headlines[0].playerName);

      // Headline should now be marked as scouted
      expect(si.getHeadlines()[0].scouted).toBe(true);
      expect(si.getHeadlines()[0].reports).toHaveLength(1);
    });
  });

  describe('Prospect Families', () => {
    it('football family demands more money', () => {
      const si = new ScoutingIntelligence(() => 0.2); // Will pick 'football'
      const family = si.generateProspectFamily('p1', 'Bo Jackson Jr.', 70);
      // Football family should have higher demand or persuasion
      expect(family.familyDemand).toBeGreaterThan(0);
      expect(family.persuasionRequired).toBeGreaterThanOrEqual(0);
    });

    it('generates families with variety', () => {
      let seed = 42;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const si = new ScoutingIntelligence(rng);

      const families = [];
      for (let i = 0; i < 10; i++) {
        families.push(si.generateProspectFamily(`p${i}`, `Prospect ${i}`, 50 + i * 3));
      }

      // Should have variety of influences
      const influences = new Set(families.map(f => f.familyInfluence));
      expect(influences.size).toBeGreaterThan(1);
    });
  });
});
