// ── CrowdAmbience.ts ──────────────────────────────────────────────────────────
// Continuous crowd ambience that responds to game state.
// Uses a looping noise generator with variable filter frequency and gain.

import { useSettingsStore } from '@/stores/settingsStore.ts';

// ── CrowdAmbience ─────────────────────────────────────────────────────────────

export class CrowdAmbience {
  private _ctx: AudioContext | null = null;
  private _src: AudioBufferSourceNode | null = null;
  private _filterNode: BiquadFilterNode | null = null;
  private _gainNode: GainNode | null = null;
  private _running = false;
  private _currentIntensity = 3;

  // Intensity → filter frequency mapping (100–600 Hz)
  private _intensityToFreq(level: number): number {
    return 100 + level * 50; // 0→100, 10→600
  }

  // Intensity → gain mapping
  private _intensityToGain(level: number): number {
    const master = this._masterGain();
    if (master <= 0) return 0;
    const baseGain = 0.04 + level * 0.025; // 0→0.04, 10→0.29
    return master * baseGain;
  }

  private _masterGain(): number {
    const s = useSettingsStore.getState();
    return (s.masterVolume * s.sfxVolume) / 10_000;
  }

  private _makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
    // 10-second looping noise buffer
    const frames = Math.floor(ctx.sampleRate * 10);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /** Start continuous crowd ambience. Safe to call multiple times. */
  start(): void {
    if (this._running) return;

    try {
      if (!this._ctx || this._ctx.state === 'closed') {
        this._ctx = new AudioContext();
      }
      const ctx = this._ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const buf = this._makeNoiseBuffer(ctx);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = this._intensityToFreq(this._currentIntensity);
      lp.Q.value = 0.5;

      const gain = ctx.createGain();
      gain.gain.value = this._intensityToGain(this._currentIntensity);

      src.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);

      src.start(ctx.currentTime);

      this._src = src;
      this._filterNode = lp;
      this._gainNode = gain;
      this._running = true;
    } catch {
      // AudioContext not available (e.g. server-side render)
    }
  }

  /** Stop crowd ambience with a short fade-out. */
  stop(): void {
    if (!this._running || !this._ctx || !this._gainNode || !this._src) return;

    try {
      const ctx = this._ctx;
      const now = ctx.currentTime;
      this._gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      const src = this._src;
      setTimeout(() => {
        try { src.stop(); } catch { /* already stopped */ }
      }, 600);
    } catch {
      // ignore
    }

    this._running = false;
    this._src = null;
    this._gainNode = null;
    this._filterNode = null;
  }

  /**
   * Set crowd intensity (0–10).
   * 0 = near silence, 5 = normal, 10 = full roar.
   * Transitions are smooth (300ms ramp).
   */
  setIntensity(level: number): void {
    const clamped = Math.max(0, Math.min(10, level));
    this._currentIntensity = clamped;

    if (!this._running || !this._ctx || !this._gainNode || !this._filterNode) return;

    const ctx = this._ctx;
    const now = ctx.currentTime;
    const ramp = 0.3;

    this._gainNode.gain.linearRampToValueAtTime(
      this._intensityToGain(clamped),
      now + ramp,
    );
    this._filterNode.frequency.linearRampToValueAtTime(
      this._intensityToFreq(clamped),
      now + ramp,
    );
  }

  /** Temporarily spike crowd intensity, then ramp back down. */
  spike(spikeLevel: number, holdMs: number, returnTo: number): void {
    this.setIntensity(spikeLevel);
    setTimeout(() => {
      this.setIntensity(returnTo);
    }, holdMs);
  }

  get isRunning(): boolean {
    return this._running;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const crowdAmbience = new CrowdAmbience();
