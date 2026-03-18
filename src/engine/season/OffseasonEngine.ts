import type { Player, Team } from '../types/index.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import type { TeamRecord } from './StandingsTracker.ts';
import type { SeasonState } from './SeasonEngine.ts'; // used by advanceYear
import { getPlayerName } from '../types/player.ts';

export type AwardType = 'MVP' | 'CyYoung' | 'ROY';

export interface Award {
  type: AwardType;
  league: string; // actual league name from leagueStructure (e.g. 'American', 'National')
  playerId: string;
  playerName: string;
  teamId: string;
  value: number; // the stat that won the award (WAR-ish for MVP, ERA for CY, etc.)
}

export interface RetirementInfo {
  playerId: string;
  playerName: string;
  age: number;
  teamId: string;
}

export interface OffseasonResult {
  awards: Award[];
  retirements: RetirementInfo[];
  agingCount: number;
}

/**
 * Handles end-of-season: awards, aging, retirements, free agent pool building.
 */
export class OffseasonEngine {
  /**
   * Generate MVP, Cy Young, and Rookie of the Year for each league.
   */
  static generateAwards(
    standings: Map<string, TeamRecord>,
    allTeams: Team[],
    leagueStructure: Record<string, Record<string, string[]>>
  ): Award[] {
    const awards: Award[] = [];

    for (const [league, divisions] of Object.entries(leagueStructure)) {
      const leagueTeamIds = new Set<string>();
      for (const teamIds of Object.values(divisions)) {
        for (const id of teamIds) leagueTeamIds.add(id);
      }

      const leagueTeams = allTeams.filter(t => leagueTeamIds.has(t.id));
      const lc = league;

      // MVP: best non-pitcher by (contact + power + eye + speed) / 4 * win contribution
      let mvpPlayer: Player | null = null;
      let mvpTeamId = '';
      let mvpScore = -Infinity;

      // Cy Young: best pitcher by (stuff + movement + control) / 3
      let cyPlayer: Player | null = null;
      let cyTeamId = '';
      let cyScore = -Infinity;

      // ROY: best player age <= 26 by combined score
      let royPlayer: Player | null = null;
      let royTeamId = '';
      let royScore = -Infinity;

      for (const team of leagueTeams) {
        const rec = standings.get(team.id);
        const winBonus = rec ? rec.wins / 162 : 0;

        for (const player of team.roster.players) {
          const isPitcher = player.position === 'P';

          if (isPitcher) {
            const cyVal = (player.pitching.stuff + player.pitching.movement + player.pitching.control) / 3;
            const adjusted = cyVal * (1 + winBonus * 0.1);
            if (adjusted > cyScore) {
              cyScore = adjusted;
              cyPlayer = player;
              cyTeamId = team.id;
            }
          } else {
            const b = player.batting;
            const offScore = (
              (b.contact_L + b.contact_R) / 2 * 0.3 +
              (b.power_L + b.power_R) / 2 * 0.25 +
              b.eye * 0.2 +
              b.speed * 0.1 +
              b.clutch * 0.15
            );
            const adjusted = offScore * (1 + winBonus * 0.2);

            if (adjusted > mvpScore) {
              mvpScore = adjusted;
              mvpPlayer = player;
              mvpTeamId = team.id;
            }

            if (player.age <= 26 && adjusted > royScore) {
              royScore = adjusted;
              royPlayer = player;
              royTeamId = team.id;
            }
          }
        }
      }

      if (mvpPlayer) {
        awards.push({
          type: 'MVP',
          league: lc,
          playerId: mvpPlayer.id,
          playerName: getPlayerName(mvpPlayer),
          teamId: mvpTeamId,
          value: Math.round(mvpScore * 10) / 10,
        });
      }

      if (cyPlayer) {
        awards.push({
          type: 'CyYoung',
          league: lc,
          playerId: cyPlayer.id,
          playerName: getPlayerName(cyPlayer),
          teamId: cyTeamId,
          value: Math.round(cyScore * 10) / 10,
        });
      }

      if (royPlayer && royPlayer !== mvpPlayer) {
        awards.push({
          type: 'ROY',
          league: lc,
          playerId: royPlayer.id,
          playerName: getPlayerName(royPlayer),
          teamId: royTeamId,
          value: Math.round(royScore * 10) / 10,
        });
      }
    }

    return awards;
  }

  /**
   * Age all players +1 year. Retire players age 37+ with probability,
   * or any player 40+. Returns retirement list.
   */
  static runOffseason(teams: Team[], rng: RandomProvider): OffseasonResult {
    const retirements: RetirementInfo[] = [];
    let agingCount = 0;

    for (const team of teams) {
      const toRetire: string[] = [];

      for (const player of team.roster.players) {
        player.age += 1;
        agingCount++;

        // Retirement probability:
        // age 37: 15%, 38: 25%, 39: 40%, 40+: 65%
        const age = player.age;
        let retireProbability = 0;
        if (age >= 40) retireProbability = 0.65;
        else if (age === 39) retireProbability = 0.40;
        else if (age === 38) retireProbability = 0.25;
        else if (age === 37) retireProbability = 0.15;

        if (retireProbability > 0 && rng.chance(retireProbability)) {
          retirements.push({
            playerId: player.id,
            playerName: getPlayerName(player),
            age: player.age,
            teamId: team.id,
          });
          toRetire.push(player.id);
        }
      }

      // Remove retired players
      team.roster.players = team.roster.players.filter(p => !toRetire.includes(p.id));

      // Clean up lineup / bullpen references for retired players
      team.lineup = team.lineup.filter(s => !toRetire.includes(s.playerId));
      team.bullpen = team.bullpen.filter(id => !toRetire.includes(id));
      if (toRetire.includes(team.pitcherId)) {
        const newSP = team.roster.players.find(p => p.position === 'P');
        team.pitcherId = newSP?.id ?? '';
      }

      // Reset player state for new season
      for (const player of team.roster.players) {
        player.state.fatigue = 0;
        player.state.pitchCount = 0;
        player.state.morale = Math.min(100, player.state.morale + 10);
      }
    }

    return { retirements, agingCount, awards: [] };
  }

  /**
   * Increment year and reset season-level fields.
   */
  static advanceYear(seasonState: SeasonState): SeasonState {
    return {
      ...seasonState,
      year: seasonState.year + 1,
      currentDay: 0,
      phase: 'preseason',
      schedule: [],
    };
  }
}

