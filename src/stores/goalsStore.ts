import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Goal types ────────────────────────────────────────────────────────────────

export type GoalType =
  | 'SEASON_WINS'
  | 'PLAYOFF_BERTH'
  | 'DIVISION_TITLE'
  | 'AVOID_LAST'
  | 'TEAM_ERA'
  | 'TEAM_BA'
  | 'WIN_SERIES'
  | 'DEVELOP_PROSPECT';

export type GoalPriority = 'primary' | 'secondary' | 'bonus';
export type OwnerPersonality = 'COMPETITOR' | 'DEVELOPER' | 'FINANCIER' | 'LEGACY';

export interface SeasonGoal {
  id: string;
  type: GoalType;
  description: string;
  detail: string;
  target: number;
  current: number;
  met: boolean;
  failed: boolean;
  priority: GoalPriority;
  icon: string;
  reward: string;
  penalty: string;
}

export interface FranchiseOwner {
  name: string;
  personality: OwnerPersonality;
  patience: number;   // 0–100
  confidence: number; // 0–100, how happy they are right now
}

export interface GoalHistoryEntry {
  year: number;
  goals: SeasonGoal[];
  ownerGrade: string; // A+, A, B, C, D, F
  ownerNote: string;
}

interface GoalsState {
  currentYear: number;
  goals: SeasonGoal[];
  owner: FranchiseOwner | null;
  history: GoalHistoryEntry[];
}

interface GoalsActions {
  /** Generate goals for a new season. Call at season start. */
  initSeason: (params: {
    year: number;
    teamCity: string;
    teamName: string;
    lastSeasonWins: number;
    lastSeasonLosses: number;
    divisionRank: number;
    totalTeamsInDiv: number;
  }) => void;

  /** Update goal progress from current standings & stats. */
  updateProgress: (params: {
    currentWins: number;
    currentLosses: number;
    gamesPlayed: number;
    totalGames: number;
    inPlayoffs: boolean;
    wonDivision: boolean;
    divisionRank: number;
    totalTeamsInDiv: number;
    teamERA: number;
    teamBA: number;
    currentStreak: number;
    maxStreak: number;
    topProspectOvr: number;
  }) => void;

  /** Finalize goals at season end and save to history. */
  finalizeSeasonGoals: (year: number) => void;

  /** Reset for new franchise. */
  reset: () => void;
}

// ── Owner name pools ──────────────────────────────────────────────────────────

const OWNER_NAMES = [
  'Robert Harrington', 'Patricia Goldstein', 'James Moorefield',
  'Sandra Vickers', 'William Chen', 'Margaret Sullivan',
  'Charles Abernathy', 'Dorothy Blackwood', 'George Fitzgerald',
  'Helen Ashford', 'Edward Cromwell', 'Frances Kimball',
  'Thomas Delacroix', 'Beverly Tanaka', 'Arthur Pemberton',
];

const PERSONALITY_LABELS: Record<OwnerPersonality, string> = {
  COMPETITOR: 'Win-Now',
  DEVELOPER:  'Build Through Draft',
  FINANCIER:  'Fiscally Conservative',
  LEGACY:     'Dynasty Builder',
};

// ── Goal generation helpers ───────────────────────────────────────────────────

function pickOwner(teamCity: string): FranchiseOwner {
  // Deterministic based on team city hash
  const hash = teamCity.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const name = OWNER_NAMES[hash % OWNER_NAMES.length]!;
  const personalities: OwnerPersonality[] = ['COMPETITOR', 'DEVELOPER', 'FINANCIER', 'LEGACY'];
  const personality = personalities[(hash >> 2) % personalities.length]!;
  return { name, personality, patience: 40 + (hash % 40), confidence: 65 };
}

