// ── effects/index.ts ──────────────────────────────────────────────────────────
// Re-exports all particle effects from one barrel file.

export { spawnDustCloud }      from './DustCloud.ts';
export type { DustIntensity }  from './DustCloud.ts';

export { spawnBatCrack }       from './BatCrack.ts';

export { spawnCatchPop }       from './CatchPop.ts';

export { spawnSlideSpray }     from './SlideSpray.ts';
export type { SlideDirection } from './SlideSpray.ts';

export { spawnStrikeoutK }     from './StrikeoutFlash.ts';

export { spawnHomeRunFireworks } from './HomeRunFireworks.ts';
