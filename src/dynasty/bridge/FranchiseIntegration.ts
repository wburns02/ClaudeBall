/**
 * FranchiseIntegration — Wires the dynasty ECS into the existing franchise store.
 *
 * Eager initialization: DynastyBridge activates for ALL franchises.
 * Every game, trade, contract, and season event flows through the ECS.
 */

import { DynastyBridge } from './DynastyBridge.ts';
import type { Team } from '@/engine/types/team.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import { createPersonalFinances } from '../components/PersonalFinances.ts';
import { CHARACTER_ARCHETYPES } from '../DynastySettings.ts';

let bridge: DynastyBridge | null = null;

/** Initialize the dynasty bridge when a franchise starts. Call from franchiseStore.startFranchise(). */
export function initDynastyBridge(teams: Team[], mode: 'classic' | 'living' = 'classic'): DynastyBridge {
  bridge = DynastyBridge.create(mode);
  bridge.initializeFromTeams(teams, 'user-gm');
  // Load conversation templates in background (non-blocking)
  bridge.loadConversationTemplates().catch(() => {});
  // Apply character creation data to user's player entity (Living Dynasty)
  applyCharacterCreation();
  return bridge;
}

/** Read character creation data from localStorage and apply to user's player entity */
function applyCharacterCreation(): void {
  if (!bridge) return;
  try {
    const charJson = localStorage.getItem('claudeball_dynasty_character');
    const attrsJson = localStorage.getItem('claudeball_dynasty_attrs');
    const modeStr = localStorage.getItem('claudeball_dynasty_mode');
    if (!charJson || modeStr !== 'living') return;

    const character = JSON.parse(charJson) as { name: string; archetypes: string[]; position: string; background: string };
    const attrs = attrsJson ? JSON.parse(attrsJson) as Record<string, number> : null;

    // Find the user's team and first player matching the created position (or first player)
    // In a real Living Dynasty, the drafted player would be injected into the roster
    // For now, apply personality overrides from archetypes to the first roster player's entity
    const allEntities = bridge.entities.getAllEntityIds();
    if (allEntities.length === 0) return;

    // Apply archetype personality overrides to the first player entity (user's avatar)
    const avatarEntityId = allEntities[0];
    const personality = bridge.entities.getComponent<PersonalityComponent>(avatarEntityId, 'Personality');
    if (!personality) return;

    // Apply archetype trait effects
    for (const archId of character.archetypes) {
      const arch = CHARACTER_ARCHETYPES.find(a => a.id === archId);
      if (!arch) continue;
      for (const [trait, effect] of Object.entries(arch.traitEffects)) {
        if (trait === 'type' || !effect) continue;
        const p = personality as unknown as Record<string, number>;
        if (effect.min !== undefined) {
          p[trait] = Math.max(p[trait] ?? 50, effect.min);
        }
        if (effect.max !== undefined) {
          p[trait] = Math.min(p[trait] ?? 50, effect.max);
        }
      }
    }

    // Add PersonalFinances component for Living Dynasty
    if (!bridge.entities.getComponent(avatarEntityId, 'PersonalFinances')) {
      const salary = attrs?.contact ? Math.round((attrs.contact + (attrs?.power ?? 50)) * 10) : 700;
      bridge.entities.addComponent(avatarEntityId, createPersonalFinances(salary));
    }

    console.log(`Dynasty: Applied character "${character.name}" archetypes [${character.archetypes.join(', ')}] to avatar entity`);
  } catch {
    // Non-critical — character data may not exist
  }
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
