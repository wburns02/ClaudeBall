import type { Team } from '../types/index.ts';
import { RandomProvider } from '../core/RandomProvider.ts';
import { QuickSimEngine } from './QuickSimEngine.ts';
import { ScheduleGenerator } from './ScheduleGenerator.ts';
import type { ScheduledGame } from './ScheduleGenerator.ts';
import { StandingsTracker } from './StandingsTracker.ts';
import { PlayoffBracket, determinePlayoffQualifiers } from './PlayoffBracket.ts';
import type { SeriesMatchup, PlayoffQualifier } from './PlayoffBracket.ts';
import { OffseasonEngine } from './OffseasonEngine.ts';
import type { Award, RetirementInfo } from './OffseasonEngine.ts';
import { InjuryEngine } from './InjuryEngine.ts';
import type { InjuryEvent } from './InjuryEngine.ts';
import { AITradeManager } from './AITradeManager.ts';
import type { AITradeRecord } from './AITradeManager.ts';
import { MinorLeagues } from './MinorLeagues.ts';
import type { CallupEvent } from './MinorLeagues.ts';
import { WaiverWire } from '../gm/WaiverWire.ts';
import type { WaiverEvent } from '../gm/WaiverWire.ts';
import { ContractEngine } from '../gm/ContractEngine.ts';

export interface DayEvents {
  injuries: InjuryEvent[];
  returns: InjuryEvent[];
  aiTrades: AITradeRecord[];
  callups: CallupEvent[];
  waivers: WaiverEvent[];
}

export interface SeasonState {
  year: number;
  currentDay: number;
  totalDays: number;
  schedule: ScheduledGame[];
  standings: StandingsTracker;
  userTeamId: string;
  phase: 'preseason' | 'regular' | 'postseason' | 'offseason';
  // Postseason state
  playoffBracket?: PlayoffBracket;
  playoffQualifiers?: PlayoffQualifier[];
  // Offseason state
  offseasonAwards?: Award[];
  offseasonRetirements?: RetirementInfo[];
  // Deep season tracking
  tradeDeadlinePassed: boolean;
}

/**
 * Manages an entire season: schedule, simulation, standings, playoffs, offseason.
 * Now includes injury tracking, AI trades, minor leagues, waiver wire, and contracts.
 */
export class SeasonEngine {
  private state: SeasonState;
  private teams: Map<string, Team>;
  private rng: RandomProvider;
  private leagueStructure: Record<string, Record<string, string[]>>;

  // Deep season sub-systems
  readonly injuryEngine: InjuryEngine;
  readonly aiTradeManager: AITradeManager;
  readonly minorLeagues: MinorLeagues;
  readonly waiverWire: WaiverWire;
  readonly contractEngine: ContractEngine;

  // Event log for the current day
  private lastDayEvents: DayEvents = { injuries: [], returns: [], aiTrades: [], callups: [], waivers: [] };

  constructor(
    teams: Team[],
    leagueStructure: Record<string, Record<string, string[]>>,
    userTeamId: string,
    year: number = 2026,
    seed: number = Date.now()
  ) {
    this.rng = new RandomProvider(seed);
    this.teams = new Map(teams.map(t => [t.id, t]));
    this.leagueStructure = leagueStructure;

    const schedule = ScheduleGenerator.generate(leagueStructure, this.rng);

    this.state = {
      year,
      currentDay: 0,
      totalDays: 183,
      schedule,
      standings: new StandingsTracker(leagueStructure),
      userTeamId,
      phase: 'preseason',
      tradeDeadlinePassed: false,
    };

    // Initialize sub-systems
    this.injuryEngine = new InjuryEngine();
    this.aiTradeManager = new AITradeManager();
    this.minorLeagues = new MinorLeagues();
    this.waiverWire = new WaiverWire();
    this.contractEngine = new ContractEngine();

    // Initialize AAA affiliates for all teams
    const allTeamIds = teams.map(t => t.id);
    this.minorLeagues.initializeAffiliates(allTeamIds, this.rng);

    // Assign default contracts to all players
    for (const team of teams) {
      for (const player of team.roster.players) {
        this.contractEngine.assignDefaultContract(player, team.id);
      }
    }
  }

  getState(): SeasonState {
    return this.state;
  }

  getLastDayEvents(): DayEvents {
    return this.lastDayEvents;
  }

