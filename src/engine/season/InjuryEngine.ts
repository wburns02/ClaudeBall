import type { Player } from '../types/player.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { getPlayerName } from '../types/player.ts';

export type InjurySeverity = 'minor' | 'moderate' | 'severe' | 'season-ending';

export interface InjuryRecord {
  playerId: string;
  playerName: string;
  teamId: string;
  severity: InjurySeverity;
  description: string;
  dayOccurred: number;
  daysOut: number;
  injuredUntilDay: number;
  returned: boolean;
}

export interface InjuryEvent {
  type: 'injury' | 'return';
  record: InjuryRecord;
  message: string;
}

// Daily injury chance per player: 0.2% per game
const BASE_DAILY_INJURY_CHANCE = 0.002;

// Severity weights (base): minor, moderate, severe, season-ending
const SEVERITY_DAYS: Record<InjurySeverity, { min: number; max: number; label: string }> = {
  minor:          { min: 1,  max: 3,  label: 'Minor strain' },
  moderate:       { min: 7,  max: 21, label: 'Moderate injury' },
  severe:         { min: 30, max: 90, label: 'Severe injury' },
  'season-ending':{ min: 183, max: 183, label: 'Season-ending injury' },
};

const INJURY_DESCRIPTIONS: Record<InjurySeverity, string[]> = {
  minor: [
    'Hamstring tightness', 'Blister on pitching hand', 'Mild ankle sprain',
    'Finger soreness', 'Back tightness', 'Knee bruise',
  ],
  moderate: [
    'Oblique strain', 'Shoulder inflammation', 'Groin strain',
    'Quad strain', 'Calf strain', 'Forearm tightness',
  ],
  severe: [
    'UCL sprain', 'Hamstring tear', 'Knee ligament sprain',
    'Shoulder labrum tear', 'Fractured hand', 'Stress fracture',
  ],
  'season-ending': [
    'Tommy John surgery', 'ACL tear', 'Torn rotator cuff',
    'Season-ending shoulder surgery', 'Broken wrist (surgery required)',
  ],
};

/**
 * InjuryEngine — handles daily injury rolls, return tracking, and notifications.
 */
export class InjuryEngine {
  private injuries: InjuryRecord[] = [];
  private events: InjuryEvent[] = [];

  /**
   * Roll injury checks for all active (non-injured) players on all teams.
   * Returns new injury events that occurred today.
   */
  rollDailyInjuries(
    teams: Map<string, { id: string; roster: { players: Player[] } }>,
    currentDay: number,
    rng: RandomProvider,
  ): InjuryEvent[] {
    const newEvents: InjuryEvent[] = [];

    for (const team of teams.values()) {
      for (const player of team.roster.players) {
        if (player.state.isInjured) continue;

        const injured = this.rollPlayerInjury(player, team.id, currentDay, rng);
        if (injured) {
          newEvents.push(injured);
          this.events.push(injured);
          // Mutate player state directly (same pattern used elsewhere in engine)
          player.state.isInjured = true;
          player.state.fatigue = injured.record.daysOut; // reuse fatigue as days remaining
        }
      }
    }

    return newEvents;
  }

  /**
   * Check for player returns at the start of a new day.
   * Returns return events for players whose injuredUntilDay has passed.
   */
  checkReturns(
    teams: Map<string, { id: string; roster: { players: Player[] } }>,
    currentDay: number,
  ): InjuryEvent[] {
    const returnEvents: InjuryEvent[] = [];

    for (const record of this.injuries) {
      if (record.returned) continue;
      if (currentDay < record.injuredUntilDay) continue;
      // Season-ending: never return during season
      if (record.severity === 'season-ending') continue;

      // Find the player
      const team = teams.get(record.teamId);
      if (!team) continue;
      const player = team.roster.players.find(p => p.id === record.playerId);
      if (!player) continue;

      record.returned = true;
      player.state.isInjured = false;
      player.state.fatigue = 0;

      const event: InjuryEvent = {
        type: 'return',
        record,
        message: `${record.playerName} has returned from a ${record.severity} injury.`,
      };
      returnEvents.push(event);
      this.events.push(event);
    }

    return returnEvents;
  }

  /** Get all current injuries (not yet returned) */
  getActiveInjuries(): InjuryRecord[] {
    return this.injuries.filter(r => !r.returned && r.severity !== 'season-ending');
  }

  /** Get all injuries including returned and season-ending */
  getAllInjuries(): InjuryRecord[] {
    return [...this.injuries];
  }

  /** Get injuries for a specific team */
  getTeamInjuries(teamId: string): InjuryRecord[] {
    return this.injuries.filter(r => r.teamId === teamId);
  }

  /** Get all events (injuries + returns) */
  getEvents(): InjuryEvent[] {
    return [...this.events];
  }

  // ---- Private ----

  private rollPlayerInjury(
    player: Player,
    teamId: string,
    currentDay: number,
    rng: RandomProvider,
  ): InjuryEvent | null {
    const durability = player.mental.durability / 100; // 0–1
    // High durability reduces chance; range: 0.001 (dur=100) to 0.004 (dur=0)
    const chance = BASE_DAILY_INJURY_CHANCE * (2 - durability);

    if (!rng.chance(chance)) return null;

    // Severity weighted: high durability skews toward minor
    const severities: InjurySeverity[] = ['minor', 'moderate', 'severe', 'season-ending'];
    const weights = [
      50 + Math.round(durability * 20),  // minor: 50–70
      30,                                  // moderate: 30
      15 - Math.round(durability * 8),    // severe: 7–15
      5  - Math.round(durability * 3),    // season-ending: 2–5
    ].map(w => Math.max(1, w));

    const severity = rng.weightedPick(severities, weights);
    const range = SEVERITY_DAYS[severity];
    const daysOut = severity === 'season-ending'
      ? 183 - currentDay + 1  // rest of season
      : rng.nextInt(range.min, range.max);
    const injuredUntilDay = currentDay + daysOut;

    const descriptions = INJURY_DESCRIPTIONS[severity];
    const description = rng.pick(descriptions);

    const record: InjuryRecord = {
      playerId: player.id,
      playerName: getPlayerName(player),
      teamId,
      severity,
      description,
      dayOccurred: currentDay,
      daysOut,
      injuredUntilDay,
      returned: false,
    };

    this.injuries.push(record);

    return {
      type: 'injury',
      record,
      message: `${getPlayerName(player)} suffered a ${severity} injury: ${description} (${daysOut} days).`,
    };
  }
}
