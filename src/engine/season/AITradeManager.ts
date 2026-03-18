import type { Team } from '../types/index.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import type { StandingsTracker } from './StandingsTracker.ts';
import { evaluatePlayer } from '../gm/TradeEngine.ts';
import { getPlayerName } from '../types/player.ts';

export interface AITradeRecord {
  day: number;
  sellerTeamId: string;
  sellerTeamName: string;
  buyerTeamId: string;
  buyerTeamName: string;
  playersToSeller: string[];  // player names going to seller (prospect value)
  playersToBuyer: string[];   // player names going to buyer (veterans)
  description: string;
}

const TRADE_DEADLINE_DAY = 120;
const CONTENDER_WIN_PCT = 0.52;   // above this = contender
const SELLER_WIN_PCT    = 0.45;   // below this = seller

/**
 * AITradeManager — simulates CPU-to-CPU trades during the season.
 * Generates 5–10 trades per season, mostly around/before the deadline.
 */
export class AITradeManager {
  private tradeLog: AITradeRecord[] = [];

  /**
   * Run a batch of AI trades for the current day.
   * Returns any trades that occurred.
   */
  runAITrades(
    teams: Map<string, Team>,
    standings: StandingsTracker,
    userTeamId: string,
    currentDay: number,
    rng: RandomProvider,
  ): AITradeRecord[] {
    if (currentDay > TRADE_DEADLINE_DAY) return [];

    const newTrades: AITradeRecord[] = [];

    // Probability of a trade happening on any given day
    // Higher near deadline (day 100–120), lower early in season
    const deadlinePressure = Math.max(0, (currentDay - 60) / 60); // 0 at day 60, 1 at day 120
    const baseDailyProb = 0.08 + deadlinePressure * 0.15;

    if (!rng.chance(baseDailyProb)) return [];

    // Classify teams
    const allTeams = Array.from(teams.values()).filter(t => t.id !== userTeamId);
    const contenders: Team[] = [];
    const sellers: Team[] = [];

    for (const team of allTeams) {
      const rec = standings.getRecord(team.id);
      if (!rec) continue;
      const total = rec.wins + rec.losses;
      if (total < 20) continue; // too early to classify
      const pct = rec.wins / total;
      if (pct >= CONTENDER_WIN_PCT) contenders.push(team);
      else if (pct <= SELLER_WIN_PCT) sellers.push(team);
    }

    if (contenders.length === 0 || sellers.length === 0) return [];

    // Pick a random contender and seller
    const buyer = rng.pick(contenders);
    const seller = rng.pick(sellers);
    if (buyer.id === seller.id) return [];

    // Seller gives a veteran (age 28+, high value)
    const sellerPlayers = seller.roster.players
      .map(p => ({ p, v: evaluatePlayer(p) }))
      .filter(({ p }) => p.age >= 27)
      .sort((a, b) => b.v - a.v);

    if (sellerPlayers.length === 0) return [];

    // Pick 1–2 players from seller
    const numVets = rng.nextInt(1, Math.min(2, sellerPlayers.length));
    const vetsTraded = sellerPlayers.slice(0, numVets);
    const totalVetValue = vetsTraded.reduce((s, x) => s + x.v, 0);

    // Buyer gives prospects in return (age <=26, lower current value but potential)
    const buyerProspects = buyer.roster.players
      .map(p => ({ p, v: evaluatePlayer(p) }))
      .filter(({ p }) => p.age <= 26)
      .sort((a, b) => b.v - a.v);

    if (buyerProspects.length === 0) return [];

    // Match value roughly
    const prospectsGiven: typeof buyerProspects = [];
    let prospectValue = 0;
    for (const item of buyerProspects) {
      if (prospectValue >= totalVetValue * 0.75) break;
      prospectsGiven.push(item);
      prospectValue += item.v;
      if (prospectsGiven.length >= 3) break;
    }

    if (prospectsGiven.length === 0) return [];

    // Execute the trade: move players between rosters
    for (const { p } of vetsTraded) {
      const idx = seller.roster.players.findIndex(pl => pl.id === p.id);
      if (idx !== -1) {
        const [moved] = seller.roster.players.splice(idx, 1);
        buyer.roster.players.push(moved);
      }
    }
    for (const { p } of prospectsGiven) {
      const idx = buyer.roster.players.findIndex(pl => pl.id === p.id);
      if (idx !== -1) {
        const [moved] = buyer.roster.players.splice(idx, 1);
        seller.roster.players.push(moved);
      }
    }

    const vetNames = vetsTraded.map(x => getPlayerName(x.p));
    const prospectNames = prospectsGiven.map(x => getPlayerName(x.p));

    const record: AITradeRecord = {
      day: currentDay,
      sellerTeamId: seller.id,
      sellerTeamName: `${seller.city} ${seller.name}`,
      buyerTeamId: buyer.id,
      buyerTeamName: `${buyer.city} ${buyer.name}`,
      playersToSeller: prospectNames,
      playersToBuyer: vetNames,
      description: `${buyer.city} ${buyer.name} acquire ${vetNames.join(', ')} from ${seller.city} ${seller.name} for ${prospectNames.join(', ')}.`,
    };

    this.tradeLog.push(record);
    newTrades.push(record);

    return newTrades;
  }

  getTradeLog(): AITradeRecord[] {
    return [...this.tradeLog];
  }

  isDeadlinePassed(currentDay: number): boolean {
    return currentDay > TRADE_DEADLINE_DAY;
  }
}
