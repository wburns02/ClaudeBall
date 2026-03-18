/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Convert 1-100 rating to a probability modifier (0.0 - 1.0 range centered at 0.5) */
export function ratingToProb(rating: number): number {
  return clamp(rating / 100, 0, 1);
}

/** Sigmoid function for smooth transitions */
export function sigmoid(x: number, midpoint: number = 0, steepness: number = 1): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Map a 1-100 rating to a range */
export function ratingToRange(rating: number, min: number, max: number): number {
  return lerp(min, max, (rating - 1) / 99);
}

/** Format number to 3 decimal places (batting average style) */
export function fmt3(n: number): string {
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(3).replace(/^0/, '');
}

/** Format number to 2 decimal places (ERA style) */
export function fmt2(n: number): string {
  return n.toFixed(2);
}

/** Generate a simple UUID */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
