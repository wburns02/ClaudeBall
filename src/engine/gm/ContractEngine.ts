import type { Player } from '../types/player.ts';
import { evaluatePlayer } from './TradeEngine.ts';
import { getPlayerName } from '../types/player.ts';

export interface PlayerContract {
  playerId: string;
  teamId: string;
  yearsRemaining: number;
  salaryPerYear: number; // in thousands (e.g. 5000 = $5M)
  isFreeAgent: boolean;
}

export interface ContractOffer {
  years: number;
  salaryPerYear: number;
}

export interface ContractResult {
  success: boolean;
  reason?: string;
  contract?: PlayerContract;
}

/**
 * Estimate market salary for a player based on their value.
 * Returns salary in thousands (e.g. 5000 = $5M/year).
 */
export function estimateMarketSalary(player: Player): number {
  const value = evaluatePlayer(player);
  // Exponential: top players ~$25M, average ~$5M, scrubs ~$0.7M
  const base = Math.pow(value / 100, 2.5) * 25000;
  return Math.max(700, Math.round(base / 100) * 100);
}

/**
 * Estimate contract length a player would want (1–7 years, based on age + value).
 */
export function estimateDesiredYears(player: Player): number {
  const value = evaluatePlayer(player);
  if (player.age >= 35) return 1;
  if (player.age >= 32) return Math.min(2, Math.round(value / 40));
  if (player.age >= 28) return Math.min(4, 1 + Math.round(value / 30));
  return Math.min(7, 2 + Math.round(value / 20));
}

/**
 * ContractEngine — tracks contracts and handles extensions / free agency.
 */
export class ContractEngine {
  private contracts: Map<string, PlayerContract> = new Map();

  /**
   * Assign a default contract to a player when season starts.
   */
  assignDefaultContract(player: Player, teamId: string): PlayerContract {
    const salary = estimateMarketSalary(player);
    const years = estimateDesiredYears(player);
    const contract: PlayerContract = {
      playerId: player.id,
      teamId,
      yearsRemaining: years,
      salaryPerYear: salary,
      isFreeAgent: false,
    };
    this.contracts.set(player.id, contract);
    return contract;
  }

  getContract(playerId: string): PlayerContract | undefined {
    return this.contracts.get(playerId);
  }

  getAllContracts(): PlayerContract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Get all free agents (contracts expired).
   */
  getFreeAgents(): PlayerContract[] {
    return Array.from(this.contracts.values()).filter(c => c.isFreeAgent);
  }

  /**
   * Get total payroll for a team.
   */
  getTeamPayroll(teamId: string): number {
    return Array.from(this.contracts.values())
      .filter(c => c.teamId === teamId && !c.isFreeAgent)
      .reduce((sum, c) => sum + c.salaryPerYear, 0);
  }

  /**
   * Process end-of-season contract expirations.
   * Players with 0 years remaining become free agents.
   * Returns list of players who became free agents.
   */
  processOffseasonContracts(
    teams: Map<string, { id: string; roster: { players: Player[] } }>,
  ): { player: Player; teamId: string }[] {
    const newFAs: { player: Player; teamId: string }[] = [];

    for (const [playerId, contract] of this.contracts) {
      if (contract.isFreeAgent) continue;

      // Decrement years
      contract.yearsRemaining = Math.max(0, contract.yearsRemaining - 1);

      if (contract.yearsRemaining === 0) {
        contract.isFreeAgent = true;
        // Find the player
        const team = teams.get(contract.teamId);
        if (team) {
          const player = team.roster.players.find(p => p.id === playerId);
          if (player) {
            newFAs.push({ player, teamId: contract.teamId });
          }
        }
      }
    }

    return newFAs;
  }

  /**
   * Sign a player to a new contract (extension or new signing).
   */
  signContract(
    player: Player,
    teamId: string,
    offer: ContractOffer,
  ): ContractResult {
    const minSalary = estimateMarketSalary(player) * 0.80;
    const maxYears = estimateDesiredYears(player) + 1;

    if (offer.salaryPerYear < minSalary) {
      return {
        success: false,
        reason: `${getPlayerName(player)} wants at least $${Math.round(minSalary / 1000)}M/year`,
      };
    }
    if (offer.years > maxYears) {
      return {
        success: false,
        reason: `${getPlayerName(player)} only wants a ${maxYears}-year deal`,
      };
    }

    const contract: PlayerContract = {
      playerId: player.id,
      teamId,
      yearsRemaining: offer.years,
      salaryPerYear: offer.salaryPerYear,
      isFreeAgent: false,
    };
    this.contracts.set(player.id, contract);
    return { success: true, contract };
  }

  /**
   * Release a player (clears contract, marks as FA).
   */
  releasePlayer(playerId: string): void {
    const contract = this.contracts.get(playerId);
    if (contract) {
      contract.isFreeAgent = true;
      contract.yearsRemaining = 0;
    }
  }
}
