import type { Player } from '../types/player.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { evaluatePlayer } from './TradeEngine.ts';
import { getPlayerName } from '../types/player.ts';

export interface WaiverClaim {
  playerId: string;
  claimingTeamId: string;
  claimDay: number;
}

export interface WaiverPlayer {
  player: Player;
  releasingTeamId: string;
  releasedDay: number;
  claimedBy: string | null;
  claimedDay: number | null;
  expiresDay: number; // released + 3 days
}

export interface WaiverEvent {
  type: 'release' | 'claim' | 'clear';
  player: Player;
  teamId: string;
  message: string;
}

const WAIVER_WINDOW_DAYS = 3;

/**
 * WaiverWire — released players sit on waivers for 3 days.
 * Any team can claim within that window.
 * AI teams claim based on need + player value.
 */
export class WaiverWire {
  private wire: WaiverPlayer[] = [];
  private events: WaiverEvent[] = [];

  /**
   * Place a player on waivers.
   */
  releasePlayer(
    player: Player,
    releasingTeamId: string,
    currentDay: number,
  ): WaiverEvent {
    const entry: WaiverPlayer = {
      player,
      releasingTeamId,
      releasedDay: currentDay,
      claimedBy: null,
      claimedDay: null,
      expiresDay: currentDay + WAIVER_WINDOW_DAYS,
    };
    this.wire.push(entry);

    const event: WaiverEvent = {
      type: 'release',
      player,
      teamId: releasingTeamId,
      message: `${getPlayerName(player)} placed on waivers.`,
    };
    this.events.push(event);
    return event;
  }

  /**
   * User (or AI) claims a waiver player.
   * Returns true if claim succeeded.
   */
  claimPlayer(
    playerId: string,
    claimingTeamId: string,
    claimingRoster: Player[],
    currentDay: number,
  ): WaiverEvent | null {
    const entry = this.wire.find(
      w => w.player.id === playerId && !w.claimedBy && currentDay <= w.expiresDay
    );
    if (!entry) return null;

    entry.claimedBy = claimingTeamId;
    entry.claimedDay = currentDay;
    claimingRoster.push(entry.player);

    const event: WaiverEvent = {
      type: 'claim',
      player: entry.player,
      teamId: claimingTeamId,
      message: `${getPlayerName(entry.player)} claimed off waivers.`,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Process expired waiver claims and AI auto-claims.
   * Call this daily.
   */
  processDailyWaivers(
    teams: Map<string, { id: string; roster: { players: Player[] } }>,
    userTeamId: string,
    currentDay: number,
    rng: RandomProvider,
  ): WaiverEvent[] {
    const newEvents: WaiverEvent[] = [];

    // Clear expired entries (not claimed within 3 days)
    for (const entry of this.wire) {
      if (entry.claimedBy || entry.claimedDay) continue;
      if (currentDay > entry.expiresDay) {
        const event: WaiverEvent = {
          type: 'clear',
          player: entry.player,
          teamId: entry.releasingTeamId,
          message: `${getPlayerName(entry.player)} cleared waivers (unclaimed).`,
        };
        newEvents.push(event);
        this.events.push(event);
      }
    }

    // AI teams consider claiming available players
    const available = this.getAvailable(currentDay);
    if (available.length === 0) return newEvents;

    for (const team of teams.values()) {
      if (team.id === userTeamId) continue;

      // AI claims with ~15% chance per available player if roster has space
      if (team.roster.players.length >= 26) continue;

      for (const waiver of available) {
        if (!rng.chance(0.15)) continue;
        // Don't claim from own releases
        if (waiver.releasingTeamId === team.id) continue;

        const playerValue = evaluatePlayer(waiver.player);
        // Only claim if player has decent value
        if (playerValue < 45) continue;

        const event = this.claimPlayer(
          waiver.player.id,
          team.id,
          team.roster.players,
          currentDay,
        );
        if (event) {
          newEvents.push(event);
          break; // one claim per team per day
        }
      }
    }

    return newEvents;
  }

  /**
   * Get all currently available waiver players (not yet claimed, not expired).
   */
  getAvailable(currentDay: number): WaiverPlayer[] {
    return this.wire.filter(
      w => !w.claimedBy && currentDay <= w.expiresDay
    );
  }

  /**
   * Get full waiver wire history.
   */
  getAll(): WaiverPlayer[] {
    return [...this.wire];
  }

  /**
   * Get all waiver events.
   */
  getEvents(): WaiverEvent[] {
    return [...this.events];
  }
}