  /** Advance one day, simming all non-user games. Returns user's game if they play today. */
  advanceDay(): ScheduledGame | null {
    this.state.currentDay++;
    if (this.state.phase === 'preseason') this.state.phase = 'regular';

    // Reset daily events
    this.lastDayEvents = { injuries: [], returns: [], aiTrades: [], callups: [], waivers: [] };

    // --- Daily sub-system hooks ---

    // 1. Check for player returns first (before injury rolls)
    const returns = this.injuryEngine.checkReturns(this.teams, this.state.currentDay);
    this.lastDayEvents.returns = returns;

    // 2. Daily injury rolls for all players
    const injuries = this.injuryEngine.rollDailyInjuries(
      this.teams,
      this.state.currentDay,
      this.rng
    );
    this.lastDayEvents.injuries = injuries;

    // 3. AI trades (before deadline)
    if (!this.state.tradeDeadlinePassed) {
      if (this.aiTradeManager.isDeadlinePassed(this.state.currentDay)) {
        this.state.tradeDeadlinePassed = true;
      } else {
        const aiTrades = this.aiTradeManager.runAITrades(
          this.teams,
          this.state.standings,
          this.state.userTeamId,
          this.state.currentDay,
          this.rng
        );
        this.lastDayEvents.aiTrades = aiTrades;
      }
    }

    // 4. September callups (after day 150)
    if (this.state.currentDay === 150) {
      const callups = this.minorLeagues.runSeptemberCallups(
        this.teams,
        this.state.currentDay
      );
      this.lastDayEvents.callups = callups;
    }

    // 5. Waiver wire processing
    const waiverEvents = this.waiverWire.processDailyWaivers(
      this.teams,
      this.state.userTeamId,
      this.state.currentDay,
      this.rng
    );
    this.lastDayEvents.waivers = waiverEvents;

    // --- Simulate today's games ---
    const todaysGames = this.state.schedule.filter(
      g => g.date === this.state.currentDay && !g.played
    );

    let userGame: ScheduledGame | null = null;

    for (const game of todaysGames) {
      const isUserGame = game.awayId === this.state.userTeamId || game.homeId === this.state.userTeamId;

      if (isUserGame) {
        userGame = game;
        continue;
      }

      this.simGame(game);
    }

    // Check if regular season is over
    if (this.state.currentDay >= this.state.totalDays) {
      const remaining = this.state.schedule.filter(g => !g.played);
      if (remaining.length === 0 || remaining.every(g =>
        g.awayId === this.state.userTeamId || g.homeId === this.state.userTeamId
      )) {
        this.state.phase = 'postseason';
      }
    }

    return userGame;
  }

  /** Quick-sim a specific game */
  simGame(game: ScheduledGame): void {
    const away = this.teams.get(game.awayId);
    const home = this.teams.get(game.homeId);
    if (!away || !home) return;

    // Rotate starters and decrement rest days before simming
    this.decrementRestDays(away);
    this.decrementRestDays(home);
    this.prepareStarterForGame(away);
    this.prepareStarterForGame(home);

    const result = QuickSimEngine.simulate(away, home, this.rng);
    game.awayScore = result.awayScore;
    game.homeScore = result.homeScore;
    game.played = true;

    const isDivision = this.isSameDivision(game.awayId, game.homeId);
    this.state.standings.recordGame(game.awayId, game.homeId, result.awayScore, result.homeScore, isDivision);

    // Apply post-game fatigue & rest tracking
    this.applyPostGameFatigue(away);
    this.applyPostGameFatigue(home);
  }

  /**
   * Decrement rest days by 1 for all pitchers on a team (called each game day).
   */
  private decrementRestDays(team: Team): void {
    if (!team.pitcherRestDays) { team.pitcherRestDays = {}; return; }
    for (const id of Object.keys(team.pitcherRestDays)) {
      if (team.pitcherRestDays[id] > 0) team.pitcherRestDays[id]--;
    }
  }

