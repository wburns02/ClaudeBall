import type { DynastyMode } from './ecs/types.ts';

/** All customizable dynasty settings — every knob is tweakable */
export interface DynastySettings {
  // Mode
  mode: DynastyMode;

  // League Structure
  teamCount: number;           // 8-32
  leagueCount: number;         // 1-2
  divisionsPerLeague: number;  // 1-4
  seasonLength: number;        // 56-162
  playoffTeams: number;        // 4/8/10/12/16
  dhRule: 'al_only' | 'universal' | 'none';
  expandedRosters: boolean;
  fortyManRoster: boolean;

  // Financial
  salarySystem: 'no_cap' | 'luxury_tax' | 'soft_cap' | 'hard_cap';
  luxuryTaxThreshold: number;  // thousands
  repeaterPenalty: number;     // 1-3x
  revenueSharing: 'off' | 'light' | 'realistic' | 'heavy';
  marketSizeVariation: 'equal' | 'mild' | 'realistic' | 'extreme';
  stadiumRevenue: 'simple' | 'detailed';

  // Player Development
  agingCurve: 'slow' | 'normal' | 'harsh';
  prospectBustRate: number;    // 10-60 (percentage)
  developmentRandomness: 'low' | 'medium' | 'high';
  scoutingAccuracy: 'perfect' | 'realistic' | 'deep_fog';
  injuryFrequency: 'rare' | 'normal' | 'brutal';
  careerEndingInjuries: boolean;

  // Simulation
  tradeAIDifficulty: 'pushover' | 'fair' | 'realistic' | 'shark';
  aiTradeFrequency: 'quiet' | 'active' | 'hyperactive';
  freeAgentDemand: 'cold' | 'normal' | 'hot';
  arbitration: 'auto' | 'simplified' | 'full';
  rule5Draft: 'off' | 'auto' | 'interactive';

  // RPG (Living only)
  personalFinanceComplexity: 'simple' | 'full';
  relationshipDepth: 'light' | 'deep';
  lifeEventFrequency: 'rare' | 'normal' | 'chaotic';
  voiceCalls: 'off' | 'browser_tts' | 'elevenlabs';
  apiBudgetCentsPerMonth: number;
  notificationStyle: 'inbox_only' | 'inbox_texts' | 'full';

  // Owner
  ownerPatience: 'infinite' | 'patient' | 'moderate' | 'win_now';
  fireRisk: boolean;
}

export type DynastyPreset = 'casual' | 'realistic' | 'hardcore' | 'sandbox';

const BASE_SETTINGS: Omit<DynastySettings, 'mode'> = {
  teamCount: 30, leagueCount: 2, divisionsPerLeague: 3, seasonLength: 162,
  playoffTeams: 12, dhRule: 'universal', expandedRosters: true, fortyManRoster: true,
  salarySystem: 'luxury_tax', luxuryTaxThreshold: 230000, repeaterPenalty: 1,
  revenueSharing: 'realistic', marketSizeVariation: 'realistic', stadiumRevenue: 'simple',
  agingCurve: 'normal', prospectBustRate: 35, developmentRandomness: 'medium',
  scoutingAccuracy: 'realistic', injuryFrequency: 'normal', careerEndingInjuries: true,
  tradeAIDifficulty: 'realistic', aiTradeFrequency: 'active', freeAgentDemand: 'normal',
  arbitration: 'simplified', rule5Draft: 'auto',
  personalFinanceComplexity: 'full', relationshipDepth: 'deep', lifeEventFrequency: 'normal',
  voiceCalls: 'off', apiBudgetCentsPerMonth: 500, notificationStyle: 'inbox_texts',
  ownerPatience: 'moderate', fireRisk: true,
};

export const PRESETS: Record<DynastyPreset, Partial<DynastySettings>> = {
  casual: {
    seasonLength: 56, teamCount: 16, salarySystem: 'no_cap',
    injuryFrequency: 'rare', prospectBustRate: 15, tradeAIDifficulty: 'pushover',
    agingCurve: 'slow', ownerPatience: 'infinite', fireRisk: false,
  },
  realistic: {
    // BASE_SETTINGS is already realistic
  },
  hardcore: {
    salarySystem: 'hard_cap', injuryFrequency: 'brutal', prospectBustRate: 50,
    tradeAIDifficulty: 'shark', agingCurve: 'harsh', ownerPatience: 'win_now',
    fireRisk: true, scoutingAccuracy: 'deep_fog',
  },
  sandbox: {
    salarySystem: 'no_cap', injuryFrequency: 'rare', prospectBustRate: 0,
    tradeAIDifficulty: 'fair', ownerPatience: 'infinite', fireRisk: false,
    scoutingAccuracy: 'perfect', careerEndingInjuries: false,
  },
};

/** Create settings from a preset, with optional overrides */
export function createSettings(mode: DynastyMode, preset: DynastyPreset = 'realistic', overrides: Partial<DynastySettings> = {}): DynastySettings {
  return { ...BASE_SETTINGS, mode, ...PRESETS[preset], ...overrides };
}

/** Character creation archetype for Living Dynasty */
export interface CharacterArchetype {
  id: string;
  label: string;
  traitEffects: Partial<Record<string, { min: number; max?: number }>>;
}

export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  { id: 'grinder', label: 'Grinder', traitEffects: { workEthic: { min: 70 }, coachability: { min: 65 } } },
  { id: 'natural_leader', label: 'Natural Leader', traitEffects: { leadership: { min: 75 }, charisma: { min: 60 } } },
  { id: 'big_ego', label: 'Big Ego', traitEffects: { ego: { min: 75 }, composure: { min: 20, max: 50 } } },
  { id: 'clutch_gene', label: 'Clutch Gene', traitEffects: { composure: { min: 75 }, integrity: { min: 60 } } },
  { id: 'baseball_nerd', label: 'Baseball Nerd', traitEffects: { baseballIQ: { min: 80 }, charisma: { min: 20, max: 40 } } },
  { id: 'fan_favorite', label: 'Fan Favorite', traitEffects: { charisma: { min: 70 }, loyalty: { min: 65 } } },
  { id: 'risk_taker', label: 'Risk Taker', traitEffects: { aggression: { min: 70 }, integrity: { min: 20, max: 45 } } },
  { id: 'loyal_soldier', label: 'Loyal Soldier', traitEffects: { loyalty: { min: 80 }, ego: { min: 20, max: 35 } } },
  { id: 'hothead', label: 'Hothead', traitEffects: { aggression: { min: 80 }, composure: { min: 20, max: 35 } } },
  { id: 'smooth_operator', label: 'Smooth Operator', traitEffects: { charisma: { min: 75 }, coachability: { min: 50 } } },
];

export type PlayerBackground = 'college_star' | 'late_round' | 'undrafted' | 'international';

export interface CharacterCreation {
  name: string;
  background: PlayerBackground;
  archetypes: string[]; // 3 archetype IDs
  position: string;
}
