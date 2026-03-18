import type { Team } from '../types/index.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { QuickSimEngine } from './QuickSimEngine.ts';
import type { TeamRecord } from './StandingsTracker.ts';
import { createTeamRecord } from './StandingsTracker.ts';

export interface SeriesMatchup {
  id: string;
  round: 'wildcard' | 'division' | 'championship' | 'worldseries';
  league: string | null; // null for World Series
  teamAId: string;
  teamBId: string;
  teamAWins: number;
  teamBWins: number;
  gamesNeeded: number; // 2 = BO3, 3 = BO5, 4 = BO7
  winner: string | null;
  gameLog: Array<{ teamAScore: number; teamBScore: number }>;
}

export interface PlayoffQualifier {
  teamId: string;
  seed: number;
  isWildCard: boolean;
  league: string;
  record: TeamRecord;
}

/**
 * Manages the full MLB-style postseason bracket.
 * 10 teams: 6 division winners + 4 wild cards (2 per league)
 * Rounds: Wild Card (best of 3), Division Series (best of 5),
 *         Championship Series (best of 7), World Series (best of 7)
 */
export class PlayoffBracket {
  private matchups: SeriesMatchup[] = [];
  private currentRound: SeriesMatchup['round'] = 'wildcard';
  private rng: RandomProvider;
  private teams: Map<string, Team>;

  constructor(
    qualifiers: PlayoffQualifier[],
    allTeams: Team[],
    rng: RandomProvider
  ) {
    this.rng = rng;
    this.teams = new Map(allTeams.map(t => [t.id, t]));
    this.buildBracket(qualifiers);
  }

  private buildBracket(qualifiers: PlayoffQualifier[]): void {
    // Get the two league names dynamically from qualifiers
    const leagueNames = [...new Set(qualifiers.map(q => q.league))].sort();
    const league1 = leagueNames[0] ?? 'League1';
    const league2 = leagueNames[1] ?? 'League2';

    const l1q = qualifiers.filter(q => q.league === league1).sort((a, b) => a.seed - b.seed);
    const l2q = qualifiers.filter(q => q.league === league2).sort((a, b) => a.seed - b.seed);

    const l1DivWinners = l1q.filter(q => !q.isWildCard);
    const l1WildCards = l1q.filter(q => q.isWildCard);
    const l2DivWinners = l2q.filter(q => !q.isWildCard);
    const l2WildCards = l2q.filter(q => q.isWildCard);

    // Wild Card: #3 div winner vs #2 WC, #2 div winner vs #1 WC
    this.matchups.push(this.createSeries(
      'wc-l1-1', 'wildcard', league1,
      l1DivWinners[2]?.teamId ?? '', l1WildCards[1]?.teamId ?? '', 2
    ));
    this.matchups.push(this.createSeries(
      'wc-l1-2', 'wildcard', league1,
      l1DivWinners[1]?.teamId ?? '', l1WildCards[0]?.teamId ?? '', 2
    ));
    this.matchups.push(this.createSeries(
      'wc-l2-1', 'wildcard', league2,
      l2DivWinners[2]?.teamId ?? '', l2WildCards[1]?.teamId ?? '', 2
    ));
    this.matchups.push(this.createSeries(
      'wc-l2-2', 'wildcard', league2,
      l2DivWinners[1]?.teamId ?? '', l2WildCards[0]?.teamId ?? '', 2
    ));

    // Division Series: #1 seed vs WC1 winner
    this.matchups.push(this.createSeries('ds-l1-1', 'division', league1, l1DivWinners[0]?.teamId ?? '', '', 3));
    this.matchups.push(this.createSeries('ds-l1-2', 'division', league1, '', '', 3));
    this.matchups.push(this.createSeries('ds-l2-1', 'division', league2, l2DivWinners[0]?.teamId ?? '', '', 3));
    this.matchups.push(this.createSeries('ds-l2-2', 'division', league2, '', '', 3));

    // Championship Series placeholders
    this.matchups.push(this.createSeries('cs-l1', 'championship', league1, '', '', 4));
    this.matchups.push(this.createSeries('cs-l2', 'championship', league2, '', '', 4));

    // World Series placeholder
    this.matchups.push(this.createSeries('ws', 'worldseries', null, '', '', 4));
  }

