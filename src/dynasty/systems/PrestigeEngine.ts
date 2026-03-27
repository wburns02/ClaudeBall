import type { EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { CareerComponent } from '../components/Career.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PersonalFinancesComponent } from '../components/PersonalFinances.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';

export interface PrestigeScore {
  total: number;           // 0-100 overall legacy score
  breakdown: {
    career: number;        // 0-25 — roles held, years active, promotions
    achievements: number;  // 0-25 — awards, milestones, championships
    reputation: number;    // 0-25 — avg of 3 rep meters
    relationships: number; // 0-15 — positive relationships count
    wealth: number;        // 0-10 — net worth tier
  };
  tier: PrestigeTier;
  hofProjection: 'first_ballot' | 'likely' | 'borderline' | 'unlikely' | 'no_chance';
  milestones: string[];
}

export type PrestigeTier = 'Legend' | 'Elite' | 'All-Star' | 'Solid Pro' | 'Journeyman' | 'Prospect';

const TIER_THRESHOLDS: [number, PrestigeTier][] = [
  [85, 'Legend'],
  [70, 'Elite'],
  [55, 'All-Star'],
  [40, 'Solid Pro'],
  [20, 'Journeyman'],
  [0, 'Prospect'],
];

/**
 * Calculates a legacy/prestige score from an entity's career history,
 * achievements, reputation, relationships, and wealth.
 */
export class PrestigeEngine {
  private entities: EntityManager;
  constructor(entities: EntityManager) {
    this.entities = entities;
  }

  /** Calculate prestige score for an entity */
  calculate(entityId: EntityId): PrestigeScore {
    const career = this.entities.getComponent<CareerComponent>(entityId, 'Career');
    const reputation = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    const personality = this.entities.getComponent<PersonalityComponent>(entityId, 'Personality');
    const finances = this.entities.getComponent<PersonalFinancesComponent>(entityId, 'PersonalFinances');
    const relationships = this.entities.getComponent<RelationshipsComponent>(entityId, 'Relationships');

    const milestones: string[] = [];

    // --- Career Score (0-25) ---
    let careerScore = 0;
    if (career) {
      // Roles held — higher roles = more points
      const rolePoints: Record<string, number> = {
        player: 3, scout: 4, coach: 5, manager: 7, assistant_gm: 8,
        gm: 12, president: 15, owner: 20, broadcaster: 5,
      };
      const highestRole = career.history.reduce((best, entry) => {
        const pts = rolePoints[entry.role] ?? 0;
        return pts > (rolePoints[best] ?? 0) ? entry.role : best;
      }, career.currentRole);
      careerScore += Math.min(15, rolePoints[highestRole] ?? 0);

      // Career longevity — years active
      const years = career.history.length + 1;
      careerScore += Math.min(5, years);

      // Awards bonus
      careerScore += Math.min(5, career.awards.length * 2);

      if (career.currentRole === 'gm' || career.currentRole === 'president') milestones.push('Reached the front office');
      if (career.currentRole === 'owner') milestones.push('Team owner');
      if (career.awards.length >= 3) milestones.push(`${career.awards.length} career awards`);
    }
    careerScore = Math.min(25, careerScore);

    // --- Achievements Score (0-25) ---
    let achievementScore = 0;
    if (career) {
      achievementScore += Math.min(10, career.achievements.length * 2);
      // Awards are big
      const mvps = career.awards.filter(a => a.type === 'MVP').length;
      const cyYoungs = career.awards.filter(a => a.type === 'CyYoung').length;
      achievementScore += mvps * 5;
      achievementScore += cyYoungs * 5;
      if (mvps >= 1) milestones.push(`${mvps}x MVP`);
      if (cyYoungs >= 1) milestones.push(`${cyYoungs}x Cy Young`);
    }
    achievementScore = Math.min(25, achievementScore);

    // --- Reputation Score (0-25) ---
    let repScore = 0;
    if (reputation) {
      const avg = (reputation.clubhouse + reputation.media + reputation.fan) / 3;
      // Map from -100..+100 to 0..25
      repScore = Math.round(((avg + 100) / 200) * 25);
      if (reputation.fan >= 60) milestones.push('Fan favorite');
      if (reputation.media >= 60) milestones.push('Media darling');
      if (reputation.clubhouse >= 60) milestones.push('Clubhouse leader');
      if (avg >= 50) milestones.push('Universally respected');
    }
    repScore = Math.min(25, repScore);

    // --- Relationships Score (0-15) ---
    let relScore = 0;
    if (relationships) {
      const bonds = Object.values(relationships.bonds);
      const positive = bonds.filter(b => b.affinity > 20).length;
      const mentors = bonds.filter(b => b.tags.includes('mentor')).length;
      relScore = Math.min(10, positive);
      relScore += Math.min(5, mentors * 2);
      if (positive >= 10) milestones.push('Wide network of allies');
      if (mentors >= 2) milestones.push('Respected mentor');
    }
    relScore = Math.min(15, relScore);

    // --- Wealth Score (0-10) ---
    let wealthScore = 0;
    if (finances) {
      if (finances.netWorth >= 500000) { wealthScore = 10; milestones.push('Mogul ($500M+)'); }
      else if (finances.netWorth >= 100000) { wealthScore = 8; milestones.push('Wealthy ($100M+)'); }
      else if (finances.netWorth >= 50000) { wealthScore = 6; milestones.push('Affluent ($50M+)'); }
      else if (finances.netWorth >= 10000) { wealthScore = 4; }
      else if (finances.netWorth >= 1000) { wealthScore = 2; }
    }

    const total = careerScore + achievementScore + repScore + relScore + wealthScore;

    // Determine tier
    const tier = TIER_THRESHOLDS.find(([threshold]) => total >= threshold)?.[1] ?? 'Prospect';

    // HOF projection based on achievement + career scores
    const hofScore = achievementScore + careerScore;
    const hofProjection = hofScore >= 40 ? 'first_ballot'
      : hofScore >= 30 ? 'likely'
      : hofScore >= 20 ? 'borderline'
      : hofScore >= 10 ? 'unlikely'
      : 'no_chance';

    if (hofProjection === 'first_ballot') milestones.push('First-ballot Hall of Famer');
    else if (hofProjection === 'likely') milestones.push('Hall of Fame candidate');

    return {
      total,
      breakdown: {
        career: careerScore,
        achievements: achievementScore,
        reputation: repScore,
        relationships: relScore,
        wealth: wealthScore,
      },
      tier,
      hofProjection,
      milestones,
    };
  }
}