function generateGoals(params: Parameters<GoalsActions['initSeason']>[0], owner: FranchiseOwner): SeasonGoal[] {
  const { lastSeasonWins, lastSeasonLosses, divisionRank, totalTeamsInDiv } = params;
  const winPct = lastSeasonWins / Math.max(1, lastSeasonWins + lastSeasonLosses);
  const goals: SeasonGoal[] = [];

  // ── Primary goal ────────────────────────────────────────────────────────────
  if (owner.personality === 'COMPETITOR' || lastSeasonWins >= 82) {
    // Expect playoffs
    goals.push({
      id: 'primary',
      type: 'PLAYOFF_BERTH',
      description: 'Make the Playoffs',
      detail: 'Finish in a playoff position at season end.',
      target: 1,
      current: 0,
      met: false,
      failed: false,
      priority: 'primary',
      icon: '🏆',
      reward: '+$8M payroll budget next season',
      penalty: 'Owner confidence -25, budget reduced',
    });
  } else if (owner.personality === 'DEVELOPER') {
    const winTarget = Math.max(62, Math.round(lastSeasonWins * 0.9) + 5);
    goals.push({
      id: 'primary',
      type: 'SEASON_WINS',
      description: `Win ${winTarget}+ Games`,
      detail: `Reach at least ${winTarget} wins this season while developing young talent.`,
      target: winTarget,
      current: 0,
      met: false,
      failed: false,
      priority: 'primary',
      icon: '⭐',
      reward: '+$3M development budget, expanded scouting',
      penalty: 'Owner patience reduced',
    });
  } else {
    // Standard win target: improve on last season
    const winTarget = Math.min(95, Math.max(72, Math.round(lastSeasonWins * 1.05) + 3));
    goals.push({
      id: 'primary',
      type: 'SEASON_WINS',
      description: `Win ${winTarget}+ Games`,
      detail: `Prove the franchise is moving in the right direction with ${winTarget}+ wins.`,
      target: winTarget,
      current: 0,
      met: false,
      failed: false,
      priority: 'primary',
      icon: '⭐',
      reward: '+$5M payroll budget next season',
      penalty: 'Owner places franchise on notice',
    });
  }

  // ── Secondary goal ───────────────────────────────────────────────────────────
  if (divisionRank === 1 || winPct >= 0.556) {
    // Already good team — push for division title
    goals.push({
      id: 'secondary',
      type: 'DIVISION_TITLE',
      description: 'Win the Division',
      detail: 'Finish #1 in your division at the end of the regular season.',
      target: 1,
      current: 0,
      met: false,
      failed: false,
      priority: 'secondary',
      icon: '🥇',
      reward: '+$5M luxury budget, fan confidence +30',
      penalty: 'Off-season roster evaluation',
    });
  } else if (winPct < 0.4) {
    // Struggling team — avoid last place
    goals.push({
      id: 'secondary',
      type: 'AVOID_LAST',
      description: `Avoid Last Place`,
      detail: `Don't finish last in your division. Beat at least one team in the standings.`,
      target: totalTeamsInDiv,
      current: 0,
      met: false,
      failed: false,
      priority: 'secondary',
      icon: '🛡️',
      reward: 'Owner remains patient, +$2M rebuild budget',
      penalty: 'Management review — job security at risk',
    });
  } else {
    // Middle-of-pack — target ERA improvement
    goals.push({
      id: 'secondary',
      type: 'TEAM_ERA',
      description: 'Finish with ERA Under 4.20',
      detail: 'Build pitching depth to keep team ERA below 4.20 at season end.',
      target: 420,
      current: 500,
      met: false,
      failed: false,
      priority: 'secondary',
      icon: '⚾',
      reward: 'Priority pitching in next draft, +$2M',
      penalty: 'No additional pitching investment',
    });
  }

  // ── Bonus goal ───────────────────────────────────────────────────────────────
  if (owner.personality === 'DEVELOPER') {
    goals.push({
      id: 'bonus',
      type: 'DEVELOP_PROSPECT',
      description: 'Develop a Top Prospect',
      detail: 'Have your best minor-league prospect reach at least 65 OVR by season end.',
      target: 65,
      current: 0,
      met: false,
      failed: false,
      priority: 'bonus',
      icon: '🌟',
      reward: '+$4M development budget, scout upgrade',
      penalty: 'None — owner appreciates effort',
    });
  } else {
    goals.push({
      id: 'bonus',
      type: 'WIN_SERIES',
      description: 'Win 5 Consecutive Games',
      detail: 'Put together a winning streak of 5 or more games to build momentum.',
      target: 5,
      current: 0,
      met: false,
      failed: false,
      priority: 'bonus',
      icon: '🔥',
      reward: '+$1M bonus player acquisition fund',
      penalty: 'None',
    });
  }

  return goals;
}

function computeConfidence(goals: SeasonGoal[], owner: FranchiseOwner, gamesPlayed: number, totalGames: number): number {
  if (gamesPlayed === 0) return owner.confidence;
  const seasonPct = gamesPlayed / totalGames;
  let conf = owner.confidence;
  for (const g of goals) {
    const progress = Math.min(1, g.current / Math.max(1, g.target));
    const weight = g.priority === 'primary' ? 25 : g.priority === 'secondary' ? 15 : 8;
    if (g.met) conf += weight * 0.4;
    else if (g.failed) conf -= weight * 0.3;
    else {
      // Partial progress relative to season progress
      const delta = progress - seasonPct;
      conf += delta * weight * 0.2;
    }
  }
  return Math.round(Math.max(0, Math.min(100, conf)));
}