  /**
   * Set up the team's starting pitcher for today's game.
   * Cycles through the 5-man rotation. Skips starters who need rest.
   */
  private prepareStarterForGame(team: Team): void {
    if (!team.rotation || team.rotation.length === 0) {
      this.initRotation(team);
    }
    if (!team.pitcherRestDays) team.pitcherRestDays = {};
    if (team.rotationIndex === undefined) team.rotationIndex = 0;

    const rotation = team.rotation!;
    const restDays = team.pitcherRestDays!;

    // Find the next rested starter in rotation (up to full rotation scan)
    let attempts = 0;
    while (attempts < rotation.length) {
      const rotIdx: number = (team.rotationIndex ?? 0) % rotation.length;
      const starterId = rotation[rotIdx];
      const daysRest = restDays[starterId ?? ''] ?? 0;

      if (daysRest <= 0 && starterId) {
        team.pitcherId = starterId;
        team.rotationIndex = (rotIdx + 1) % rotation.length;

        // Reset player state for the new game
        const starter = team.roster.players.find(p => p.id === starterId);
        if (starter) {
          starter.state.pitchCount = 0;
          starter.state.fatigue = 0;
        }
        return;
      }

      team.rotationIndex = (rotIdx + 1) % rotation.length;
      attempts++;
    }

    // All starters need rest — pick the one with least rest remaining (emergency start)
    let bestId = rotation[0]!;
    let minRest = Infinity;
    for (const id of rotation) {
      const r = restDays[id] ?? 0;
      if (r < minRest) { minRest = r; bestId = id; }
    }
    team.pitcherId = bestId;
    restDays[bestId] = 0;

    const starter = team.roster.players.find(p => p.id === bestId);
    if (starter) {
      starter.state.pitchCount = 0;
      starter.state.fatigue = 0;
    }
  }

  /**
   * Initialize the 5-man rotation from the team's pitcher list.
   * Starters are pitchers NOT in the bullpen array.
   */
  private initRotation(team: Team): void {
    const bullpenSet = new Set(team.bullpen);
    const starters = team.roster.players
      .filter(p => p.position === 'P' && !bullpenSet.has(p.id))
      .slice(0, 5)
      .map(p => p.id);

    if (starters.length === 0) starters.push(team.pitcherId);

    team.rotation = starters;
    team.rotationIndex = 0;
    if (!team.pitcherRestDays) team.pitcherRestDays = {};
  }

  /**
   * After a game, assign rest days based on usage:
   * - The starter who pitched gets 4 days rest (standard 5-man rotation)
   * - Relievers who were likely used get 1-2 days rest based on stamina
   */
  private applyPostGameFatigue(team: Team): void {
    if (!team.pitcherRestDays) team.pitcherRestDays = {};
    const restDays = team.pitcherRestDays;

    // Starter pitched today — needs 4 days rest
    restDays[team.pitcherId] = 4;

    // Relievers: ~50% chance each was used (quick-sim doesn't track individually)
    for (const rpId of team.bullpen) {
      const rp = team.roster.players.find(p => p.id === rpId);
      if (!rp) continue;
      const currentRest = restDays[rpId] ?? 0;
      if (currentRest <= 0 && this.rng.chance(0.5)) {
        // Low-stamina closers/setup men need more recovery
        restDays[rpId] = rp.pitching.stamina < 40 ? 2 : 1;
      }
    }
  }

  /** Record result from a user-played game */
  recordUserGameResult(gameId: string, awayScore: number, homeScore: number): void {
    const game = this.state.schedule.find(g => g.id === gameId);
    if (!game) return;

    game.awayScore = awayScore;
    game.homeScore = homeScore;
    game.played = true;

    const isDivision = this.isSameDivision(game.awayId, game.homeId);
    this.state.standings.recordGame(game.awayId, game.homeId, awayScore, homeScore, isDivision);
  }

  /** Sim forward N days without stopping for user games */
  simDays(count: number): void {
    for (let i = 0; i < count && this.state.currentDay < this.state.totalDays; i++) {
      this.state.currentDay++;
      if (this.state.phase === 'preseason') this.state.phase = 'regular';

      // Daily hooks during fast-sim
      this.injuryEngine.checkReturns(this.teams, this.state.currentDay);
      this.injuryEngine.rollDailyInjuries(this.teams, this.state.currentDay, this.rng);

      if (!this.state.tradeDeadlinePassed) {
        if (this.aiTradeManager.isDeadlinePassed(this.state.currentDay)) {
          this.state.tradeDeadlinePassed = true;
        } else {
          this.aiTradeManager.runAITrades(
            this.teams, this.state.standings, this.state.userTeamId, this.state.currentDay, this.rng
          );
        }
      }

      if (this.state.currentDay === 150) {
        this.minorLeagues.runSeptemberCallups(this.teams, this.state.currentDay);
      }

      this.waiverWire.processDailyWaivers(
        this.teams, this.state.userTeamId, this.state.currentDay, this.rng
      );

      const todaysGames = this.state.schedule.filter(
        g => g.date === this.state.currentDay && !g.played
      );

      for (const game of todaysGames) {
        this.simGame(game);
      }
    }

    // Auto-transition to postseason after simming past end
    if (this.state.currentDay >= this.state.totalDays && this.state.phase === 'regular') {
      this.state.phase = 'postseason';
    }
  }

