export interface TeamRecord {
  teamId: string;
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  streak: number;        // positive = W streak, negative = L streak
  last10: ('W' | 'L')[];
  divisionWins: number;
  divisionLosses: number;
  homeWins: number;
  homeLosses: number;
  awayWins: number;
  awayLosses: number;
}

export interface DivisionStandings {
  league: string;
  division: string;
  teams: TeamRecord[];
}

export function createTeamRecord(teamId: string): TeamRecord {
  return {
    teamId, wins: 0, losses: 0, runsScored: 0, runsAllowed: 0,
    streak: 0, last10: [], divisionWins: 0, divisionLosses: 0,
    homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0,
  };
}

/**
 * Tracks win/loss records and standings across a season.
 */
export class StandingsTracker {
  private records: Map<string, TeamRecord>;
  private leagueStructure: Record<string, Record<string, string[]>>;

  constructor(leagueStructure: Record<string, Record<string, string[]>>) {
    this.leagueStructure = leagueStructure;
    this.records = new Map();

    for (const divisions of Object.values(leagueStructure)) {
      for (const teams of Object.values(divisions)) {
        for (const teamId of teams) {
          this.records.set(teamId, createTeamRecord(teamId));
        }
      }
    }
  }

  recordGame(awayId: string, homeId: string, awayScore: number, homeScore: number, isDivisionGame: boolean): void {
    const away = this.records.get(awayId);
    const home = this.records.get(homeId);
    if (!away || !home) return;

    const awayWon = awayScore > homeScore;

    // Away team
    away.runsScored += awayScore;
    away.runsAllowed += homeScore;
    if (awayWon) {
      away.wins++;
      away.awayWins++;
      away.streak = away.streak > 0 ? away.streak + 1 : 1;
      if (isDivisionGame) away.divisionWins++;
    } else {
      away.losses++;
      away.awayLosses++;
      away.streak = away.streak < 0 ? away.streak - 1 : -1;
      if (isDivisionGame) away.divisionLosses++;
    }
    away.last10.push(awayWon ? 'W' : 'L');
    if (away.last10.length > 10) away.last10.shift();

    // Home team
    home.runsScored += homeScore;
    home.runsAllowed += awayScore;
    if (!awayWon) {
      home.wins++;
      home.homeWins++;
      home.streak = home.streak > 0 ? home.streak + 1 : 1;
      if (isDivisionGame) home.divisionWins++;
    } else {
      home.losses++;
      home.homeLosses++;
      home.streak = home.streak < 0 ? home.streak - 1 : -1;
      if (isDivisionGame) home.divisionLosses++;
    }
    home.last10.push(!awayWon ? 'W' : 'L');
    if (home.last10.length > 10) home.last10.shift();
  }

  getRecord(teamId: string): TeamRecord | undefined {
    return this.records.get(teamId);
  }

  getDivisionStandings(): DivisionStandings[] {
    const standings: DivisionStandings[] = [];

    for (const [league, divisions] of Object.entries(this.leagueStructure)) {
      for (const [division, teamIds] of Object.entries(divisions)) {
        const teams = teamIds
          .map(id => this.records.get(id)!)
          .filter(Boolean)
          .sort((a, b) => {
            const aPct = a.wins + a.losses === 0 ? 0 : a.wins / (a.wins + a.losses);
            const bPct = b.wins + b.losses === 0 ? 0 : b.wins / (b.wins + b.losses);
            if (bPct !== aPct) return bPct - aPct;
            return (b.runsScored - b.runsAllowed) - (a.runsScored - a.runsAllowed);
          });

        standings.push({ league, division, teams });
      }
    }

    return standings;
  }

  getLeagueRankings(league: string): TeamRecord[] {
    const teams: TeamRecord[] = [];
    const divisions = this.leagueStructure[league];
    if (!divisions) return teams;

    for (const teamIds of Object.values(divisions)) {
      for (const id of teamIds) {
        const record = this.records.get(id);
        if (record) teams.push(record);
      }
    }

    return teams.sort((a, b) => {
      const aPct = a.wins + a.losses === 0 ? 0 : a.wins / (a.wins + a.losses);
      const bPct = b.wins + b.losses === 0 ? 0 : b.wins / (b.wins + b.losses);
      return bPct - aPct;
    });
  }

  getAllRecords(): TeamRecord[] {
    return Array.from(this.records.values());
  }
}

export function winPct(r: TeamRecord): string {
  const total = r.wins + r.losses;
  return total === 0 ? '.000' : (r.wins / total).toFixed(3).replace(/^0/, '');
}

export function gamesBehind(leader: TeamRecord, team: TeamRecord): string {
  const gb = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
  if (gb === 0) return '—';
  return gb.toFixed(1).replace('.0', '');
}

export function runDifferential(r: TeamRecord): string {
  const diff = r.runsScored - r.runsAllowed;
  return diff >= 0 ? `+${diff}` : `${diff}`;
}

export function streakStr(r: TeamRecord): string {
  if (r.streak === 0) return '—';
  return r.streak > 0 ? `W${r.streak}` : `L${Math.abs(r.streak)}`;
}

export function last10Str(r: TeamRecord): string {
  const w = r.last10.filter(x => x === 'W').length;
  const l = r.last10.length - w;
  return `${w}-${l}`;
}