function gradeFromGoals(goals: SeasonGoal[]): { grade: string; note: string } {
  const primary = goals.find(g => g.priority === 'primary');
  const secondary = goals.find(g => g.priority === 'secondary');
  const bonus = goals.find(g => g.priority === 'bonus');
  const metCount = goals.filter(g => g.met).length;

  if (metCount === 3) return { grade: 'A+', note: 'Outstanding. Every goal surpassed — a legendary season.' };
  if (primary?.met && secondary?.met) return { grade: 'A', note: 'Excellent work. All key objectives achieved.' };
  if (primary?.met && bonus?.met) return { grade: 'B+', note: 'Good season. Primary goal met with a bonus achievement.' };
  if (primary?.met) return { grade: 'B', note: 'Solid season. You delivered the most important result.' };
  if (secondary?.met && bonus?.met) return { grade: 'C+', note: 'Mixed results. Secondary wins ease the disappointment.' };
  if (secondary?.met) return { grade: 'C', note: 'Below expectations. The primary goal was not achieved.' };
  if (bonus?.met) return { grade: 'D', note: 'Disappointing season. The organization expected more.' };
  return { grade: 'F', note: 'Unacceptable. No goals were met. Your job is in jeopardy.' };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGoalsStore = create<GoalsState & GoalsActions>()(
  persist(
    (set, get) => ({
      currentYear: 2026,
      goals: [],
      owner: null,
      history: [],

      initSeason: (params) => {
        const existing = get().owner;
        const owner = existing ?? pickOwner(params.teamCity);
        const goals = generateGoals(params, owner);
        set({ currentYear: params.year, goals, owner: { ...owner, confidence: 65 } });
      },

      updateProgress: (params) => {
        const { goals, owner } = get();
        if (!goals.length || !owner) return;

        const updated = goals.map(g => {
          let current = g.current;
          let met = g.met;
          let failed = g.failed;

          switch (g.type) {
            case 'SEASON_WINS':
              current = params.currentWins;
              met = current >= g.target;
              failed = !met && params.gamesPlayed === params.totalGames;
              break;
            case 'PLAYOFF_BERTH':
              current = params.inPlayoffs ? 1 : 0;
              met = params.inPlayoffs;
              failed = !met && params.gamesPlayed >= params.totalGames;
              break;
            case 'DIVISION_TITLE':
              current = params.wonDivision ? 1 : 0;
              met = params.wonDivision;
              failed = !met && params.gamesPlayed >= params.totalGames;
              break;
            case 'AVOID_LAST':
              current = params.divisionRank;
              met = params.divisionRank < params.totalTeamsInDiv;
              failed = params.divisionRank >= params.totalTeamsInDiv && params.gamesPlayed >= params.totalGames;
              break;
            case 'TEAM_ERA':
              current = Math.round(params.teamERA * 100);
              met = params.teamERA > 0 && params.teamERA < g.target / 100;
              failed = !met && params.gamesPlayed >= params.totalGames && params.teamERA > 0;
              break;
            case 'TEAM_BA':
              current = Math.round(params.teamBA * 1000);
              met = params.teamBA > 0 && params.teamBA >= g.target / 1000;
              failed = !met && params.gamesPlayed >= params.totalGames && params.teamBA > 0;
              break;
            case 'WIN_SERIES':
              current = params.maxStreak;
              met = params.maxStreak >= g.target;
              failed = false; // never fully failed until season end
              break;
            case 'DEVELOP_PROSPECT':
              current = params.topProspectOvr;
              met = params.topProspectOvr >= g.target;
              failed = !met && params.gamesPlayed >= params.totalGames;
              break;
          }

          return { ...g, current, met, failed };
        });

        const confidence = computeConfidence(updated, owner, params.gamesPlayed, params.totalGames);
        set({ goals: updated, owner: { ...owner, confidence } });
      },

      finalizeSeasonGoals: (year) => {
        const { goals, history } = get();
        if (!goals.length) return;
        const { grade, note } = gradeFromGoals(goals);
        const entry: GoalHistoryEntry = { year, goals: [...goals], ownerGrade: grade, ownerNote: note };
        set({ history: [entry, ...history].slice(0, 10) });
      },

      reset: () => set({ currentYear: 2026, goals: [], owner: null, history: [] }),
    }),
    { name: 'claudeball-goals-v1' }
  )
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export function ownerConfidenceLabel(conf: number): { label: string; color: string } {
  if (conf >= 85) return { label: 'Thrilled', color: 'text-gold' };
  if (conf >= 70) return { label: 'Pleased', color: 'text-green-light' };
  if (conf >= 55) return { label: 'Satisfied', color: 'text-cream' };
  if (conf >= 40) return { label: 'Concerned', color: 'text-orange-400' };
  if (conf >= 25) return { label: 'Frustrated', color: 'text-red-400' };
  return { label: 'Furious', color: 'text-red-600' };
}

export function goalProgressPct(g: SeasonGoal): number {
  if (g.met) return 100;
  if (g.type === 'PLAYOFF_BERTH' || g.type === 'DIVISION_TITLE') {
    return g.current > 0 ? 100 : 0;
  }
  if (g.type === 'AVOID_LAST') {
    // current = rank; target = totalTeams (want to be LESS than target)
    return g.current < g.target ? 100 : 0;
  }
  if (g.type === 'TEAM_ERA') {
    // current & target are *100; want ERA below target/100
    // Higher ERA is worse; show progress as inversely proportional
    const maxERA = 700; // 7.00 would be terrible
    const pct = Math.round(((maxERA - g.current) / (maxERA - g.target)) * 100);
    return Math.max(0, Math.min(99, pct));
  }
  return Math.round(Math.min(99, (g.current / Math.max(1, g.target)) * 100));
}

export const PERSONALITY_LABELS_MAP = PERSONALITY_LABELS;
