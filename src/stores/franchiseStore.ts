import { create } from 'zustand';
import type { Team } from '@/engine/types/index.ts';
import type { SeasonState } from '@/engine/season/index.ts';
import { SeasonEngine } from '@/engine/season/index.ts';
import type { SeriesMatchup } from '@/engine/season/index.ts';
import { generateDraftClass } from '@/engine/gm/DraftEngine.ts';
import { makePick } from '@/engine/gm/DraftEngine.ts';
import type { DraftClass } from '@/engine/gm/DraftEngine.ts';
import { generateFreeAgents } from '@/engine/gm/FreeAgency.ts';
import type { FreeAgentPool } from '@/engine/gm/FreeAgency.ts';

interface FranchiseState {
  // State
  engine: SeasonEngine | null;
  season: SeasonState | null;
  userTeamId: string | null;
  teams: Team[];
  leagueStructure: Record<string, Record<string, string[]>>;
  isInitialized: boolean;

  // Draft state
  draftClass: DraftClass | null;
  draftPickOrder: string[]; // team IDs in pick order
  currentDraftPick: number; // 0-based index into draftPickOrder × rounds
  draftComplete: boolean;

  // Free agency state
  freeAgentPool: FreeAgentPool | null;

  // Actions
  startFranchise: (teams: Team[], leagueStructure: Record<string, Record<string, string[]>>, userTeamId: string) => void;
  advanceDay: () => ReturnType<SeasonEngine['advanceDay']>;
  simDays: (count: number) => void;
  simGame: (gameId: string) => void;
  recordGameResult: (gameId: string, awayScore: number, homeScore: number) => void;
  refresh: () => void;

  // Season lifecycle
  startPlayoffs: () => void;
  simPlayoffRound: () => SeriesMatchup[];
  startOffseason: () => void;
  initDraft: () => void;
  draftPlayer: (prospectId: string) => boolean;
  advanceSeason: () => void;
  initFreeAgency: () => void;
}

