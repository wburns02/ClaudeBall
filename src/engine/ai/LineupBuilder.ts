import type { Team, Player, Position } from '../types/index.ts';
import type { LineupSpot } from '../types/team.ts';

const POSITION_ORDER: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

/**
 * Constructs an optimal batting order from a roster.
 * MLB-realistic batting order philosophy:
 * 1. Leadoff: best speed + eye (OBP focus)
 * 2. #2: high contact + speed (moves runners, gets on base)
 * 3. #3: best overall hitter (contact + power + eye)
 * 4. #4 (cleanup): most power
 * 5. #5: second-best power hitter
 * 6. #6: solid contact hitter
 * 7-8: weaker offensive players (lower OBP/power)
 * 9: pitcher or weakest hitter
 */
export class LineupBuilder {
  static buildLineup(team: Team): LineupSpot[] {
    const roster = team.roster.players;
    const pitcher = roster.find(p => p.id === team.pitcherId);
    const positionPlayers = roster.filter(p => p.id !== team.pitcherId && p.position !== 'P');

    // Assign fielding positions
    const assigned = this.assignPositions(positionPlayers);

    // Sort by overall batting value descending (best to worst)
    const sorted = [...assigned].sort((a, b) => {
      return this.battingValue(b.player) - this.battingValue(a.player);
    });

    const lineup: LineupSpot[] = [];

    // #1 Leadoff: best on-base + speed (OBP proxy = eye + avg contact)
    const leadoffIdx = this.findBest(sorted, p =>
      p.batting.speed * 1.2 + p.batting.eye * 1.1 + (p.batting.contact_L + p.batting.contact_R) / 2 * 0.5
    );
    lineup.push(this.spotFromAssigned(sorted, leadoffIdx));
    sorted.splice(leadoffIdx, 1);

    // #2: high contact + speed (protects leadoff, moves runners)
    const twoIdx = this.findBest(sorted, p =>
      (p.batting.contact_L + p.batting.contact_R) / 2 * 1.0 + p.batting.speed * 0.6 + p.batting.eye * 0.5
    );
    lineup.push(this.spotFromAssigned(sorted, twoIdx));
    sorted.splice(twoIdx, 1);

    // #3: best overall hitter (highest combined batting value)
    const threeIdx = this.findBest(sorted, p => this.battingValue(p));
    lineup.push(this.spotFromAssigned(sorted, threeIdx));
    sorted.splice(threeIdx, 1);

    // #4 Cleanup: most power
    const fourIdx = this.findBest(sorted, p =>
      (p.batting.power_L + p.batting.power_R) / 2 * 1.5 + p.batting.clutch * 0.3
    );
    lineup.push(this.spotFromAssigned(sorted, fourIdx));
    sorted.splice(fourIdx, 1);

    // #5: second power hitter
    const fiveIdx = this.findBest(sorted, p =>
      (p.batting.power_L + p.batting.power_R) / 2 * 1.2 + (p.batting.contact_L + p.batting.contact_R) / 2 * 0.4
    );
    lineup.push(this.spotFromAssigned(sorted, fiveIdx));
    sorted.splice(fiveIdx, 1);

    // #6: solid contact, decent power
    const sixIdx = this.findBest(sorted, p => this.battingValue(p));
    lineup.push(this.spotFromAssigned(sorted, sixIdx));
    sorted.splice(sixIdx, 1);

    // #7-8: remaining position players in descending batting value order
    // (sorted is already descending by battingValue, just take from front)
    for (let i = 0; i < 2 && sorted.length > 0; i++) {
      // Take the best remaining
      const idx = this.findBest(sorted, p => this.battingValue(p));
      lineup.push(this.spotFromAssigned(sorted, idx));
      sorted.splice(idx, 1);
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
