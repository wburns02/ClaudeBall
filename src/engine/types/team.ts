import type { Player } from './player.ts';
import type { Position } from './enums.ts';

export interface TeamRoster {
  players: Player[];
}

export interface LineupSpot {
  playerId: string;
  position: Position;
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  roster: TeamRoster;
  lineup: LineupSpot[];     // 9 batting order spots
  pitcherId: string;        // starting pitcher
  bullpen: string[];        // player IDs available to pitch
}

export function getPlayer(team: Team, id: string): Player | undefined {
  return team.roster.players.find(p => p.id === id);
}

export function getLineupPlayer(team: Team, orderIndex: number): Player | undefined {
  const spot = team.lineup[orderIndex];
  if (!spot) return undefined;
  return getPlayer(team, spot.playerId);
}
