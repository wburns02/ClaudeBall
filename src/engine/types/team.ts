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
  lineup: LineupSpot[];         // 9 batting order spots (mutable during game for PH)
  pitcherId: string;            // current pitcher
  bullpen: string[];            // player IDs available to pitch (not yet used)
  bench?: string[];             // position player IDs not in starting lineup
  usedPitchers?: string[];      // pitchers who have already appeared (can't re-enter)
  rotation?: string[];          // 5-man starter rotation (player IDs)
  rotationIndex?: number;       // which starter is up next
  /** Per-pitcher rest days remaining (keyed by player ID) */
  pitcherRestDays?: Record<string, number>;
}

export function getPlayer(team: Team, id: string): Player | undefined {
  return team.roster.players.find(p => p.id === id);
}

export function getLineupPlayer(team: Team, orderIndex: number): Player | undefined {
  const spot = team.lineup[orderIndex];
  if (!spot) return undefined;
  return getPlayer(team, spot.playerId);
}

/** Return players on the bench (not in lineup, not pitchers) */
export function getBenchPlayers(team: Team): Player[] {
  if (!team.bench || team.bench.length === 0) return [];
  return team.bench
    .map(id => getPlayer(team, id))
    .filter((p): p is Player => p !== undefined);
}

/** Return available relievers (in bullpen, not yet used, not current pitcher) */
export function getAvailableRelievers(team: Team): Player[] {
  const used = new Set(team.usedPitchers ?? []);
  return team.bullpen
    .filter(id => id !== team.pitcherId && !used.has(id))
    .map(id => getPlayer(team, id))
    .filter((p): p is Player => p !== undefined);
}
