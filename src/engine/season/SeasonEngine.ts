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
}

/**
 * Manages an entire season: schedule, simulation, standings, playoffs, offseason.
 */
export class SeasonEngine {
  private state: SeasonState;
  private teams: Map<string, Team>;
  private rng: RandomProvider;
  private leagueStructure: Record<string, Record<string, string[]>>;

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
    };
  }

  getState(): SeasonState {
    return this.state;
  }

  /** Advance one day, simming all non-user games. Returns user's game if they play today. */
  advanceDay(): ScheduledGame | null {
    this.state.currentDay++;
    if (this.state.phase === 'preseason') this.state.phase = 'regular';

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

    const result = QuickSimEngine.simulate(away, home, this.rng);
    game.awayScore = result.awayScore;
    game.homeScore = result.homeScore;
    game.played = true;

    const isDivision = this.isSameDivision(game.awayId, game.homeId);
    this.state.standings.recordGame(game.awayId, game.homeId, result.awayScore, result.homeScore, isDivision);
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

    this.state = {
      year: newYear,
      currentDay: 0,
      totalDays: 183,
      schedule: newSchedule,
      standings: new StandingsTracker(this.leagueStructure),
      userTeamId: this.state.userTeamId,
      phase: 'preseason',
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
