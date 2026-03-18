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
    const al = qualifiers.filter(q => q.league === 'AL').sort((a, b) => a.seed - b.seed);
    const nl = qualifiers.filter(q => q.league === 'NL').sort((a, b) => a.seed - b.seed);

    const alDivWinners = al.filter(q => !q.isWildCard);
    const alWildCards = al.filter(q => q.isWildCard);
    const nlDivWinners = nl.filter(q => !q.isWildCard);
    const nlWildCards = nl.filter(q => q.isWildCard);

    // Wild Card: #3 div winner vs #2 WC (lower seed hosts), #2 div winner vs #1 WC
    this.matchups.push(this.createSeries(
      'wc-al-1', 'wildcard', 'AL',
      alDivWinners[2]?.teamId ?? '', alWildCards[1]?.teamId ?? '', 2
    ));
    this.matchups.push(this.createSeries(
      'wc-al-2', 'wildcard', 'AL',
      alDivWinners[1]?.teamId ?? '', alWildCards[0]?.teamId ?? '', 2
    ));
    this.matchups.push(this.createSeries(
      'wc-nl-1', 'wildcard', 'NL',
      nlDivWinners[2]?.teamId ?? '', nlWildCards[1]?.teamId ?? '', 2
    ));
    this.matchups.push(this.createSeries(
      'wc-nl-2', 'wildcard', 'NL',
      nlDivWinners[1]?.teamId ?? '', nlWildCards[0]?.teamId ?? '', 2
    ));

    // Division Series: placeholders, filled after WC round
    // ds-al-1: #1 seed AL vs WC winner from wc-al-1
    // ds-al-2: WC winner from wc-al-2 vs other WC survivor
    this.matchups.push(this.createSeries('ds-al-1', 'division', 'AL', alDivWinners[0]?.teamId ?? '', '', 3));
    this.matchups.push(this.createSeries('ds-al-2', 'division', 'AL', '', '', 3));
    this.matchups.push(this.createSeries('ds-nl-1', 'division', 'NL', nlDivWinners[0]?.teamId ?? '', '', 3));
    this.matchups.push(this.createSeries('ds-nl-2', 'division', 'NL', '', '', 3));

    // Championship Series placeholders
    this.matchups.push(this.createSeries('cs-al', 'championship', 'AL', '', '', 4));
    this.matchups.push(this.createSeries('cs-nl', 'championship', 'NL', '', '', 4));

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
    const wcAl1 = this.getMatchup('wc-al-1');
    const wcAl2 = this.getMatchup('wc-al-2');
    const wcNl1 = this.getMatchup('wc-nl-1');
    const wcNl2 = this.getMatchup('wc-nl-2');
    const dsAl1 = this.getMatchup('ds-al-1');
    const dsAl2 = this.getMatchup('ds-al-2');
    const dsNl1 = this.getMatchup('ds-nl-1');
    const dsNl2 = this.getMatchup('ds-nl-2');

    // ds-al-1: #1 seed vs winner of wc-al-1
    if (dsAl1 && wcAl1?.winner) dsAl1.teamBId = wcAl1.winner;
    // ds-al-2: winner of wc-al-2 vs winner of wc-al-1 (or just fill the empty slot)
    if (dsAl2) {
      dsAl2.teamAId = wcAl2?.winner ?? '';
      dsAl2.teamBId = wcAl1?.winner ?? dsAl1?.teamBId ?? '';
      // avoid duplicate: ds-al-1 already has wc-al-1 winner; give ds-al-2 wc-al-2 winner
      if (dsAl2.teamBId === dsAl1?.teamBId) {
        dsAl2.teamBId = ''; // will remain a bye effectively
      }
      dsAl2.teamAId = wcAl2?.winner ?? '';
      dsAl2.teamBId = wcAl1?.winner ? '' : ''; // ds-al-2 matchup will be wc survivors
      // Simplify: ds-al-2 is wc-al-2 winner (high seed) vs wc-al-1 winner was taken by ds-al-1
      // Actually just set to: top WC gets #1 seed matchup (ds-al-1), lower WC gets other
      dsAl2.teamAId = wcAl2?.winner ?? '';
      dsAl2.teamBId = ''; // no opponent — this gets filled from ds-al-1 structure
    }

    if (dsNl1 && wcNl1?.winner) dsNl1.teamBId = wcNl1.winner;
    if (dsNl2) {
      dsNl2.teamAId = wcNl2?.winner ?? '';
      dsNl2.teamBId = '';
    }
  }

  private fillChampionshipSeries(): void {
    const dsAl1 = this.getMatchup('ds-al-1');
    const dsAl2 = this.getMatchup('ds-al-2');
    const dsNl1 = this.getMatchup('ds-nl-1');
    const dsNl2 = this.getMatchup('ds-nl-2');
    const csAl = this.getMatchup('cs-al');
    const csNl = this.getMatchup('cs-nl');

    if (csAl) {
      csAl.teamAId = dsAl1?.winner ?? '';
      csAl.teamBId = dsAl2?.winner ?? '';
    }
    if (csNl) {
      csNl.teamAId = dsNl1?.winner ?? '';
      csNl.teamBId = dsNl2?.winner ?? '';
    }
  }

  private fillWorldSeries(): void {
    const csAl = this.getMatchup('cs-al');
    const csNl = this.getMatchup('cs-nl');
    const ws = this.getMatchup('ws');

    if (ws) {
      ws.teamAId = csAl?.winner ?? '';
      ws.teamBId = csNl?.winner ?? '';
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
