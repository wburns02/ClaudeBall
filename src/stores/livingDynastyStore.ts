/**
 * Living Dynasty Store — Zustand store for the CK2-style career gameplay loop.
 *
 * Manages pre-MLB career stages (little league through minors) where
 * CK2-style decision events, Big Game Moments, and family dynamics happen.
 * Separate from franchiseStore (Classic Dynasty).
 *
 * Uses dynamic imports for dynasty system modules to avoid circular import
 * issues with Zustand's persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/stores/idbStorage.ts';
import type { CareerStageComponent, CareerStage } from '@/dynasty/systems/CareerStageSystem.ts';
import type { DecisionEvent } from '@/dynasty/systems/DecisionEventSystem.ts';
import type { BigGameMoment } from '@/dynasty/systems/BigGameMoments.ts';
import type { FamilyComponent, FamilyArchetype } from '@/dynasty/systems/FamilySystem.ts';
import type { Region } from '@/dynasty/systems/GeographySystem.ts';

// ── Types ──

export interface NarrativeEntry {
  id: string;
  age: number;
  stage: CareerStage;
  title: string;
  text: string;
  type: 'milestone' | 'decision' | 'moment' | 'family' | 'transition';
}

export interface ResolvedEvent {
  event: DecisionEvent;
  chosenIndex: number;
  consequences: string[];
  age: number;
}

export interface SeasonStats {
  gamesPlayed: number;
  atBats: number;
  hits: number;
  doubles: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
  battingAverage: number;
}

// ── Initialization options ──

export interface LivingDynastyInitOptions {
  playerName: string;
  position: string;
  background: string;
  familyArchetype: FamilyArchetype;
  region: Region;
  startStage?: CareerStage;
  startAge?: number;
}

// ── Store state ──

interface LivingDynastyState {
  // Core
  isActive: boolean;
  _hasHydrated: boolean;

  // Character identity
  playerName: string;
  position: string;
  background: string;

  // Career
  careerStage: CareerStageComponent | null;

  // Family
  familyArchetype: FamilyArchetype | null;
  family: FamilyComponent | null;

  // Geography
  region: Region | null;

  // Event queues
  pendingEvents: DecisionEvent[];
  pendingMoments: BigGameMoment[];

  // History
  resolvedEvents: ResolvedEvent[];
  narrativeLog: NarrativeEntry[];

  // Season
  seasonNumber: number;
  isAdvancing: boolean;
  seasonStats: SeasonStats | null;

  // Actions
  initialize: (opts: LivingDynastyInitOptions) => Promise<void>;
  advanceSeason: () => Promise<void>;
  resolveEvent: (eventId: string, choiceIndex: number) => void;
  resolveMoment: (momentId: string, outcome: 'success' | 'failure' | 'neutral') => void;
  addNarrative: (entry: NarrativeEntry) => void;
  reset: () => void;
}

// ── Helpers ──

let narrativeIdCounter = 0;
function nextNarrativeId(): string {
  return `narrative_${Date.now()}_${narrativeIdCounter++}`;
}

function generateRoughStats(stage: CareerStage, rng: () => number = Math.random): SeasonStats {
  // Scale stats by stage — younger = fewer games, less power
  const stageGames: Record<string, [number, number]> = {
    little_league: [20, 30],
    high_school: [25, 35],
    college: [50, 60],
    minor_leagues: [100, 140],
    mlb: [140, 162],
    post_career: [0, 0],
    retired: [0, 0],
  };

  const range = stageGames[stage] ?? [0, 0];
  const gamesPlayed = range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
  if (gamesPlayed === 0) return {
    gamesPlayed: 0, atBats: 0, hits: 0, doubles: 0, homeRuns: 0,
    rbi: 0, walks: 0, strikeouts: 0, stolenBases: 0, battingAverage: 0,
  };

  const atBats = Math.floor(gamesPlayed * (3.2 + rng() * 0.8));
  const ba = 0.180 + rng() * 0.150; // .180 - .330
  const hits = Math.round(atBats * ba);
  const doubles = Math.floor(hits * (0.15 + rng() * 0.10));
  const hrRate = stage === 'little_league' ? 0.01 : stage === 'high_school' ? 0.02 : 0.03 + rng() * 0.02;
  const homeRuns = Math.floor(atBats * hrRate);
  const rbi = Math.floor(homeRuns * 2.5 + hits * 0.3 + rng() * 10);
  const walks = Math.floor(atBats * (0.06 + rng() * 0.06));
  const strikeouts = Math.floor(atBats * (0.15 + rng() * 0.12));

  return {
    gamesPlayed, atBats, hits, doubles, homeRuns, rbi, walks, strikeouts,
    stolenBases: Math.floor(rng() * (stage === 'little_league' ? 8 : 20)),
    battingAverage: Math.round((hits / atBats) * 1000) / 1000,
  };
}

// ── Initial state (used for reset) ──

const INITIAL_STATE = {
  isActive: false,
  _hasHydrated: false,
  playerName: '',
  position: '',
  background: '',
  careerStage: null,
  familyArchetype: null,
  family: null,
  region: null,
  pendingEvents: [] as DecisionEvent[],
  pendingMoments: [] as BigGameMoment[],
  resolvedEvents: [] as ResolvedEvent[],
  narrativeLog: [] as NarrativeEntry[],
  seasonNumber: 0,
  isAdvancing: false,
  seasonStats: null as SeasonStats | null,
};

// ── Store ──

export const useLivingDynastyStore = create<LivingDynastyState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── initialize ──
      async initialize(opts: LivingDynastyInitOptions) {
        const [
          { createCareerStage },
          { generateFamily },
        ] = await Promise.all([
          import('@/dynasty/systems/CareerStageSystem.ts'),
          import('@/dynasty/systems/FamilySystem.ts'),
        ]);

        const startStage = opts.startStage ?? 'little_league';
        const startAge = opts.startAge ?? 12;
        const careerStage = createCareerStage(startStage, startAge);
        const lastName = opts.playerName.split(' ').pop() ?? opts.playerName;
        const family = generateFamily(opts.familyArchetype, lastName);

        const originEntry: NarrativeEntry = {
          id: nextNarrativeId(),
          age: startAge,
          stage: startStage,
          title: 'The Beginning',
          text: `${opts.playerName} begins their baseball journey in ${startStage.replace(/_/g, ' ')} at age ${startAge}. Position: ${opts.position}. Background: ${opts.background}. Family archetype: ${opts.familyArchetype.replace(/_/g, ' ')}.`,
          type: 'milestone',
        };

        set({
          isActive: true,
          playerName: opts.playerName,
          position: opts.position,
          background: opts.background,
          careerStage,
          familyArchetype: opts.familyArchetype,
          family,
          region: opts.region,
          pendingEvents: [],
          pendingMoments: [],
          resolvedEvents: [],
          narrativeLog: [originEntry],
          seasonNumber: 1,
          isAdvancing: false,
          seasonStats: null,
        });
      },

      // ── advanceSeason ──
      async advanceSeason() {
        const state = get();
        if (!state.isActive || !state.careerStage || !state.family) return;

        set({ isAdvancing: true });

        const [
          { STAGE_CONFIG },
          { generateSeasonEvents },
          { generateSeasonMoments },
          { ageFamilyMembers },
        ] = await Promise.all([
          import('@/dynasty/systems/CareerStageSystem.ts'),
          import('@/dynasty/systems/DecisionEventSystem.ts'),
          import('@/dynasty/systems/BigGameMoments.ts'),
          import('@/dynasty/systems/FamilySystem.ts'),
        ]);

        const career = { ...state.careerStage };
        const family = JSON.parse(JSON.stringify(state.family)) as FamilyComponent;

        // Age up
        career.age++;
        career.seasonInStage++;
        career.totalSeasons++;

        // Reset energy
        career.energy = career.maxEnergy;
        career.burnoutMeter = Math.max(0, career.burnoutMeter - 10);
        career.consecutiveTrainingDays = 0;

        // Get stage config for event/moment counts
        const config = STAGE_CONFIG[career.currentStage];
        const eventCount = config.eventsPerSeason[0] +
          Math.floor(Math.random() * (config.eventsPerSeason[1] - config.eventsPerSeason[0] + 1));
        const momentCount = config.bigMomentsPerSeason[0] +
          Math.floor(Math.random() * (config.bigMomentsPerSeason[1] - config.bigMomentsPerSeason[0] + 1));

        // Generate events and moments
        const newEvents = generateSeasonEvents(career.currentStage, eventCount);
        const newMoments = generateSeasonMoments(career.currentStage, momentCount);

        // Age family members
        const familyEvents = ageFamilyMembers(family);

        // Generate rough season stats
        const stats = generateRoughStats(career.currentStage);

        // Build narrative entries for family events
        const familyNarratives: NarrativeEntry[] = familyEvents.map(text => ({
          id: nextNarrativeId(),
          age: career.age,
          stage: career.currentStage,
          title: 'Family',
          text,
          type: 'family' as const,
        }));

        // Season summary narrative
        const seasonNarrative: NarrativeEntry = {
          id: nextNarrativeId(),
          age: career.age,
          stage: career.currentStage,
          title: `Season ${state.seasonNumber + 1}`,
          text: stats.gamesPlayed > 0
            ? `Age ${career.age} — ${career.currentStage.replace(/_/g, ' ')}. ${stats.gamesPlayed} games played, .${String(Math.round(stats.battingAverage * 1000)).padStart(3, '0')} BA, ${stats.homeRuns} HR, ${stats.rbi} RBI.`
            : `Age ${career.age} — ${career.currentStage.replace(/_/g, ' ')}. A year of transition and change.`,
          type: 'milestone',
        };

        set({
          careerStage: career,
          family,
          pendingEvents: [...state.pendingEvents, ...newEvents],
          pendingMoments: [...state.pendingMoments, ...newMoments],
          narrativeLog: [...state.narrativeLog, seasonNarrative, ...familyNarratives],
          seasonNumber: state.seasonNumber + 1,
          seasonStats: stats,
          isAdvancing: false,
        });
      },

      // ── resolveEvent ──
      resolveEvent(eventId: string, choiceIndex: number) {
        const state = get();
        const eventIdx = state.pendingEvents.findIndex(e => e.id === eventId);
        if (eventIdx === -1) return;

        const event = state.pendingEvents[eventIdx];
        const choice = event.choices[choiceIndex];
        if (!choice) return;

        const consequences = [...choice.visibleEffects];

        // 30% chance hidden effects are revealed
        if (choice.hiddenEffects && Math.random() < 0.3) {
          consequences.push(...choice.hiddenEffects);
        }

        const resolved: ResolvedEvent = {
          event,
          chosenIndex: choiceIndex,
          consequences,
          age: state.careerStage?.age ?? 0,
        };

        const narrativeEntry: NarrativeEntry = {
          id: nextNarrativeId(),
          age: state.careerStage?.age ?? 0,
          stage: state.careerStage?.currentStage ?? 'little_league',
          title: event.title,
          text: `You chose: "${choice.label}". Effects: ${consequences.join(', ')}.`,
          type: 'decision',
        };

        const newPending = [...state.pendingEvents];
        newPending.splice(eventIdx, 1);

        set({
          pendingEvents: newPending,
          resolvedEvents: [...state.resolvedEvents, resolved],
          narrativeLog: [...state.narrativeLog, narrativeEntry],
        });
      },

      // ── resolveMoment ──
      resolveMoment(momentId: string, outcome: 'success' | 'failure' | 'neutral') {
        const state = get();
        const momentIdx = state.pendingMoments.findIndex(m => m.id === momentId);
        if (momentIdx === -1) return;

        const moment = state.pendingMoments[momentIdx];
        const outcomeData = moment.outcomes[outcome] ?? moment.outcomes.failure;

        const narrativeEntry: NarrativeEntry = {
          id: nextNarrativeId(),
          age: state.careerStage?.age ?? 0,
          stage: state.careerStage?.currentStage ?? 'little_league',
          title: moment.title,
          text: outcomeData.narrative,
          type: 'moment',
        };

        const newPending = [...state.pendingMoments];
        newPending.splice(momentIdx, 1);

        set({
          pendingMoments: newPending,
          narrativeLog: [...state.narrativeLog, narrativeEntry],
        });
      },

      // ── addNarrative ──
      addNarrative(entry: NarrativeEntry) {
        set(state => ({
          narrativeLog: [...state.narrativeLog, entry],
        }));
      },

      // ── reset ──
      reset() {
        set({ ...INITIAL_STATE, _hasHydrated: true });
      },
    }),
    {
      name: 'claudeball-living-dynasty',
      storage: idbStorage as any,
      partialize: (state) => ({
        isActive: state.isActive,
        playerName: state.playerName,
        position: state.position,
        background: state.background,
        careerStage: state.careerStage,
        familyArchetype: state.familyArchetype,
        family: state.family,
        region: state.region,
        pendingEvents: state.pendingEvents,
        pendingMoments: state.pendingMoments,
        resolvedEvents: state.resolvedEvents,
        narrativeLog: state.narrativeLog,
        seasonNumber: state.seasonNumber,
        seasonStats: state.seasonStats,
        // Exclude: isAdvancing (transient), _hasHydrated (set on rehydrate)
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          useLivingDynastyStore.setState({ _hasHydrated: true });
          return;
        }
        // @ts-ignore — set hydration flag on rehydrated state
        state._hasHydrated = true;
      },
    },
  ),
);