  private createSeries(
    id: string,
    round: SeriesMatchup['round'],
    league: string | null,
    teamAId: string,
    teamBId: string,
    gamesNeeded: number
  ): SeriesMatchup {
    return {
      id, round, league,
      teamAId, teamBId,
      teamAWins: 0, teamBWins: 0,
      gamesNeeded,
      winner: null,
      gameLog: [],
    };
  }

  /** Simulate a single game between two teams */
  simulateSeriesGame(teamAId: string, teamBId: string): { teamAScore: number; teamBScore: number } {
    const teamA = this.teams.get(teamAId);
    const teamB = this.teams.get(teamBId);
    if (!teamA || !teamB) return { teamAScore: 0, teamBScore: 0 };

    const result = QuickSimEngine.simulate(teamA, teamB, this.rng);
    return { teamAScore: result.awayScore, teamBScore: result.homeScore };
  }

  /** Simulate an entire series until one team wins */
  private simulateSeries(matchup: SeriesMatchup): void {
    if (!matchup.teamAId || !matchup.teamBId) return;

    while (matchup.winner === null) {
      const game = this.simulateSeriesGame(matchup.teamAId, matchup.teamBId);
      matchup.gameLog.push(game);

      if (game.teamAScore > game.teamBScore) {
        matchup.teamAWins++;
      } else {
        matchup.teamBWins++;
      }

      if (matchup.teamAWins > matchup.gamesNeeded) {
        matchup.winner = matchup.teamAId;
      } else if (matchup.teamBWins > matchup.gamesNeeded) {
        matchup.winner = matchup.teamBId;
      }
    }
  }

  /** Simulate all matchups in the current round, then advance bracket state */
  advanceRound(): SeriesMatchup[] {
    const roundMatchups = this.matchups.filter(m => m.round === this.currentRound && m.winner === null);

    for (const matchup of roundMatchups) {
      if (matchup.teamAId && matchup.teamBId) {
        this.simulateSeries(matchup);
      }
    }

    if (this.currentRound === 'wildcard') {
      this.fillDivisionSeries();
      this.currentRound = 'division';
    } else if (this.currentRound === 'division') {
      this.fillChampionshipSeries();
      this.currentRound = 'championship';
    } else if (this.currentRound === 'championship') {
      this.fillWorldSeries();
      this.currentRound = 'worldseries';
    }

    return roundMatchups;
  }

  private fillDivisionSeries(): void {
    const wcL11 = this.getMatchup('wc-l1-1');
    const wcL12 = this.getMatchup('wc-l1-2');
    const wcL21 = this.getMatchup('wc-l2-1');
    const wcL22 = this.getMatchup('wc-l2-2');
    const dsL11 = this.getMatchup('ds-l1-1');
    const dsL12 = this.getMatchup('ds-l1-2');
    const dsL21 = this.getMatchup('ds-l2-1');
    const dsL22 = this.getMatchup('ds-l2-2');

    // DS1: #1 seed vs winner of WC1
    if (dsL11 && wcL11?.winner) dsL11.teamBId = wcL11.winner;
    // DS2: WC2 winner vs WC1 winner (WC1 winner is taken by DS1 so DS2 gets the other survivor)
    if (dsL12 && wcL12?.winner) {
      dsL12.teamAId = wcL12.winner;
      // Find the WC1 loser as opponent? Actually: DS2 = WC2 winner vs WC2 loser...
      // Simplified: DS2 gets WC2 winner as teamA; they play #2 seed or WC1 winner
      // Most accurate: DS2 = wc-l1-2 winner vs wc-l1-1 loser... but we don't track losers
      // Just use the WC2 winner vs whoever wc-l1-1 winner beat (wc-l1-1 teamB = loser)
      dsL12.teamBId = wcL11?.teamBId ?? '';
    }

    if (dsL21 && wcL21?.winner) dsL21.teamBId = wcL21.winner;
    if (dsL22 && wcL22?.winner) {
      dsL22.teamAId = wcL22.winner;
      dsL22.teamBId = wcL21?.teamBId ?? '';
    }
  }

