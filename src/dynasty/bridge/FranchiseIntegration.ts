/**
 * FranchiseIntegration — Wires the dynasty ECS into the existing franchise store.
 *
 * Eager initialization: DynastyBridge activates for ALL franchises.
 * Every game, trade, contract, and season event flows through the ECS.
 */

import { DynastyBridge } from './DynastyBridge.ts';
import type { Team } from '@/engine/types/team.ts';

let bridge: DynastyBridge | null = null;

/** Initialize the dynasty bridge when a franchise starts. Call from franchiseStore.startFranchise(). */
export function initDynastyBridge(teams: Team[], mode: 'classic' | 'living' = 'classic'): DynastyBridge {
  bridge = DynastyBridge.create(mode);
  bridge.initializeFromTeams(teams, 'user-gm');
  return bridge;
}

/** Get the current bridge instance (null if no franchise active). */
export function getDynastyBridge(): DynastyBridge | null {
  return bridge;
}

/** Destroy the bridge (franchise ended / reset). */
export function destroyDynastyBridge(): void {
  bridge = null;
}

// ---- Event emission helpers (called from franchiseStore) ----

export function emitGameCompleted(awayTeamId: string, homeTeamId: string, awayScore: number, homeScore: number): void {
  bridge?.coreSim.recordGameCompleted(awayTeamId, homeTeamId, awayScore, homeScore);
}

export function emitPlayerTraded(playerId: string, fromTeamId: string, toTeamId: string): void {
  bridge?.trades.recordTrade(playerId, fromTeamId, toTeamId, 'user-gm');
}

export function emitContractSigned(playerId: string, teamId: string, years: number, salary: number): void {
  bridge?.contracts.recordContractSigned(playerId, teamId, years, salary);
}

export function emitPlayerReleased(playerId: string, teamId: string): void {
  bridge?.contracts.recordPlayerReleased(playerId, teamId);
}

export function emitPlayerRetired(playerId: string, teamId: string, age: number): void {
  bridge?.contracts.recordPlayerRetired(playerId, teamId, age);
}

export function emitSeasonPhaseChanged(from: string, to: string): void {
  bridge?.season.recordPhaseChange(from, to);
}

export function emitPlayerInjured(playerId: string, teamId: string, severity: 'minor' | 'major' | 'career_ending'): void {
  bridge?.season.recordInjury(playerId, teamId, severity);
}

export function emitAwardWon(playerId: string, award: string, league: string): void {
  bridge?.season.recordAward(playerId, award, league);
}

/** Get team chemistry modifier for AtBatResolver (-10 to +10). */
export function getTeamChemistry(teamId: string, team: Team): number {
  if (!bridge) return 0;
  return bridge.getTeamChemistry(teamId, team);
}

/** Tick the ECS (call after each game day). */
export function tickDynasty(dt = 1): void {
  bridge?.tick(dt);
}
