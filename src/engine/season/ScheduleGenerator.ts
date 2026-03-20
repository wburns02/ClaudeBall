import type { RandomProvider } from '../core/RandomProvider.ts';

export interface ScheduledGame {
  id: string;
  gameNumber: number;
  awayId: string;
  homeId: string;
  date: number;       // day of season (1-183)
  played: boolean;
  awayScore?: number;
  homeScore?: number;
  awayInnings?: number[];  // runs per inning, away team
  homeInnings?: number[];  // runs per inning, home team
}

/**
 * Generates a 162-game schedule for a 30-team league.
 *
 * Structure: 2 leagues × 3 divisions × 5 teams.
 * - 76 games vs division rivals (19 each × 4 opponents)
 * - 66 games vs same-league non-division (6-7 each × 10 opponents)
 * - 20 games vs interleague (various opponents)
 */
export class ScheduleGenerator {
  static generate(
    leagueStructure: Record<string, Record<string, string[]>>,
    rng: RandomProvider
  ): ScheduledGame[] {
    const allTeams: string[] = [];
    const teamLeague = new Map<string, string>();
    const teamDivision = new Map<string, string>();

    for (const [league, divisions] of Object.entries(leagueStructure)) {
      for (const [division, teams] of Object.entries(divisions)) {
        for (const teamId of teams) {
          allTeams.push(teamId);
          teamLeague.set(teamId, league);
          teamDivision.set(teamId, `${league}-${division}`);
        }
      }
    }

    const matchups: Array<{ away: string; home: string }> = [];

    // Division games: 19 per opponent = 76 total
    for (const [league, divisions] of Object.entries(leagueStructure)) {
      for (const [_division, teams] of Object.entries(divisions)) {
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            // 19 games: 10 home, 9 away (or vice versa, randomized)
            const aHome = rng.chance(0.5) ? 10 : 9;
            const bHome = 19 - aHome;
            for (let g = 0; g < aHome; g++) matchups.push({ away: teams[j], home: teams[i] });
            for (let g = 0; g < bHome; g++) matchups.push({ away: teams[i], home: teams[j] });
            void league; // used in outer loop
          }
        }
      }
    }

    // Same league, different division: ~66 games (6-7 per opponent)
    for (const teamId of allTeams) {
      const league = teamLeague.get(teamId)!;
      const div = teamDivision.get(teamId)!;
      const opponents = allTeams.filter(t =>
        teamLeague.get(t) === league && teamDivision.get(t) !== div
      );

      for (const opp of opponents) {
        if (teamId >= opp) continue; // avoid duplicates
        const games = rng.chance(0.5) ? 7 : 6;
        const homeGames = Math.ceil(games / 2);
        const awayGames = games - homeGames;
        for (let g = 0; g < homeGames; g++) matchups.push({ away: opp, home: teamId });
        for (let g = 0; g < awayGames; g++) matchups.push({ away: teamId, home: opp });
      }
    }

    // Interleague: fill remaining to get close to 162 per team
    const gameCounts = new Map<string, number>();
    for (const teamId of allTeams) gameCounts.set(teamId, 0);
    for (const m of matchups) {
      gameCounts.set(m.away, (gameCounts.get(m.away) || 0) + 1);
      gameCounts.set(m.home, (gameCounts.get(m.home) || 0) + 1);
    }

    // Add interleague games for teams under 162
    const leagues = Object.keys(leagueStructure);
    if (leagues.length >= 2) {
      const league1Teams = allTeams.filter(t => teamLeague.get(t) === leagues[0]);
      const league2Teams = allTeams.filter(t => teamLeague.get(t) === leagues[1]);

      for (const t1 of league1Teams) {
        for (const t2 of league2Teams) {
          const t1Count = gameCounts.get(t1) || 0;
          const t2Count = gameCounts.get(t2) || 0;
          if (t1Count >= 162 || t2Count >= 162) continue;

          const games = rng.nextInt(2, 3);
          for (let g = 0; g < games; g++) {
            if ((gameCounts.get(t1) || 0) >= 162 || (gameCounts.get(t2) || 0) >= 162) break;
            const isHome = rng.chance(0.5);
            matchups.push(isHome ? { away: t2, home: t1 } : { away: t1, home: t2 });
            gameCounts.set(t1, (gameCounts.get(t1) || 0) + 1);
            gameCounts.set(t2, (gameCounts.get(t2) || 0) + 1);
          }
        }
      }
    }

    // Shuffle and assign dates (183 day season, ~15 games per day across league)
    const shuffled = matchups.sort(() => rng.next() - 0.5);
    const gamesPerDay = Math.ceil(shuffled.length / 183);

    const schedule: ScheduledGame[] = shuffled.map((m, i) => ({
      id: `game-${i}`,
      gameNumber: i + 1,
      awayId: m.away,
      homeId: m.home,
      date: Math.min(183, Math.floor(i / gamesPerDay) + 1),
      played: false,
    }));

    return schedule;
  }
}
