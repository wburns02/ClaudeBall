import type { Team, Player, Position } from '../types/index.ts';
import type { LineupSpot } from '../types/team.ts';

const POSITION_ORDER: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

/**
 * Constructs an optimal batting order from a roster.
 * Uses a simple OPS-proxy heuristic:
 * 1. Leadoff: highest speed + eye
 * 2. #2: high contact + speed
 * 3. #3: best overall hitter (contact + power)
 * 4. #4 (cleanup): most power
 * 5-6: next best power
 * 7-8: remaining
 * 9: pitcher/weakest
 */
export class LineupBuilder {
  static buildLineup(team: Team): LineupSpot[] {
    const roster = team.roster.players;
    const pitcher = roster.find(p => p.id === team.pitcherId);
    const positionPlayers = roster.filter(p => p.id !== team.pitcherId && p.position !== 'P');

    // Assign fielding positions
    const assigned = this.assignPositions(positionPlayers);

    // Sort by batting value
    const sorted = [...assigned].sort((a, b) => {
      return this.battingValue(b.player) - this.battingValue(a.player);
    });

    // Build lineup
    const lineup: LineupSpot[] = [];

    // Find leadoff: speed + eye
    const leadoffIdx = this.findBest(sorted, p => p.batting.speed + p.batting.eye);
    lineup.push(this.spotFromAssigned(sorted, leadoffIdx));
    sorted.splice(leadoffIdx, 1);

    // #2: contact + speed
    const twoIdx = this.findBest(sorted, p => p.batting.contact_R + p.batting.contact_L + p.batting.speed);
    lineup.push(this.spotFromAssigned(sorted, twoIdx));
    sorted.splice(twoIdx, 1);

    // #3: best overall
    const threeIdx = this.findBest(sorted, p => this.battingValue(p) * 1.2);
    lineup.push(this.spotFromAssigned(sorted, threeIdx));
    sorted.splice(threeIdx, 1);

    // #4: cleanup - most power
    const fourIdx = this.findBest(sorted, p => p.batting.power_R + p.batting.power_L);
    lineup.push(this.spotFromAssigned(sorted, fourIdx));
    sorted.splice(fourIdx, 1);

    // #5-8: remaining in order of batting value
    for (let i = 0; i < 4 && sorted.length > 0; i++) {
      lineup.push(this.spotFromAssigned(sorted, 0));
      sorted.shift();
    }

    // #9: pitcher
    if (pitcher) {
      lineup.push({ playerId: pitcher.id, position: 'P' });
    }

    return lineup;
  }

  private static assignPositions(players: Player[]): { player: Player; position: Position }[] {
    const result: { player: Player; position: Position }[] = [];
    const usedPositions = new Set<Position>();
    const usedPlayers = new Set<string>();

    // First pass: assign players to their primary position
    for (const pos of POSITION_ORDER) {
      const candidates = players.filter(p =>
        !usedPlayers.has(p.id) &&
        p.position === pos
      );
      if (candidates.length > 0) {
        const best = candidates[0];
        result.push({ player: best, position: pos });
        usedPositions.add(pos);
        usedPlayers.add(best.id);
      }
    }

    // Second pass: fill remaining positions
    for (const pos of POSITION_ORDER) {
      if (usedPositions.has(pos)) continue;
      const candidate = players.find(p => !usedPlayers.has(p.id));
      if (candidate) {
        result.push({ player: candidate, position: pos });
        usedPositions.add(pos);
        usedPlayers.add(candidate.id);
      }
    }

    return result;
  }

  private static battingValue(p: Player): number {
    return (p.batting.contact_R + p.batting.contact_L) / 2
      + (p.batting.power_R + p.batting.power_L) / 2
      + p.batting.eye * 0.8;
  }

  private static findBest(arr: { player: Player; position: Position }[], scoreFn: (p: Player) => number): number {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < arr.length; i++) {
      const score = scoreFn(arr[i].player);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private static spotFromAssigned(arr: { player: Player; position: Position }[], idx: number): LineupSpot {
    return { playerId: arr[idx].player.id, position: arr[idx].position };
  }
}
