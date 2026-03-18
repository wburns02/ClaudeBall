/**
 * Seedable Mulberry32 PRNG for deterministic game simulation.
 */
export class RandomProvider {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns int in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns float in [min, max) */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Returns true with given probability (0-1) */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted random selection. weights[i] corresponds to items[i]. */
  weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** Normal distribution via Box-Muller */
  nextGaussian(mean: number = 0, stddev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
    return z * stddev + mean;
  }

  /** Get current state for save/restore */
  getState(): number {
    return this.state;
  }

  /** Restore state */
  setState(state: number): void {
    this.state = state;
  }
}