  private fillChampionshipSeries(): void {
    const dsL11 = this.getMatchup('ds-l1-1');
    const dsL12 = this.getMatchup('ds-l1-2');
    const dsL21 = this.getMatchup('ds-l2-1');
    const dsL22 = this.getMatchup('ds-l2-2');
    const csL1 = this.getMatchup('cs-l1');
    const csL2 = this.getMatchup('cs-l2');

    if (csL1) {
      csL1.teamAId = dsL11?.winner ?? '';
      csL1.teamBId = dsL12?.winner ?? '';
    }
    if (csL2) {
      csL2.teamAId = dsL21?.winner ?? '';
      csL2.teamBId = dsL22?.winner ?? '';
    }
  }

  private fillWorldSeries(): void {
    const csL1 = this.getMatchup('cs-l1');
    const csL2 = this.getMatchup('cs-l2');
    const ws = this.getMatchup('ws');

    if (ws) {
      ws.teamAId = csL1?.winner ?? '';
      ws.teamBId = csL2?.winner ?? '';
    }
  }

  private getMatchup(id: string): SeriesMatchup | undefined {
    return this.matchups.find(m => m.id === id);
  }

  getMatchups(): SeriesMatchup[] {
    return this.matchups;
  }

  getMatchupsByRound(round: SeriesMatchup['round']): SeriesMatchup[] {
    return this.matchups.filter(m => m.round === round);
  }

  getCurrentRound(): SeriesMatchup['round'] {
    return this.currentRound;
  }

  isRoundComplete(round: SeriesMatchup['round']): boolean {
    const roundMatchups = this.matchups.filter(m => m.round === round && m.teamAId && m.teamBId);
    return roundMatchups.length > 0 && roundMatchups.every(m => m.winner !== null);
  }

  isComplete(): boolean {
    return this.getMatchup('ws')?.winner != null;
  }

  getChampion(): string | null {
    return this.getMatchup('ws')?.winner ?? null;
  }

  getBracket(): {
    wildcard: SeriesMatchup[];
    division: SeriesMatchup[];
    championship: SeriesMatchup[];
    worldseries: SeriesMatchup[];
  } {
    return {
      wildcard: this.getMatchupsByRound('wildcard'),
      division: this.getMatchupsByRound('division'),
      championship: this.getMatchupsByRound('championship'),
      worldseries: this.getMatchupsByRound('worldseries'),
    };
  }

  getResults(): SeriesMatchup[] {
    return this.matchups.filter(m => m.winner !== null);
  }
}

/**
 * Determine playoff qualifiers from final standings.
 * Returns up to 10 teams: 3 division winners + 2 WCs per league.
 */
export function determinePlayoffQualifiers(
  leagueStructure: Record<string, Record<string, string[]>>,
  getRecord: (teamId: string) => TeamRecord | undefined
): PlayoffQualifier[] {
  const qualifiers: PlayoffQualifier[] = [];

  for (const [league, divisions] of Object.entries(leagueStructure)) {
    const allLeagueTeams: Array<{ teamId: string; record: TeamRecord }> = [];
    const divisionWinnerIds = new Set<string>();

    for (const [, teamIds] of Object.entries(divisions)) {
      let best: { teamId: string; record: TeamRecord } | null = null;

      for (const teamId of teamIds) {
        const rec = getRecord(teamId) ?? createTeamRecord(teamId);
        allLeagueTeams.push({ teamId, record: rec });
        if (!best || rec.wins > best.record.wins) {
          best = { teamId, record: rec };
        }
      }

      if (best) {
        divisionWinnerIds.add(best.teamId);
      }
    }

    // Sort division winners by wins descending
    const divWinners = allLeagueTeams
      .filter(t => divisionWinnerIds.has(t.teamId))
      .sort((a, b) => b.record.wins - a.record.wins);

    // Wild cards: non-winners with most wins
    const wildCards = allLeagueTeams
      .filter(t => !divisionWinnerIds.has(t.teamId))
      .sort((a, b) => b.record.wins - a.record.wins)
      .slice(0, 2);

    divWinners.forEach((dw, i) => {
      qualifiers.push({
        teamId: dw.teamId,
        seed: i + 1,
        isWildCard: false,
        league,
        record: dw.record,
      });
    });

    wildCards.forEach((wc, i) => {
      qualifiers.push({
        teamId: wc.teamId,
        seed: 4 + i,
        isWildCard: true,
        league,
        record: wc.record,
      });
    });
  }

  return qualifiers;
}
