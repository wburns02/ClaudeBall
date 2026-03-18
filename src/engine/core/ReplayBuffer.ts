// ── Replay types ──────────────────────────────────────────────────────────

export interface ReplayContactData {
  type: string;        // 'ground_ball' | 'line_drive' | 'fly_ball' | 'popup' | 'home_run'
  exitVelo: number;    // mph
  launchAngle: number; // degrees
  sprayAngle: number;  // degrees, 0=center, neg=left, pos=right
  distance: number;    // normalized 0-1
}

export interface ReplayPitchStep {
  pitchType: string;
  velocity: number;
  inZone: boolean;
  swung: boolean;
  result: string; // 'ball' | 'called_strike' | 'swinging_strike' | 'foul' | 'contact'
  count: { balls: number; strikes: number };
  atBatResult?: string;   // set on the last pitch of the at-bat
  contactData?: ReplayContactData;
  timestamp: number;      // Date.now() at time of recording
}

// Highlight types that get surfaced in the highlights list
const HIGHLIGHT_AT_BAT_RESULTS = new Set([
  'home_run',
  'strikeout_swinging',
  'strikeout_looking',
  'double_play',
  'triple_play',
]);

const HIGHLIGHT_PITCH_RESULTS = new Set([
  'error', // stored in atBatResult
]);

// ── ReplayBuffer class ────────────────────────────────────────────────────

export class ReplayBuffer {
  private _pitches: ReplayPitchStep[] = [];
  private readonly _maxCapacity: number;

  /**
   * @param maxCapacity Maximum number of individual pitches to retain.
   *                    Older pitches are evicted FIFO. Default: 500.
   *                    (50 at-bats * ~10 pitches each)
   */
  constructor(maxCapacity = 500) {
    this._maxCapacity = maxCapacity;
  }

  // ── Mutation ────────────────────────────────────────────────────────

  /** Record a single pitch step. Older entries are evicted once at capacity. */
  record(pitch: ReplayPitchStep): void {
    this._pitches.push(pitch);
    if (this._pitches.length > this._maxCapacity) {
      this._pitches.splice(0, this._pitches.length - this._maxCapacity);
    }
  }

  /** Remove all recorded pitches. */
  clear(): void {
    this._pitches = [];
  }

  // ── Queries ─────────────────────────────────────────────────────────

  /**
   * Returns all pitches from the most recent at-bat (i.e., pitches after the
   * last pitch that had an `atBatResult` set, exclusive, up to current tail).
   */
  getLastAtBat(): ReplayPitchStep[] {
    if (this._pitches.length === 0) return [];

    // Walk backwards to find the second-to-last at-bat boundary
    let boundaryIdx = -1;
    // The last pitch with an atBatResult is index i — we want pitches from
    // (previous boundary + 1) to end.
    let atBatCount = 0;
    for (let i = this._pitches.length - 1; i >= 0; i--) {
      if (this._pitches[i]!.atBatResult !== undefined) {
        atBatCount++;
        if (atBatCount === 2) {
          boundaryIdx = i;
          break;
        }
      }
    }

    return this._pitches.slice(boundaryIdx + 1);
  }

  /**
   * Returns arrays of pitches — one per highlight at-bat —
   * filtering to home runs, strikeouts, double plays, errors, etc.
   */
  getHighlights(): ReplayPitchStep[][] {
    const highlights: ReplayPitchStep[][] = [];
    let currentAtBat: ReplayPitchStep[] = [];

    for (const pitch of this._pitches) {
      currentAtBat.push(pitch);

      if (pitch.atBatResult !== undefined) {
        const isHighlight =
          HIGHLIGHT_AT_BAT_RESULTS.has(pitch.atBatResult) ||
          HIGHLIGHT_PITCH_RESULTS.has(pitch.atBatResult);

        if (isHighlight) {
          highlights.push([...currentAtBat]);
        }
        currentAtBat = [];
      }
    }

    return highlights;
  }

  /**
   * Returns the last `n` individual pitch steps.
   */
  getLastNPitches(n: number): ReplayPitchStep[] {
    return this._pitches.slice(Math.max(0, this._pitches.length - n));
  }

  /** Total number of recorded pitches. */
  get size(): number {
    return this._pitches.length;
  }

  // ── Serialization ────────────────────────────────────────────────────

  toJSON(): string {
    return JSON.stringify({
      version: 1,
      maxCapacity: this._maxCapacity,
      pitches: this._pitches,
    });
  }

  static fromJSON(json: string): ReplayBuffer {
    const data = JSON.parse(json) as {
      version: number;
      maxCapacity: number;
      pitches: ReplayPitchStep[];
    };

    if (data.version !== 1) {
      throw new Error(`[ReplayBuffer] Unknown serialization version: ${data.version}`);
    }

    const buf = new ReplayBuffer(data.maxCapacity);
    buf._pitches = data.pitches ?? [];
    return buf;
  }
}
