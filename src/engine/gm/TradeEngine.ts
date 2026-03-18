import type { Player } from '../types/player.ts';
import type { Team } from '../types/team.ts';

// Position scarcity multipliers (premium positions worth more)
const POSITION_WEIGHT: Record<string, number> = {
  C: 1.15,
  SS: 1.12,
  CF: 1.10,
  '2B': 1.05,
  '3B': 1.05,
  RF: 1.00,
  LF: 0.98,
  '1B': 0.95,
  DH: 0.88,
  P: 1.08,
};

// Age curve: peak ~27, discount young (unproven) and old (declining)
function ageFactor(age: number): number {
  if (age <= 22) return 0.75;
  if (age <= 24) return 0.85;
  if (age <= 26) return 0.92;
  if (age <= 29) return 1.00;
  if (age <= 31) return 0.95;
  if (age <= 33) return 0.85;
  if (age <= 35) return 0.72;
  return 0.55;
}

function avgRatings(player: Player): number {
  if (player.position === 'P') {
    const p = player.pitching;
    return (p.stuff + p.movement + p.control + p.stamina) / 4;
  }
  const b = player.batting;
  return (b.contact_L + b.contact_R + b.power_L + b.power_R + b.eye + b.avoid_k + b.gap_power + b.speed) / 8;
}

/**
 * Returns trade value 0-100 based on ratings, age, and position.
 */
export function evaluatePlayer(player: Player): number {
  const rating = avgRatings(player);
  const posWeight = POSITION_WEIGHT[player.position] ?? 1.0;
  const age = ageFactor(player.age);
  const mental = (player.mental.work_ethic + player.mental.durability + player.mental.consistency) / 3;
  // Mental bonus: up to +5 points
  const mentalBonus = ((mental - 50) / 50) * 5;
  const raw = rating * posWeight * age + mentalBonus;
  return Math.max(0, Math.min(100, raw));
}

export interface TradePackage {
  teamId: string;
  playerIds: string[];
}

/**
 * Returns fairness score: positive means "offering" side wins, negative means "receiving" side wins.
 * Range: roughly -50 to +50.
 */
export function evaluateTrade(
  offering: TradePackage,
  receiving: TradePackage,
  allTeams: Team[]
): number {
  const findPlayer = (pid: string): Player | undefined => {
    for (const t of allTeams) {
      const p = t.roster.players.find(pl => pl.id === pid);
      if (p) return p;
    }
    return undefined;
  };

  const offeringValue = offering.playerIds.reduce((sum, id) => {
    const p = findPlayer(id);
    return sum + (p ? evaluatePlayer(p) : 0);
  }, 0);

  const receivingValue = receiving.playerIds.reduce((sum, id) => {
    const p = findPlayer(id);
    return sum + (p ? evaluatePlayer(p) : 0);
  }, 0);

  // Positive = offering team giving more than they get (bad for them)
  return Math.round(receivingValue - offeringValue);
}

export interface TradeProposal {
  aiTeamId: string;
  aiOffering: string[];   // player IDs the AI will give
  userReceiving: string[]; // player IDs the user gets (same list, user perspective)
  userOffering: string[];  // player IDs AI wants from user
  fairnessScore: number;
}

/**
 * AI generates a trade offer targeting a specific player on any team.
 * Tries to offer roughly equivalent value, biased 0-10 points in AI's favor.
 */
export function generateTradeOffer(
  aiTeam: Team,
  targetPlayerId: string,
  targetTeam: Team
): TradeProposal | null {
  const target = targetTeam.roster.players.find(p => p.id === targetPlayerId);
  if (!target) return null;

  const targetValue = evaluatePlayer(target);

  // AI offers players to match value, biased slightly in AI's favor
  const targetOfferValue = targetValue * 0.85; // AI tries to underpay by ~15%

  const candidates = aiTeam.roster.players
    .map(p => ({ p, v: evaluatePlayer(p) }))
    .sort((a, b) => b.v - a.v);

  const offering: string[] = [];
  let offerTotal = 0;

  for (const { p, v } of candidates) {
    if (offerTotal >= targetOfferValue) break;
    // Don't offer their own star players unless needed
    if (v > 80 && offerTotal === 0 && targetValue < 70) continue;
    offering.push(p.id);
    offerTotal += v;
    if (offering.length >= 3) break;
  }

  if (offering.length === 0) return null;

  const fairness = Math.round(offerTotal - targetValue);

  return {
    aiTeamId: aiTeam.id,
    aiOffering: offering,
    userReceiving: offering,
    userOffering: [targetPlayerId],
    fairnessScore: fairness, // negative = AI is getting the better deal
  };
}

/**
 * AI decision on whether to accept a trade.
 * Returns true if receiving is within acceptable range of offering.
 */
export function wouldAccept(
  _team: Team,
  offering: TradePackage,  // what the AI receives
  receiving: TradePackage, // what the AI gives up
  allTeams: Team[]
): boolean {
  const fairness = evaluateTrade(offering, receiving, allTeams);
  // AI accepts if they gain value or break even (tolerance: -8 points)
  // fairness = receivingValue - offeringValue
  // negative = AI gives more than they get = bad for AI
  return fairness >= -8;
}
