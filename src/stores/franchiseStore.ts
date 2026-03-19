import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Team } from '@/engine/types/index.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';
import type { SeasonState, DayEvents } from '@/engine/season/index.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { generateBatterLines, generatePitcherLine } from '@/engine/stats/QuickSimStatGenerator.ts';
import { SeasonEngine } from '@/engine/season/index.ts';
import type { SeriesMatchup } from '@/engine/season/index.ts';
import { generateDraftClass } from '@/engine/gm/DraftEngine.ts';
import { makePick } from '@/engine/gm/DraftEngine.ts';
import type { DraftClass } from '@/engine/gm/DraftEngine.ts';
import { generateFreeAgents, FreeAgentPool } from '@/engine/gm/FreeAgency.ts';
import { estimateMarketSalary } from '@/engine/gm/ContractEngine.ts';
import type { InjuryRecord } from '@/engine/season/InjuryEngine.ts';
import type { AITradeRecord } from '@/engine/season/AITradeManager.ts';
import type { MinorLeagueRoster, CallupEvent } from '@/engine/season/MinorLeagues.ts';
import type { WaiverPlayer, WaiverEvent } from '@/engine/gm/WaiverWire.ts';
import type { PlayerContract } from '@/engine/gm/ContractEngine.ts';
import type { DevelopmentChange } from '@/engine/season/OffseasonEngine.ts';
import type { TrainingAssignment } from '@/engine/player/DevelopmentEngine.ts';
import type { TradeProposal } from '@/engine/gm/TradeEngine.ts';
import { computeFormSummary } from '@/engine/performance/HotColdEngine.ts';

/** Serializable trade proposal stored in the franchise store so it persists across navigation */
export interface StoredTradeProposal {
  id: string;
  aiTeamId: string;
  aiTeamName: string;
  proposal: TradeProposal;
  day: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  counterOffering?: string[];
}

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
  previewDraftClass: DraftClass | null; // prospects only, for regular-season scouting
  draftPickOrder: string[]; // team IDs in pick order
  currentDraftPick: number; // 0-based index into draftPickOrder × rounds
  draftComplete: boolean;

  // Free agency state
  freeAgentPool: FreeAgentPool | null;

  // Last day events
  lastDayEvents: DayEvents | null;

  // Season event logs
  injuryLog: InjuryRecord[];
  tradeLog: AITradeRecord[];
  userTradeLog: string[];
  waiverLog: WaiverEvent[];
  callupLog: CallupEvent[];
  lastDevelopmentChanges: DevelopmentChange[] | null;

  // Trade proposals (persisted across navigation)
  tradeProposals: StoredTradeProposal[];
  setTradeProposals: (proposals: StoredTradeProposal[]) => void;

  // Training assignments — playerId → assignment
  trainingAssignments: Record<string, TrainingAssignment>;
  setTrainingAssignment: (playerId: string, assignment: TrainingAssignment) => void;
  clearTrainingAssignments: () => void;

  // Team budgets — teamId → annual budget in thousands (e.g. 150000 = $150M)
  teamBudgets: Record<string, number>;
  setTeamBudget: (teamId: string, budget: number) => void;
  requestBudgetIncrease: (increaseAmount: number) => { approved: boolean; newBudget: number; reason: string };

  // Internal: used only during persist/rehydrate cycle
  _seasonSnapshot?: unknown;
  _contractsSnapshot?: import('@/engine/gm/ContractEngine.ts').PlayerContract[];

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
  generatePreviewDraft: () => void;
  draftPlayer: (prospectId: string) => boolean;
  cpuDraftSinglePick: () => import('@/engine/gm/DraftEngine.ts').DraftProspect | null;
  advanceSeason: () => void;
  initFreeAgency: () => void;
  signFreeAgent: (playerId: string, years: number, salaryPerYear: number) => { success: boolean; reason?: string };

  // Injury actions
  getActiveInjuries: () => InjuryRecord[];
  getTeamInjuries: (teamId: string) => InjuryRecord[];

  // Minor league actions
  getAAATeam: (teamId: string) => MinorLeagueRoster | undefined;
  callUpPlayer: (teamId: string) => CallupEvent | null;
  callUpSpecificPlayer: (teamId: string, playerId: string) => CallupEvent | null;
  sendDownPlayer: (teamId: string, playerId: string) => CallupEvent | null;

  // Waiver wire actions
  getAvailableWaivers: () => WaiverPlayer[];
  claimWaiverPlayer: (playerId: string, claimingTeamId: string) => WaiverEvent | null;
  releasePlayerToWaivers: (teamId: string, playerId: string) => WaiverEvent | null;

  // Contract actions
  getPlayerContract: (playerId: string) => PlayerContract | undefined;
  getTeamPayroll: (teamId: string) => number;
  getAllTeamContracts: (teamId: string) => Array<{ player: import('@/engine/types/player.ts').Player; contract: PlayerContract }>;
  signExtension: (playerId: string, teamId: string, years: number, salaryPerYear: number) => import('@/engine/gm/ContractEngine.ts').ContractResult;

  // Hot/cold performance tracking
  refreshHotCold: () => void;

  // Trade deadline / logs
  isTradeDeadlinePassed: () => boolean;
  getAITradeLog: () => AITradeRecord[];
  addUserTradeLog: (description: string) => void;

  // Player & team customization
  updatePlayer: (playerId: string, updates: Partial<import('@/engine/types/player.ts').Player>) => void;
  createPlayer: (player: import('@/engine/types/player.ts').Player, teamId: string) => void;
  releasePlayer: (playerId: string, teamId: string) => void;
  movePlayer: (playerId: string, fromTeamId: string, toTeamId: string) => void;
  updateTeam: (teamId: string, updates: Partial<Omit<Team, 'id' | 'roster' | 'lineup'>>) => void;
  reorderLineup: (teamId: string, newLineup: Team['lineup']) => void;
  setRotation: (teamId: string, rotation: string[]) => void;
  setBullpen: (teamId: string, bullpen: string[]) => void;
}