  /** Sim remaining regular season days entirely */
  simRemainingSeason(): void {
    this.simDays(this.state.totalDays - this.state.currentDay + 1);
  }

  /** Start playoffs — determine qualifiers and build bracket */
  startPlayoffs(): PlayoffBracket {
    // Sim any remaining regular season games
    if (this.state.currentDay < this.state.totalDays) {
      this.simRemainingSeason();
    }

    const qualifiers = determinePlayoffQualifiers(
      this.leagueStructure,
      (teamId) => this.state.standings.getRecord(teamId)
    );

    const allTeams = Array.from(this.teams.values());
    const bracket = new PlayoffBracket(qualifiers, allTeams, this.rng);

    this.state.playoffBracket = bracket;
    this.state.playoffQualifiers = qualifiers;
    this.state.phase = 'postseason';

    return bracket;
  }

  /** Simulate the next playoff round */
  simPlayoffRound(): SeriesMatchup[] {
    if (!this.state.playoffBracket) return [];
    const results = this.state.playoffBracket.advanceRound();

    if (this.state.playoffBracket.isComplete()) {
      this.state.phase = 'offseason';
    }

    return results;
  }

  /** Start offseason — generate awards, age players, handle retirements */
  startOffseason(): void {
    const allTeams = Array.from(this.teams.values());
    const standingsMap = new Map(
      allTeams.map(t => [t.id, this.state.standings.getRecord(t.id)!])
    );

    const awards = OffseasonEngine.generateAwards(standingsMap, allTeams, this.leagueStructure);
    const result = OffseasonEngine.runOffseason(allTeams, this.rng);

    this.state.offseasonAwards = awards;
    this.state.offseasonRetirements = result.retirements;
    this.state.phase = 'offseason';
  }

  /** Advance to next year — rebuild schedule, reset standings */
  advanceToNextYear(): void {
    const allTeams = Array.from(this.teams.values());

    // Rebuild teams map (rosters may have changed due to retirements)
    this.teams = new Map(allTeams.map(t => [t.id, t]));

    const newYear = this.state.year + 1;
    const newSchedule = ScheduleGenerator.generate(this.leagueStructure, this.rng);

    // Re-initialize minor leagues for new season
    this.minorLeagues.initializeAffiliates(allTeams.map(t => t.id), this.rng);

    this.state = {
      year: newYear,
      currentDay: 0,
      totalDays: 183,
      schedule: newSchedule,
      standings: new StandingsTracker(this.leagueStructure),
      userTeamId: this.state.userTeamId,
      phase: 'preseason',
      tradeDeadlinePassed: false,
    };
  }

  /** Get games for a specific day */
  getGamesForDay(day: number): ScheduledGame[] {
    return this.state.schedule.filter(g => g.date === day);
  }

  /** Get upcoming user games */
  getUpcomingUserGames(count: number = 5): ScheduledGame[] {
    return this.state.schedule
      .filter(g => !g.played && (g.awayId === this.state.userTeamId || g.homeId === this.state.userTeamId))
      .slice(0, count);
  }

  /** Get completed games for a team */
  getTeamResults(teamId: string, count: number = 10): ScheduledGame[] {
    return this.state.schedule
      .filter(g => g.played && (g.awayId === teamId || g.homeId === teamId))
      .slice(-count);
  }

  getTeam(id: string): Team | undefined {
    return this.teams.get(id);
  }

  getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  getLeagueStructure(): Record<string, Record<string, string[]>> {
    return this.leagueStructure;
  }

  getRng(): RandomProvider {
    return this.rng;
  }

  private isSameDivision(teamA: string, teamB: string): boolean {
    for (const divisions of Object.values(this.leagueStructure)) {
      for (const teams of Object.values(divisions)) {
        if (teams.includes(teamA) && teams.includes(teamB)) return true;
      }
    }
    return false;
  }
}
