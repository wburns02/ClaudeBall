import type { Component } from '../ecs/types.ts';

export type CareerRole = 'player' | 'scout' | 'coach' | 'manager' | 'assistant_gm' | 'gm' | 'president' | 'owner' | 'broadcaster' | 'retired';

export interface CareerEntry {
  role: CareerRole;
  teamId: string;
  startSeason: number;
  endSeason?: number;
}

export interface CareerComponent extends Component {
  type: 'Career';
  currentRole: CareerRole;
  currentTeamId: string;
  history: CareerEntry[];
  achievements: string[];
  awards: { type: string; season: number }[];
}

export function createCareer(role: CareerRole, teamId: string): CareerComponent {
  return {
    type: 'Career',
    currentRole: role,
    currentTeamId: teamId,
    history: [],
    achievements: [],
    awards: [],
  };
}