export const useFranchiseStore = create<FranchiseState>()(
  persist(
    (set, get) => ({
  engine: null,
  season: null,
  userTeamId: null,
  teams: [],
  leagueStructure: {},
  isInitialized: false,
  draftClass: null,
  previewDraftClass: null,
  draftPickOrder: [],
  currentDraftPick: 0,
  draftComplete: false,
  freeAgentPool: null,
  lastDayEvents: null,
  injuryLog: [],
  tradeLog: [],
  userTradeLog: [],
  waiverLog: [],
  callupLog: [],
  lastDevelopmentChanges: null,
  tradeProposals: [],
  setTradeProposals: (proposals) => set({ tradeProposals: proposals }),
  trainingAssignments: {},
  setTrainingAssignment: (playerId, assignment) =>
    set(s => ({ trainingAssignments: { ...s.trainingAssignments, [playerId]: assignment } })),
  clearTrainingAssignments: () => set({ trainingAssignments: {} }),
  teamBudgets: {},
  setTeamBudget: (teamId, budget) =>
    set(s => ({ teamBudgets: { ...s.teamBudgets, [teamId]: budget } })),
  requestBudgetIncrease: (increaseAmount) => {
    const { teamBudgets, userTeamId, season } = get();
    if (!userTeamId) return { approved: false, newBudget: 0, reason: 'No franchise loaded' };
    const currentBudget = teamBudgets[userTeamId] ?? 150_000;
    const record = season?.standings.getRecord(userTeamId);
    const games = (record?.wins ?? 0) + (record?.losses ?? 0);
    const winPct = games > 0 ? (record?.wins ?? 0) / games : 0.5;
    // Better record = better odds; 35% base + up to 50% from performance
    const approvalChance = 0.35 + winPct * 0.50;
    const approved = Math.random() < approvalChance;
    if (approved) {
      const newBudget = currentBudget + increaseAmount;
      set(s => ({ teamBudgets: { ...s.teamBudgets, [userTeamId]: newBudget } }));
      return { approved: true, newBudget, reason: 'Ownership approved the budget increase!' };
    }
    const msg = winPct < 0.4
      ? 'Ownership denied — improve the team\'s record before requesting more funds.'
      : winPct < 0.5
      ? 'Ownership denied — a stronger winning record would help your case.'
      : 'Ownership denied — they\'re not ready to commit more resources right now.';
    return { approved: false, newBudget: currentBudget, reason: msg };
  },

  startFranchise: (teams, leagueStructure, userTeamId) => {
    // Deep-clone teams and randomize player ages + mental ratings for realism
    const rng = new RandomProvider(Date.now() ^ (Math.random() * 0x7fffffff | 0));
    // MLB-realistic age buckets: young (22-25) ~25%, prime (26-31) ~50%, vet (32-38) ~25%
    function randomAge(rng: RandomProvider): number {
      const roll = rng.next();
      if (roll < 0.25) return rng.nextInt(22, 25);
      if (roll < 0.75) return rng.nextInt(26, 31);
      return rng.nextInt(32, 38);
    }
    function randMental(rng: RandomProvider): number {
      return Math.round(30 + rng.next() * 55); // 30-85 range
    }
    const initializedTeams: Team[] = teams.map(team => ({
      ...team,
      roster: {
        ...team.roster,
        players: team.roster.players.map(player => ({
          ...player,
          age: player.age === 28 ? randomAge(rng) : player.age, // only randomize default-age players
          mental: {
            intelligence: randMental(rng),
            work_ethic: randMental(rng),
            durability: randMental(rng),
            consistency: randMental(rng),
            composure: randMental(rng),
            leadership: randMental(rng),
          },
        })),
      },
    }));
    const engine = new SeasonEngine(initializedTeams, leagueStructure, userTeamId);
    // Initialize team budgets: payroll + 15% headroom, floor $100M, cap $220M
    const teamBudgets: Record<string, number> = {};
    for (const team of initializedTeams) {
      const payroll = engine.contractEngine.getTeamPayroll(team.id);
      const budget = Math.min(220_000, Math.max(100_000, Math.round(payroll * 1.15 / 1000) * 1000));
      teamBudgets[team.id] = budget;
    }
    set({
      engine,
      season: engine.getState(),
      userTeamId,
      teams: initializedTeams,
      leagueStructure,
      isInitialized: true,
      draftClass: null,
      previewDraftClass: null,
      draftPickOrder: [],
      currentDraftPick: 0,
      draftComplete: false,
      freeAgentPool: null,
      lastDayEvents: null,
      injuryLog: [],
      tradeLog: [],
      userTradeLog: [],
      waiverLog: [],
      callupLog: [],
      lastDevelopmentChanges: null,
      teamBudgets,
    });
  },

  advanceDay: () => {
    const { engine } = get();
    if (!engine) return null;

    // Snapshot which games were already played before advancing
    const beforePlayed = new Set(engine.getState().schedule.filter(g => g.played).map(g => g.id));

    const userGame = engine.advanceDay();
    const events = engine.getLastDayEvents();

    // Record stats for newly simmed games
    try {
      const season = engine.getState();
      const rng = engine.getRng();
      const newlyPlayed = season.schedule.filter(g => g.played && !beforePlayed.has(g.id));
      for (const game of newlyPlayed) {
        if (game.awayScore === undefined || game.homeScore === undefined) continue;
        const awayTeam = engine.getTeam(game.awayId);
        const homeTeam = engine.getTeam(game.homeId);
        if (!awayTeam || !homeTeam) continue;
        const awayBatters = generateBatterLines(awayTeam, game.awayScore, rng);
        const homeBatters = generateBatterLines(homeTeam, game.homeScore, rng);
        const awayPitchers = generatePitcherLine(awayTeam, game.homeScore, game.awayScore > game.homeScore, rng);
        const homePitchers = generatePitcherLine(homeTeam, game.awayScore, game.homeScore > game.awayScore, rng);
        useStatsStore.getState().recordGameStats(
          game.id, game.date, season.year,
          game.awayId, game.homeId,
          awayBatters, homeBatters,
          awayPitchers, homePitchers,
          (playerId) => awayTeam.roster.players.some(p => p.id === playerId) ? game.awayId : game.homeId,
          (playerId) => {
            const p = awayTeam.roster.players.find(pl => pl.id === playerId)
              ?? homeTeam.roster.players.find(pl => pl.id === playerId);
            return p?.position ?? 'DH';
          },
          game.awayScore,
          game.homeScore,
        );
      }
    } catch { /* non-critical */ }

    set(s => ({
      season: { ...engine.getState() },
      lastDayEvents: events,
      injuryLog: [...s.injuryLog, ...events.injuries.map(e => e.record)],
      tradeLog: [...s.tradeLog, ...events.aiTrades],
      waiverLog: [...s.waiverLog, ...events.waivers],
      callupLog: [...s.callupLog, ...events.callups],
    }));
    // Update player morale based on recent performance (non-blocking, best-effort)
    try { get().refreshHotCold(); } catch { /* non-critical */ }
    return userGame;
  },

  simDays: (count) => {
    const { engine } = get();
    if (!engine) return;

    // Snapshot which games were already played before simming
    const beforePlayed = new Set(engine.getState().schedule.filter(g => g.played).map(g => g.id));

    engine.simDays(count);

    // Record stats for newly simmed games
    try {
      const season = engine.getState();
      const rng = engine.getRng();
      const newlyPlayed = season.schedule.filter(g => g.played && !beforePlayed.has(g.id));
      for (const game of newlyPlayed) {
        if (game.awayScore === undefined || game.homeScore === undefined) continue;
        const awayTeam = engine.getTeam(game.awayId);
        const homeTeam = engine.getTeam(game.homeId);
        if (!awayTeam || !homeTeam) continue;
        const awayBatters = generateBatterLines(awayTeam, game.awayScore, rng);
        const homeBatters = generateBatterLines(homeTeam, game.homeScore, rng);
        const awayPitchers = generatePitcherLine(awayTeam, game.homeScore, game.awayScore > game.homeScore, rng);
        const homePitchers = generatePitcherLine(homeTeam, game.awayScore, game.homeScore > game.awayScore, rng);
        useStatsStore.getState().recordGameStats(
          game.id, game.date, season.year,
          game.awayId, game.homeId,
          awayBatters, homeBatters,
          awayPitchers, homePitchers,
          (playerId) => awayTeam.roster.players.some(p => p.id === playerId) ? game.awayId : game.homeId,
          (playerId) => {
            const p = awayTeam.roster.players.find(pl => pl.id === playerId)
              ?? homeTeam.roster.players.find(pl => pl.id === playerId);
            return p?.position ?? 'DH';
          },
          game.awayScore,
          game.homeScore,
        );
      }
    } catch { /* non-critical */ }

    const events = engine.getLastDayEvents();
    set(s => ({
      season: { ...engine.getState() },
      injuryLog: engine.injuryEngine.getAllInjuries(),
      tradeLog: engine.aiTradeManager.getTradeLog(),
      lastDayEvents: events,
      waiverLog: [...s.waiverLog, ...events.waivers],
      callupLog: [...s.callupLog, ...events.callups],
    }));
    try { get().refreshHotCold(); } catch { /* non-critical */ }
  },

  simGame: (gameId) => {
    const { engine } = get();
    if (!engine) return;
    const game = engine.getState().schedule.find(g => g.id === gameId);
    if (game && !game.played) {
      engine.simGame(game);
      // Record approximate stats for quick-simmed games
      if (game.awayScore !== undefined && game.homeScore !== undefined) {
        try {
          const rng = engine.getRng();
          const awayTeam = engine.getTeam(game.awayId);
          const homeTeam = engine.getTeam(game.homeId);
          const season = engine.getState();
          if (awayTeam && homeTeam) {
            const awayBatters = generateBatterLines(awayTeam, game.awayScore, rng);
            const homeBatters = generateBatterLines(homeTeam, game.homeScore, rng);
            const awayPitchers = generatePitcherLine(awayTeam, game.homeScore, game.awayScore > game.homeScore, rng);
            const homePitchers = generatePitcherLine(homeTeam, game.awayScore, game.homeScore > game.awayScore, rng);
            useStatsStore.getState().recordGameStats(
              game.id, game.date, season.year,
              game.awayId, game.homeId,
              awayBatters, homeBatters,
              awayPitchers, homePitchers,
              (playerId) => {
                const aPlayer = awayTeam.roster.players.find(p => p.id === playerId);
                if (aPlayer) return game.awayId;
                return game.homeId;
              },
              (playerId) => {
                const p = awayTeam.roster.players.find(pl => pl.id === playerId)
                  ?? homeTeam.roster.players.find(pl => pl.id === playerId);
                return p?.position ?? 'DH';
              },
            );
          }
        } catch {
          // Non-critical — don't break the game if stat recording fails
        }
      }
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
    const { engine, trainingAssignments } = get();
    if (!engine) return;
    engine.startOffseason(trainingAssignments);
    const state = engine.getState();
    set({
      season: { ...state },
      // Update teams to reflect development changes applied by offseason engine
      teams: engine.getAllTeams().map(t => ({ ...t, roster: { ...t.roster, players: [...t.roster.players] } })),
      lastDevelopmentChanges: state.offseasonDevelopment ?? null,
      // Clear training assignments after offseason applies them
      trainingAssignments: {},
    });
  },

  generatePreviewDraft: () => {
    const { engine, season, previewDraftClass } = get();
    if (!engine || !season) return;
    // Only generate once per season year
    const targetYear = season.year + 1;
    if (previewDraftClass && (previewDraftClass as DraftClass & { year?: number }).year === targetYear) return;
    const rng = engine.getRng();
    const allTeams = engine.getAllTeams();
    const dc = generateDraftClass(5, allTeams.length, rng, targetYear);
    // Store year on the object for cache-busting
    (dc as DraftClass & { year?: number }).year = targetYear;
    set({ previewDraftClass: dc });
  },

  initDraft: () => {
    const { engine, season, previewDraftClass } = get();
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
    // Reuse preview draft class prospects if they exist (maintains continuity from scouting)
    const targetYear = season.year + 1;
    const hasPreview = previewDraftClass &&
      (previewDraftClass as DraftClass & { year?: number }).year === targetYear;
    const draftClass = hasPreview
      ? { ...previewDraftClass! }
      : generateDraftClass(5, allTeams.length, rng, targetYear);

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

    // Auto-advance CPU picks until the user's first turn
    let firstUserPick = 0;
    const userTeamIdNow = get().userTeamId;
    while (firstUserPick < draftClass.picks.length) {
      const entry = draftClass.picks[firstUserPick];
      if (!entry || entry.teamId === userTeamIdNow) break;

      // CPU auto-pick
      const available = draftClass.prospects.filter(
        p => !draftClass.picks.some(pk => pk.prospectId === p.id)
      );
      if (available.length === 0) break;
      available.sort((a, b) => b.potentialRating - a.potentialRating);
      const cpuPick = available[0];
      const cpuTeam = allTeams.find(t => t.id === entry.teamId);
      if (cpuPick && cpuTeam) {
        const cpuPlayer = makePick(draftClass, entry.teamId, cpuPick.id);
        entry.prospectId = cpuPick.id;
        if (cpuPlayer) cpuTeam.roster.players.push(cpuPlayer);
      }
      firstUserPick++;
    }

    set({
      draftClass: { ...draftClass },
      draftPickOrder: pickOrder,
      currentDraftPick: firstUserPick,
      draftComplete: firstUserPick >= draftClass.picks.length,
    });
  },

  draftPlayer: (prospectId: string) => {
    const { draftClass, draftPickOrder, currentDraftPick, engine } = get();
    if (!draftClass || !engine) return false;

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

    // Mark prospect as drafted — do NOT auto-advance CPU picks
    // CPU picks are animated one-at-a-time in DraftPage via cpuDraftSinglePick
    currentPickEntry.prospectId = prospectId;
    team.roster.players.push(player);

    const nextPick = currentDraftPick + 1;

    set({
      draftClass: { ...draftClass },
      currentDraftPick: nextPick,
      draftComplete: nextPick >= totalPicks,
    });

    return true;
  },

  /**
   * Make exactly ONE CPU pick for the current pick slot.
   * Returns the prospect selected (for animation display), or null if done/user's turn.
   * Called repeatedly with a delay by DraftPage to animate CPU picks one-at-a-time.
   */
  cpuDraftSinglePick: () => {
    const { draftClass, currentDraftPick, userTeamId, engine } = get();
    if (!draftClass || !engine) return null;

    const totalPicks = draftClass.picks.length;
    if (currentDraftPick >= totalPicks) {
      set({ draftComplete: true });
      return null;
    }

    const pickEntry = draftClass.picks[currentDraftPick];
    if (!pickEntry) return null;
    // Stop if it's the user's turn
    if (pickEntry.teamId === userTeamId) return null;

    const cpuTeam = engine.getTeam(pickEntry.teamId);
    if (!cpuTeam) return null;

    const available = draftClass.prospects.filter(
      p => !draftClass.picks.some(pk => pk.prospectId === p.id)
    );
    if (available.length === 0) return null;

    available.sort((a, b) => b.potentialRating - a.potentialRating);
    const picked = available[0];
    if (!picked) return null;

    const cpuPlayer = makePick(draftClass, pickEntry.teamId, picked.id);
    pickEntry.prospectId = picked.id;
    if (cpuPlayer) cpuTeam.roster.players.push(cpuPlayer);

    const nextPick = currentDraftPick + 1;
    set({
      draftClass: { ...draftClass },
      currentDraftPick: nextPick,
      draftComplete: nextPick >= totalPicks,
    });

    return picked;
  },

  advanceSeason: () => {
    const { engine } = get();
    if (!engine) return;
    engine.advanceToNextYear();
    set({
      season: { ...engine.getState() },
      teams: engine.getAllTeams().map(t => ({ ...t, roster: { ...t.roster, players: [...t.roster.players] } })),
      draftClass: null,
      previewDraftClass: null,
      draftPickOrder: [],
      currentDraftPick: 0,
      draftComplete: false,
      freeAgentPool: null,
      lastDayEvents: null,
      injuryLog: [],
      tradeLog: [],
      waiverLog: [],
      callupLog: [],
    });
  },

  initFreeAgency: () => {
    const { engine } = get();
    if (!engine) return;
    const rng = engine.getRng();
    const pool = generateFreeAgents(40, rng);
    set({ freeAgentPool: pool });
  },

  signFreeAgent: (playerId, years, salaryPerYear) => {
    const { engine, freeAgentPool, teams, userTeamId, teamBudgets } = get();
    if (!engine || !freeAgentPool || !userTeamId) return { success: false, reason: 'Not initialized' };
    const fa = freeAgentPool.get(playerId);
    if (!fa) return { success: false, reason: 'Player not in free agent pool' };
    // Salary check: must be within 20% of asking
    if (salaryPerYear < fa.askingSalary * 0.8) {
      return { success: false, reason: `${fa.player.firstName} ${fa.player.lastName} wants at least $${(fa.askingSalary * 0.8 / 1000).toFixed(1)}M/yr` };
    }
    // Budget check: don't exceed team's ownership-approved budget
    const teamBudget = teamBudgets[userTeamId];
    if (teamBudget !== undefined) {
      const currentPayroll = engine.contractEngine.getTeamPayroll(userTeamId);
      if (currentPayroll + salaryPerYear > teamBudget) {
        const over = currentPayroll + salaryPerYear - teamBudget;
        return { success: false, reason: `This signing would exceed your $${(teamBudget / 1000).toFixed(0)}M budget by $${(over / 1000).toFixed(1)}M. Request a budget increase from ownership.` };
      }
    }
    // Add player to engine's live team
    const engineTeam = engine.getTeam(userTeamId);
    if (!engineTeam) return { success: false, reason: 'Team not found' };
    const signedPlayer = { ...fa.player };
    engineTeam.roster.players.push(signedPlayer);
    // Sign contract via engine
    engine.contractEngine.signContract(signedPlayer, userTeamId, { years, salaryPerYear });
    // Remove from pool and update React state — create a new FreeAgentPool instance so
    // the reference changes and useMemo dependencies in React components re-run correctly.
    freeAgentPool.remove(playerId);
    const newPool = new FreeAgentPool();
    for (const agent of freeAgentPool.getAll()) newPool.add(agent);
    const newTeams = teams.map(t =>
      t.id === userTeamId
        ? { ...t, roster: { ...t.roster, players: [...t.roster.players, signedPlayer] } }
        : t
    );
    set({ freeAgentPool: newPool, teams: newTeams });
    return { success: true };
  },

  // Injury actions
  getActiveInjuries: () => {
    const { engine } = get();
    if (!engine) return [];
    return engine.injuryEngine.getActiveInjuries();
  },

  getTeamInjuries: (teamId: string) => {
    const { engine } = get();
    if (!engine) return [];
    return engine.injuryEngine.getTeamInjuries(teamId);
  },

  // Minor league actions
  getAAATeam: (teamId: string) => {
    const { engine } = get();
    if (!engine) return undefined;
    return engine.minorLeagues.getAffiliate(teamId);
  },

  callUpPlayer: (teamId: string) => {
    const { engine } = get();
    if (!engine) return null;
    const team = engine.getTeam(teamId);
    if (!team) return null;
    const event = engine.minorLeagues.callUp(teamId, team.roster.players, engine.getState().currentDay);
    if (event) set(s => ({ callupLog: [...s.callupLog, event], season: { ...engine.getState() } }));
    return event;
  },

  callUpSpecificPlayer: (teamId: string, playerId: string) => {
    const { engine } = get();
    if (!engine) return null;
    const team = engine.getTeam(teamId);
    if (!team) return null;
    const event = engine.minorLeagues.callUpSpecific(teamId, team.roster.players, playerId, engine.getState().currentDay);
    if (event) set(s => ({ callupLog: [...s.callupLog, event], season: { ...engine.getState() } }));
    return event;
  },

  sendDownPlayer: (teamId: string, playerId: string) => {
    const { engine } = get();
    if (!engine) return null;
    const team = engine.getTeam(teamId);
    if (!team) return null;
    const event = engine.minorLeagues.sendDown(teamId, team.roster.players, playerId);
    if (event) set(s => ({ callupLog: [...s.callupLog, event], season: { ...engine.getState() } }));
    return event;
  },

  // Waiver wire actions
  getAvailableWaivers: () => {
    const { engine, season } = get();
    if (!engine || !season) return [];
    return engine.waiverWire.getAvailable(season.currentDay);
  },

  claimWaiverPlayer: (playerId: string, claimingTeamId: string) => {
    const { engine, season } = get();
    if (!engine || !season) return null;
    const claimingTeam = engine.getTeam(claimingTeamId);
    if (!claimingTeam) return null;
    const event = engine.waiverWire.claimPlayer(playerId, claimingTeamId, claimingTeam.roster.players, season.currentDay);
    if (event) set(s => ({ waiverLog: [...s.waiverLog, event] }));
    return event;
  },

  releasePlayerToWaivers: (teamId: string, playerId: string) => {
    const { engine, season } = get();
    if (!engine || !season) return null;
    const team = engine.getTeam(teamId);
    if (!team) return null;
    const idx = team.roster.players.findIndex((p: import('@/engine/types/player.ts').Player) => p.id === playerId);
    if (idx === -1) return null;
    const [player] = team.roster.players.splice(idx, 1);
    const event = engine.waiverWire.releasePlayer(player, teamId, season.currentDay);
    set(s => ({ waiverLog: [...s.waiverLog, event] }));
    return event;
  },

  // Contract actions
  getPlayerContract: (playerId: string) => {
    const { engine } = get();
    if (!engine) return undefined;
    return engine.contractEngine.getContract(playerId);
  },

  getTeamPayroll: (teamId: string) => {
    const { engine } = get();
    if (!engine) return 0;
    return engine.contractEngine.getTeamPayroll(teamId);
  },

  getAllTeamContracts: (teamId: string) => {
    const { engine } = get();
    if (!engine) return [];
    const team = engine.getTeam(teamId);
    if (!team) return [];
    return team.roster.players
      .map(player => {
        const contract = engine.contractEngine.getContract(player.id);
        return contract ? { player, contract } : null;
      })
      .filter((x): x is { player: import('@/engine/types/player.ts').Player; contract: PlayerContract } => x !== null);
  },

  signExtension: (playerId: string, teamId: string, years: number, salaryPerYear: number) => {
    const { engine } = get();
    if (!engine) return { success: false, reason: 'No franchise loaded' };
    const allTeams = engine.getAllTeams();
    const team = allTeams.find(t => t.id === teamId);
    const player = team?.roster.players.find(p => p.id === playerId);
    if (!player) return { success: false, reason: 'Player not found' };
    const result = engine.contractEngine.signContract(player, teamId, { years, salaryPerYear });
    if (result.success) set(s => ({ season: s.season ? { ...s.season } : s.season }));
    return result;
  },

  // Hot/cold performance tracking — updates player morale from recent game logs
  refreshHotCold: () => {
    const { engine, teams } = get();
    if (!engine) return;
    const statsState = useStatsStore.getState();
    for (const team of teams) {
      const engineTeam = engine.getTeam(team.id);
      if (!engineTeam) continue;
      for (const player of engineTeam.roster.players) {
        const stats = statsState.playerStats[player.id];
        if (!stats || stats.gameLog.length === 0) continue;
        const form = computeFormSummary(
          player.id,
          stats.gameLog,
          player.position,
          stats.batting.ab > 0 ? { ab: stats.batting.ab, h: stats.batting.h, bb: stats.batting.bb, hr: stats.batting.hr } : undefined,
          stats.pitching.ip > 0 ? { ip: stats.pitching.ip / 3, er: stats.pitching.er, bb: stats.pitching.bb, so: stats.pitching.so } : undefined,
        );
        // Nudge morale toward target gradually
        const current = player.state.morale;
        player.state.morale = Math.round(current + (form.moraleTarget - current) * 0.25);
      }
    }
  },

  // Trade deadline / logs
  isTradeDeadlinePassed: () => {
    const { season } = get();
    return season?.tradeDeadlinePassed ?? false;
  },

  getAITradeLog: () => {
    const { engine } = get();
    if (!engine) return [];
    return engine.aiTradeManager.getTradeLog();
  },

  addUserTradeLog: (description: string) => {
    set(s => ({ userTradeLog: [description, ...s.userTradeLog] }));
  },

  updatePlayer: (playerId, updates) => {
    const { teams } = get();
    const newTeams = teams.map(team => {
      const idx = team.roster.players.findIndex(p => p.id === playerId);
      if (idx === -1) return team;
      const updated = { ...team.roster.players[idx], ...updates };
      const newPlayers = [...team.roster.players];
      newPlayers[idx] = updated;
      return { ...team, roster: { ...team.roster, players: newPlayers } };
    });
    set({ teams: newTeams });
    // Sync engine teams if live
    const { engine } = get();
    if (engine) {
      for (const team of newTeams) {
        const engineTeam = engine.getTeam(team.id);
        if (engineTeam) {
          engineTeam.roster.players = team.roster.players;
        }
      }
    }
  },

  createPlayer: (player, teamId) => {
    const { teams } = get();
    const newTeams = teams.map(team => {
      if (team.id !== teamId) return team;
      return { ...team, roster: { ...team.roster, players: [...team.roster.players, player] } };
    });
    set({ teams: newTeams });
    const { engine } = get();
    if (engine) {
      const engineTeam = engine.getTeam(teamId);
      if (engineTeam) engineTeam.roster.players = newTeams.find(t => t.id === teamId)!.roster.players;
    }
  },

  releasePlayer: (playerId, teamId) => {
    const { teams } = get();
    // Capture the player before removing them so we can add them to the FA pool
    let releasedPlayer: import('@/engine/types/player.ts').Player | null = null;
    const newTeams = teams.map(team => {
      if (team.id !== teamId) return team;
      releasedPlayer = team.roster.players.find(p => p.id === playerId) ?? null;
      const newPlayers = team.roster.players.filter(p => p.id !== playerId);
      const newLineup = team.lineup.filter(s => s.playerId !== playerId);
      const newBullpen = team.bullpen.filter(id => id !== playerId);
      const newPitcherId = team.pitcherId === playerId
        ? (newPlayers.find(p => p.position === 'P')?.id ?? '')
        : team.pitcherId;
      return { ...team, roster: { ...team.roster, players: newPlayers }, lineup: newLineup, bullpen: newBullpen, pitcherId: newPitcherId };
    });
    set({ teams: newTeams });
    const { engine, freeAgentPool } = get();
    if (engine) {
      const engineTeam = engine.getTeam(teamId);
      if (engineTeam) {
        const updated = newTeams.find(t => t.id === teamId)!;
        engineTeam.roster.players = updated.roster.players;
        engineTeam.lineup = updated.lineup;
        engineTeam.bullpen = updated.bullpen;
        engineTeam.pitcherId = updated.pitcherId;
      }
      engine.contractEngine.releasePlayer(playerId);
    }
    // Add the released player to the free agent pool if it's initialized.
    // Create a new FreeAgentPool instance so the reference changes and useMemo
    // dependencies in React components (e.g. FreeAgencyPage) re-run correctly.
    if (releasedPlayer && freeAgentPool) {
      const p = releasedPlayer as import('@/engine/types/player.ts').Player;
      const askingSalary = estimateMarketSalary(p) * 0.85; // slight discount for released player
      const newPool = new FreeAgentPool();
      for (const agent of freeAgentPool.getAll()) newPool.add(agent);
      newPool.add({ player: p, askingSalary, yearsDesired: Math.min(3, Math.max(1, Math.round((100 - p.age) / 15))) });
      set({ freeAgentPool: newPool });
    }
  },

  movePlayer: (playerId, fromTeamId, toTeamId) => {
    const { teams } = get();
    // Pass 1: find the player — must happen before the map so order in the array doesn't matter
    let playerToMove: import('@/engine/types/player.ts').Player | null = null;
    for (const team of teams) {
      if (team.id === fromTeamId) {
        playerToMove = team.roster.players.find(p => p.id === playerId) ?? null;
        break;
      }
    }
    if (!playerToMove) return; // player not found on source team
    const movedPlayer = playerToMove;
    // Pass 2: build updated teams array with player removed from source and added to dest
    const newTeams = teams.map(team => {
      if (team.id === fromTeamId) {
        const newPlayers = team.roster.players.filter(p => p.id !== playerId);
        const newLineup = team.lineup.filter(s => s.playerId !== playerId);
        const newBullpen = team.bullpen.filter(id => id !== playerId);
        const newPitcherId = team.pitcherId === playerId
          ? (newPlayers.find(p => p.position === 'P')?.id ?? '')
          : team.pitcherId;
        return { ...team, roster: { ...team.roster, players: newPlayers }, lineup: newLineup, bullpen: newBullpen, pitcherId: newPitcherId };
      }
      if (team.id === toTeamId) {
        return { ...team, roster: { ...team.roster, players: [...team.roster.players, movedPlayer] } };
      }
      return team;
    });
    set({ teams: newTeams });
    const { engine } = get();
    if (engine) {
      for (const t of newTeams.filter(t => t.id === fromTeamId || t.id === toTeamId)) {
        const et = engine.getTeam(t.id);
        if (et) {
          et.roster.players = t.roster.players;
          et.lineup = t.lineup;
          et.bullpen = t.bullpen;
          et.pitcherId = t.pitcherId;
        }
      }
      // Transfer the player's contract to the new team so payroll stays accurate
      engine.contractEngine.transferContract(movedPlayer.id, toTeamId);
    }
  },

  updateTeam: (teamId, updates) => {
    const { teams } = get();
    const newTeams = teams.map(team =>
      team.id === teamId ? { ...team, ...updates } : team
    );
    set({ teams: newTeams });
    const { engine } = get();
    if (engine) {
      const et = engine.getTeam(teamId);
      if (et) Object.assign(et, updates);
    }
  },

  reorderLineup: (teamId, newLineup) => {
    const { teams } = get();
    const newTeams = teams.map(team =>
      team.id === teamId ? { ...team, lineup: newLineup } : team
    );
    set({ teams: newTeams });
    const { engine } = get();
    if (engine) {
      const et = engine.getTeam(teamId);
      if (et) et.lineup = newLineup;
    }
  },
  setRotation: (teamId, rotation) => {
    const { teams } = get();
    const newTeams = teams.map(team =>
      team.id === teamId ? { ...team, rotation, rotationIndex: 0 } : team
    );
    set({ teams: newTeams });
    const { engine } = get();
    if (engine) {
      const et = engine.getTeam(teamId);
      if (et) { et.rotation = rotation; et.rotationIndex = 0; }
    }
  },
  setBullpen: (teamId, bullpen) => {
    const { teams } = get();
    const newTeams = teams.map(team =>
      team.id === teamId ? { ...team, bullpen } : team
    );
    set({ teams: newTeams });
    const { engine } = get();
    if (engine) {
      const et = engine.getTeam(teamId);
      if (et) et.bullpen = bullpen;
    }
  },
    }),
    {
      name: 'claudeball-franchise',
      // Only persist serializable fields — exclude engine (class instance) and lastDayEvents
      partialize: (state) => ({
        userTeamId: state.userTeamId,
        teams: state.teams,
        leagueStructure: state.leagueStructure,
        isInitialized: state.isInitialized,
        draftClass: state.draftClass,
        draftPickOrder: state.draftPickOrder,
        currentDraftPick: state.currentDraftPick,
        draftComplete: state.draftComplete,
        freeAgentPool: state.freeAgentPool,
        injuryLog: state.injuryLog,
        tradeLog: state.tradeLog,
        userTradeLog: state.userTradeLog,
        waiverLog: state.waiverLog,
        callupLog: state.callupLog,
        tradeProposals: state.tradeProposals,
        trainingAssignments: state.trainingAssignments,
        lastDevelopmentChanges: state.lastDevelopmentChanges,
        teamBudgets: state.teamBudgets,
        // Serialize contracts so trades survive page reload
        _contractsSnapshot: state.engine?.contractEngine.getAllContracts() ?? [],
        // Serialize the season without the StandingsTracker class instance
        _seasonSnapshot: state.season
          ? {
              year: state.season.year,
              currentDay: state.season.currentDay,
              totalDays: state.season.totalDays,
              schedule: state.season.schedule,
              standingsRecords: state.season.standings.getAllRecords(),
              userTeamId: state.season.userTeamId,
              phase: state.season.phase,
              tradeDeadlinePassed: state.season.tradeDeadlinePassed,
              playoffBracket: state.season.playoffBracket,
              playoffQualifiers: state.season.playoffQualifiers,
              offseasonAwards: state.season.offseasonAwards,
              offseasonRetirements: state.season.offseasonRetirements,
            }
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.isInitialized || !state.teams.length || !state.userTeamId) return;
        // Rebuild engine from persisted data
        const engine = new SeasonEngine(state.teams, state.leagueStructure, state.userTeamId);
        if (state._seasonSnapshot) {
          engine.restoreState(state._seasonSnapshot as Parameters<SeasonEngine['restoreState']>[0]);
        }
        // Restore contracts from snapshot so trade history isn't lost on reload
        if (state._contractsSnapshot?.length) {
          engine.contractEngine.restoreContracts(state._contractsSnapshot);
        }
        // @ts-ignore — inject engine into the rehydrated state
        state.engine = engine;
        // @ts-ignore — set season from the restored engine state
        state.season = engine.getState();
        // @ts-ignore — clean up the temporary snapshot fields
        delete state._seasonSnapshot;
        // @ts-ignore
        delete state._contractsSnapshot;
        // FreeAgentPool uses a Map internally which loses its prototype after JSON serialization.
        // Null it out so the page's useEffect will call initFreeAgency() to generate a proper instance.
        // @ts-ignore
        state.freeAgentPool = null;
      },
    },
  )
);
