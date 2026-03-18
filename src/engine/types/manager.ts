export interface DefensiveAlignment {
  infieldShift: 'normal' | 'shift_left' | 'shift_right';
  infieldDepth: 'normal' | 'in' | 'back';
  outfieldDepth: 'normal' | 'deep' | 'shallow';
}

export interface ManagerDecision {
  type:
    | 'steal'
    | 'hit_and_run'
    | 'sacrifice_bunt'
    | 'intentional_walk'
    | 'pitchout'
    | 'pitching_change'
    | 'pinch_hit'
    | 'pinch_run'
    | 'defensive_shift'
    | 'mound_visit';
  data?: Record<string, unknown>;
}
