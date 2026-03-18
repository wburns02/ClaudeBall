/** Swing types the player can select during an at-bat. */
export type SwingType = 'normal' | 'power' | 'contact' | 'bunt';

/** Timing quality result after a swing attempt. */
export type SwingTiming =
  | 'perfect'
  | 'early'
  | 'late'
  | 'way_early'
  | 'way_late'
  | 'miss';
