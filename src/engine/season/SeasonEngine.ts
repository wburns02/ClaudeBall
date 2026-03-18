import type { Team } from '../types/index.ts';
import { RandomProvider } from '../core/RandomProvider.ts';
import { QuickSimEngine } from './QuickSimEngine.ts';
import { ScheduleGenerator } from './ScheduleGenerator.ts';
import type { ScheduledGame } from './ScheduleGenerator.ts';
import { StandingsTracker } from './StandingsTracker.ts';

export interface SeasonState {
  year: number;
  currentDay: number;
  totalDays: number;
  schedule: ScheduledGame[];
  standings: StandingsTracker;
  userTeamId: string;
  phase: 'preseason' | 'regular' | 'postseason' | 'offseason';
}

/**
 * Manages an entire season: schedule, simulation, standings.
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
    seed: number = Date.now()
  ) {
    this.rng = new RandomProvider(seed);
    this.teams = new Map(teams.map(t => [t.id, t]));
    this.leagueStructure = leagueStructure;

    const schedule = ScheduleGenerator.generate(leagueStructure, this.rng);

    this.state = {
      year: 2026,
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
        continue; // Don't auto-sim user games
      }

      this.simGame(game);
    }

    // Check if season is over
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

  private isSameDivision(teamA: string, teamB: string): boolean {
    for (const divisions of Object.values(this.leagueStructure)) {
      for (const teams of Object.values(divisions)) {
        if (teams.includes(teamA) && teams.includes(teamB)) return true;
      }
    }
    return false;
  }
}
