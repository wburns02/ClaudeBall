import type { Component } from '../ecs/types.ts';

export type ReputationMeter = 'clubhouse' | 'media' | 'fan';

export type ReputationLabel = 'Beloved' | 'Liked' | 'Neutral' | 'Disliked' | 'Hated';

export interface ReputationComponent extends Component {
  type: 'Reputation';
  clubhouse: number;  // -100 to +100
  media: number;
  fan: number;
}

export function createReputation(): ReputationComponent {
  return { type: 'Reputation', clubhouse: 0, media: 0, fan: 0 };
}

export function adjustReputation(rep: ReputationComponent, meter: ReputationMeter, delta: number): void {
  rep[meter] = Math.max(-100, Math.min(100, rep[meter] + delta));
}

export function getReputationLabel(value: number): ReputationLabel {
  if (value >= 60) return 'Beloved';
  if (value >= 20) return 'Liked';
  if (value >= -20) return 'Neutral';
  if (value >= -60) return 'Disliked';
  return 'Hated';
}