export const useFranchiseStore = create<FranchiseState>((set, get) => ({
  engine: null,
  season: null,
  userTeamId: null,
  teams: [],
  leagueStructure: {},
  isInitialized: false,
  draftClass: null,
  draftPickOrder: [],
  currentDraftPick: 0,
  draftComplete: false,
  freeAgentPool: null,

  startFranchise: (teams, leagueStructure, userTeamId) => {
    const engine = new SeasonEngine(teams, leagueStructure, userTeamId);
    set({
      engine,
      season: engine.getState(),
      userTeamId,
      teams,
      leagueStructure,
      isInitialized: true,
      draftClass: null,
      draftPickOrder: [],
      currentDraftPick: 0,
      draftComplete: false,
      freeAgentPool: null,
    });
  },

  advanceDay: () => {
    const { engine } = get();
    if (!engine) return null;
    const userGame = engine.advanceDay();
    set({ season: { ...engine.getState() } });
    return userGame;
  },

  simDays: (count) => {
    const { engine } = get();
    if (!engine) return;
    engine.simDays(count);
    set({ season: { ...engine.getState() } });
  },

  simGame: (gameId) => {
    const { engine } = get();
    if (!engine) return;
    const game = engine.getState().schedule.find(g => g.id === gameId);
    if (game && !game.played) {
      engine.simGame(game);
      set({ season: { ...engine.getState() } });
    }
  },

  recordGameResult: (gameId, awayScore, homeScore) => {
    const { engine } = get();
    if (!engine) return;
    engine.recordUserGameResult(gameId, awayScore, homeScore);
    set({ season: { ...engine.getState() } });
  },

  refresh: () => {
    const { engine } = get();
    if (!engine) return;
    set({ season: { ...engine.getState() } });
  },

  startPlayoffs: () => {
    const { engine } = get();
    if (!engine) return;
    engine.startPlayoffs();
    set({ season: { ...engine.getState() } });
  },

  simPlayoffRound: () => {
    const { engine } = get();
    if (!engine) return [];
    const results = engine.simPlayoffRound();
    set({ season: { ...engine.getState() } });
    return results;
  },

  startOffseason: () => {
    const { engine } = get();
    if (!engine) return;
    engine.startOffseason();
    set({ season: { ...engine.getState() } });
  },

  initDraft: () => {
    const { engine, season } = get();
    if (!engine || !season) return;

    const rng = engine.getRng();
    const allTeams = engine.getAllTeams();

    // Draft order: reverse standings (worst record picks first)
    const allRecords = season.standings.getAllRecords();
    const sortedTeams = [...allRecords].sort((a, b) => {
      const aPct = a.wins / Math.max(1, a.wins + a.losses);
      const bPct = b.wins / Math.max(1, b.wins + b.losses);
      return aPct - bPct; // worst first
    });

    const pickOrder = sortedTeams.map(r => r.teamId);
    const draftClass = generateDraftClass(5, allTeams.length, rng, season.year + 1);

    // Assign picks to teams
    let overall = 0;
    for (let round = 0; round < 5; round++) {
      for (const teamId of pickOrder) {
        if (draftClass.picks[overall]) {
          draftClass.picks[overall].teamId = teamId;
        }
        overall++;
      }
    }

    set({
      draftClass,
      draftPickOrder: pickOrder,
      currentDraftPick: 0,
      draftComplete: false,
    });
  },

  draftPlayer: (prospectId: string) => {
    const { draftClass, draftPickOrder, currentDraftPick, engine } = get();
    if (!draftClass || !engine) return false;

    const teamsCount = draftPickOrder.length;
    const totalPicks = draftClass.picks.length;

    if (currentDraftPick >= totalPicks) {
      set({ draftComplete: true });
      return false;
    }

    const currentPickEntry = draftClass.picks[currentDraftPick];
    if (!currentPickEntry) return false;

    const teamId = currentPickEntry.teamId;
    const team = engine.getTeam(teamId);
    if (!team) return false;

    const player = makePick(draftClass, teamId, prospectId);
    if (!player) return false;

    // Mark prospect as drafted
    currentPickEntry.prospectId = prospectId;
    team.roster.players.push(player);

    let nextPick = currentDraftPick + 1;
    const isComplete = nextPick >= totalPicks;

    // Auto-pick for CPU teams until it's the user's turn again
    const { userTeamId } = get();
    while (!isComplete && nextPick < totalPicks) {
      const nextEntry = draftClass.picks[nextPick];
      if (!nextEntry) break;
      if (nextEntry.teamId === userTeamId) break;

      // CPU pick: pick best available prospect
      const available = draftClass.prospects.filter(
        p => !draftClass.picks.some(pk => pk.prospectId === p.id)
      );
      if (available.length === 0) break;

      // CPU picks by potential rating
      available.sort((a, b) => b.potentialRating - a.potentialRating);
      const cpuPick = available[0];
      const cpuTeam = engine.getTeam(nextEntry.teamId);

      if (cpuPick && cpuTeam) {
        const cpuPlayer = makePick(draftClass, nextEntry.teamId, cpuPick.id);
        nextEntry.prospectId = cpuPick.id;
        if (cpuPlayer) cpuTeam.roster.players.push(cpuPlayer);
      }

      nextPick++;
    }

    set({
      draftClass: { ...draftClass },
      currentDraftPick: nextPick,
      draftComplete: nextPick >= totalPicks,
    });

    void teamsCount;
    return true;
  },

  advanceSeason: () => {
    const { engine } = get();
    if (!engine) return;
    engine.advanceToNextYear();
    set({
      season: { ...engine.getState() },
      draftClass: null,
      draftPickOrder: [],
      currentDraftPick: 0,
      draftComplete: false,
      freeAgentPool: null,
    });
  },

  initFreeAgency: () => {
    const { engine } = get();
    if (!engine) return;
    const rng = engine.getRng();
    const pool = generateFreeAgents(40, rng);
    set({ freeAgentPool: pool });
  },
}));
