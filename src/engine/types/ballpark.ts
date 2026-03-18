export interface BallparkFactors {
  id: string;
  name: string;
  hr: number;       // 1.0 = neutral, >1 = hitter friendly
  doubles: number;
  triples: number;
  bb: number;
  so: number;
  foulTerritory: number;  // 0-1, larger = more foul outs
  wallDistances: {
    left: number;
    leftCenter: number;
    center: number;
    rightCenter: number;
    right: number;
  };
  wallHeights: {
    left: number;
    center: number;
    right: number;
  };
}
