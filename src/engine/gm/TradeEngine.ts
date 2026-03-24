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

/**
 * Age-based trade value curve. Young players with upside are PREMIUM assets.
 * Peak value at 25-29. Young players valued for potential, old players discounted.
 */
function ageFactor(age: number): number {
  if (age <= 21) return 0.90;  // Raw but huge upside, very valuable in trades
  if (age <= 23) return 0.95;  // Still developing, premium trade chip
  if (age <= 25) return 1.00;  // Entering prime, max value
  if (age <= 29) return 1.00;  // Prime years
  if (age <= 31) return 0.92;  // Still productive
  if (age <= 33) return 0.80;  // Declining but useful
  if (age <= 35) return 0.65;  // Veteran, limited trade value
  if (age <= 37) return 0.48;  // End of career
  return 0.35;                  // Hanging on
}

/**
 * Years of team control bonus — younger players on cheap deals are worth more.
 * A 24-year-old has ~6 years of affordable control. A 32-year-old free agent has 0.
 */
function controlBonus(age: number): number {
  if (age <= 23) return 12;  // Pre-arb years = huge surplus value
  if (age <= 25) return 8;   // Arb-eligible but still cheap
  if (age <= 27) return 4;   // Early free agency
  if (age <= 29) return 2;   // Mid-career
  return 0;                   // No control premium
}

function avgRatings(player: Player): number {
  if (player.position === 'P') {
    const p = player.pitching;
    // Weight stuff/control more heavily, add velocity bonus for hard throwers
    const base = (p.stuff * 0.30 + p.movement * 0.20 + p.control * 0.30 + p.stamina * 0.10);
    const velBonus = p.velocity >= 95 ? 5 : p.velocity >= 92 ? 2 : 0;
    const repBonus = Math.min(3, (p.repertoire?.length ?? 2) - 2); // Bonus for 3+ pitches
    return base + velBonus + repBonus;
  }
  const b = player.batting;
  // Weight contact and power more heavily, include clutch
  return (
    (b.contact_L + b.contact_R) / 2 * 0.25 +
    (b.power_L + b.power_R) / 2 * 0.25 +
    b.eye * 0.15 +
    b.speed * 0.10 +
    b.avoid_k * 0.10 +
    b.gap_power * 0.10 +
    b.clutch * 0.05
  );
}

/**
 * Returns trade value 0-100+ based on ratings, age, position, and control.
 * Young stars can exceed 100 (indicating premium trade chips).
 */
export function evaluatePlayer(player: Player): number {
  const rating = avgRatings(player);
  const posWeight = POSITION_WEIGHT[player.position] ?? 1.0;
  const age = ageFactor(player.age);
  const control = controlBonus(player.age);
  const mental = (player.mental.work_ethic + player.mental.durability + player.mental.consistency) / 3;
  const mentalBonus = ((mental - 50) / 50) * 5;
  const raw = rating * posWeight * age + mentalBonus + control;
  return Math.max(0, Math.min(120, raw)); // Allow up to 120 for elite young players
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

  // AI offers players close to fair value, slight bias in AI's favor
  const targetOfferValue = targetValue * 0.92; // AI tries to underpay by ~8%

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
  offering: TradePackage,  // what the AI receives (user's players)
  receiving: TradePackage, // what the AI gives up (AI's players)
  allTeams: Team[]
): boolean {
  // fairness = receivingValue - offeringValue = (AI gives value) - (AI gets value)
  // positive = AI is giving more than it gets = bad for AI
  // negative = AI is getting more than it gives = good for AI
  // AI accepts if trade is roughly fair (tolerance: ±5 OVR points)
  // Positive fairness = AI giving more than getting
  const fairness = evaluateTrade(offering, receiving, allTeams);
  return fairness <= 5 && fairness >= -25; // Won't accept lopsided deals in either direction
}
