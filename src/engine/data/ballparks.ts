import type { BallparkFactors } from '../types/ballpark.ts';

export const BALLPARKS: BallparkFactors[] = [
  { id: 'coors', name: 'Coors Field', hr: 1.25, doubles: 1.15, triples: 1.30, bb: 1.0, so: 0.95, foulTerritory: 0.35, wallDistances: { left: 347, leftCenter: 390, center: 415, rightCenter: 375, right: 350 }, wallHeights: { left: 8, center: 8, right: 8 } },
  { id: 'fenway', name: 'Fenway Park', hr: 0.95, doubles: 1.20, triples: 0.75, bb: 1.0, so: 1.0, foulTerritory: 0.25, wallDistances: { left: 310, leftCenter: 379, center: 390, rightCenter: 380, right: 302 }, wallHeights: { left: 37, center: 17, right: 5 } },
  { id: 'yankee', name: 'Yankee Stadium', hr: 1.15, doubles: 0.95, triples: 0.80, bb: 1.0, so: 1.0, foulTerritory: 0.30, wallDistances: { left: 318, leftCenter: 399, center: 408, rightCenter: 385, right: 314 }, wallHeights: { left: 8, center: 8, right: 8 } },
  { id: 'wrigley', name: 'Wrigley Field', hr: 1.10, doubles: 1.05, triples: 0.90, bb: 1.0, so: 0.98, foulTerritory: 0.28, wallDistances: { left: 355, leftCenter: 368, center: 400, rightCenter: 368, right: 353 }, wallHeights: { left: 11, center: 11, right: 11 } },
  { id: 'dodger', name: 'Dodger Stadium', hr: 0.90, doubles: 0.95, triples: 1.05, bb: 1.0, so: 1.02, foulTerritory: 0.40, wallDistances: { left: 330, leftCenter: 385, center: 395, rightCenter: 385, right: 330 }, wallHeights: { left: 8, center: 8, right: 8 } },
];

export const DEFAULT_BALLPARK = BALLPARKS[0]; // Coors for more offense in testing

/** Get a neutral ballpark for testing */
export function getNeutralBallpark(): BallparkFactors {
  return {
    id: 'neutral',
    name: 'Neutral Park',
    hr: 1.0,
    doubles: 1.0,
    triples: 1.0,
    bb: 1.0,
    so: 1.0,
    foulTerritory: 0.32,
    wallDistances: { left: 330, leftCenter: 375, center: 400, rightCenter: 375, right: 330 },
    wallHeights: { left: 8, center: 8, right: 8 },
  };
}
