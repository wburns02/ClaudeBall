import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Team } from '@/engine/types/index.ts';
import type { SeasonState, DayEvents } from '@/engine/season/index.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { generateBatterLines, generatePitcherLine } from '@/engine/stats/QuickSimStatGenerator.ts';
import { SeasonEngine } from '@/engine/season/index.ts';
import type { SeriesMatchup } from '@/engine/season/index.ts';
import { generateDraftClass } from '@/engine/gm/DraftEngine.ts';
import { makePick } from '@/engine/gm/DraftEngine.ts';
import type { DraftClass } from '@/engine/gm/DraftEngine.ts';
import { generateFreeAgents } from '@/engine/gm/FreeAgency.ts';
import type { FreeAgentPool } from '@/engine/gm/FreeAgency.ts';
import type { InjuryRecord } from '@/engine/season/InjuryEngine.ts';
import type { AITradeRecord } from '@/engine/season/AITradeManager.ts';
import type { MinorLeagueRoster, CallupEvent } from '@/engine/season/MinorLeagues.ts';
import type { WaiverPlayer, WaiverEvent } from '@/engine/gm/WaiverWire.ts';
import type { PlayerContract } from '@/engine/gm/ContractEngine.ts';

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

  // Last day events
  lastDayEvents: DayEvents | null;

  // Season event logs
  injuryLog: InjuryRecord[];
  tradeLog: AITradeRecord[];
  userTradeLog: string[];
  waiverLog: WaiverEvent[];
  callupLog: CallupEvent[];

  // Internal: used only during persist/rehydrate cycle
  _seasonSnapshot?: unknown;

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
      lastDayEvents: null,
      injuryLog: [],
      tradeLog: [],
      userTradeLog: [],
      waiverLog: [],
      callupLog: [],
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

    set({
      season: { ...engine.getState() },
      injuryLog: engine.injuryEngine.getAllInjuries(),
      tradeLog: engine.aiTradeManager.getTradeLog(),
    });
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
    if (event) set(s => ({ callupLog: [...s.callupLog, event] }));
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
    if (event) set(s => ({ callupLog: [...s.callupLog, event] }));
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
    const newTeams = teams.map(team => {
      if (team.id !== teamId) return team;
      const newPlayers = team.roster.players.filter(p => p.id !== playerId);
      const newLineup = team.lineup.filter(s => s.playerId !== playerId);
      const newBullpen = team.bullpen.filter(id => id !== playerId);
      const newPitcherId = team.pitcherId === playerId
        ? (newPlayers.find(p => p.position === 'P')?.id ?? '')
        : team.pitcherId;
      return { ...team, roster: { ...team.roster, players: newPlayers }, lineup: newLineup, bullpen: newBullpen, pitcherId: newPitcherId };
    });
    set({ teams: newTeams });
    const { engine } = get();
    if (engine) {
      const engineTeam = engine.getTeam(teamId);
      if (engineTeam) {
        const updated = newTeams.find(t => t.id === teamId)!;
        engineTeam.roster.players = updated.roster.players;
        engineTeam.lineup = updated.lineup;
        engineTeam.bullpen = updated.bullpen;
        engineTeam.pitcherId = updated.pitcherId;
      }
    }
  },

  movePlayer: (playerId, fromTeamId, toTeamId) => {
    const { teams } = get();
    let playerToMove: import('@/engine/types/player.ts').Player | null = null;
    const newTeams = teams.map(team => {
      if (team.id === fromTeamId) {
        const player = team.roster.players.find(p => p.id === playerId);
        if (player) playerToMove = player;
        const newPlayers = team.roster.players.filter(p => p.id !== playerId);
        const newLineup = team.lineup.filter(s => s.playerId !== playerId);
        const newBullpen = team.bullpen.filter(id => id !== playerId);
        const newPitcherId = team.pitcherId === playerId
          ? (newPlayers.find(p => p.position === 'P')?.id ?? '')
          : team.pitcherId;
        return { ...team, roster: { ...team.roster, players: newPlayers }, lineup: newLineup, bullpen: newBullpen, pitcherId: newPitcherId };
      }
      if (team.id === toTeamId && playerToMove) {
        return { ...team, roster: { ...team.roster, players: [...team.roster.players, playerToMove!] } };
      }
      return team;
    });
    // If playerToMove wasn't found yet (order issue), do a second pass
    if (!playerToMove) return;
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
        // @ts-ignore — inject engine into the rehydrated state
        state.engine = engine;
        // @ts-ignore — set season from the restored engine state
        state.season = engine.getState();
        // @ts-ignore — clean up the temporary snapshot field
        delete state._seasonSnapshot;
      },
    },
  )
);
