// ── SoundEngine.ts ────────────────────────────────────────────────────────────
// Procedural baseball sound effects using the Web Audio API.
// All sounds are synthesized — no audio files required.
// Singleton: one AudioContext shared across the app.

import { useSettingsStore } from '@/stores/settingsStore.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AmbientHandle {
  stop(): void;
}

// ── SoundEngine ───────────────────────────────────────────────────────────────

class SoundEngine {
  private _ctx: AudioContext | null = null;
  private _initialized = false;

  // ── AudioContext lazy init (requires prior user gesture) ─────────────────

  private _getCtx(): AudioContext | null {
    if (this._ctx && this._ctx.state !== 'closed') {
      // Resume if suspended (browser autoplay policy)
      if (this._ctx.state === 'suspended') {
        void this._ctx.resume();
      }
      return this._ctx;
    }
    try {
      this._ctx = new AudioContext();
      return this._ctx;
    } catch {
      return null;
    }
  }

  /** Call this once on first user interaction to unlock the AudioContext. */
  initialize(): void {
    if (this._initialized) return;
    this._initialized = true;
    const ctx = this._getCtx();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  // ── Volume helpers ────────────────────────────────────────────────────────

  private _masterGain(): number {
    const s = useSettingsStore.getState();
    // masterVolume (0-100) * sfxVolume (0-100) / 10000 → 0-1
    return (s.masterVolume * s.sfxVolume) / 10_000;
  }

  private _createGain(ctx: AudioContext, level: number): GainNode {
    const g = ctx.createGain();
    g.gain.value = this._masterGain() * level;
    g.connect(ctx.destination);
    return g;
  }

  // ── White noise buffer (1 second, mono) ──────────────────────────────────

  private _makeNoiseBuffer(ctx: AudioContext, durationSec = 1): AudioBuffer {
    const frames = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // ── playBatCrack ─────────────────────────────────────────────────────────
  // Sharp percussive crack: bandpass-filtered white noise burst (30ms).

  playBatCrack(volumeMultiplier = 1): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.03;

    const buf = this._makeNoiseBuffer(ctx, 0.05);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Bandpass at 2 kHz — wood-on-ball crack
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000;
    bp.Q.value = 1.5;

    // Second bandpass for body/thump
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 600;
    bp2.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this._masterGain() * 1.2 * volumeMultiplier, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);

    // Parallel thump layer
    const src2 = ctx.createBufferSource();
    src2.buffer = buf;
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(this._masterGain() * 0.5 * volumeMultiplier, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    src2.connect(bp2);
    bp2.connect(gain2);
    gain2.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.01);
    src2.start(now);
    src2.stop(now + 0.06);
  }

  // ── playBallInGlove ──────────────────────────────────────────────────────
  // Leather pop: lowpass-filtered noise (20ms).

  playBallInGlove(): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.02;

    const buf = this._makeNoiseBuffer(ctx, 0.04);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 1.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this._masterGain() * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.01);
  }

  // ── playCrowdCheer ───────────────────────────────────────────────────────
  // Filtered white noise at 200–400 Hz with slow envelope.

  playCrowdCheer(intensity: 'light' | 'medium' | 'roar'): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const configs = {
      light:  { duration: 0.5,  freq: 250, vol: 0.12 },
      medium: { duration: 1.0,  freq: 300, vol: 0.22 },
      roar:   { duration: 2.0,  freq: 380, vol: 0.38 },
    } as const;

    const cfg = configs[intensity];
    const now = ctx.currentTime;
    const master = this._masterGain();

    const buf = this._makeNoiseBuffer(ctx, cfg.duration + 0.1);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cfg.freq;
    lp.Q.value = 0.5;

    const gain = ctx.createGain();
    const attackTime = cfg.duration * 0.1;
    const releaseStart = now + cfg.duration * 0.6;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(master * cfg.vol, now + attackTime);
    gain.gain.setValueAtTime(master * cfg.vol, releaseStart);
    gain.gain.linearRampToValueAtTime(0, now + cfg.duration);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + cfg.duration + 0.05);
  }

  // ── playUmpireStrike ─────────────────────────────────────────────────────
  // Sharp whistle-like tone: 600 Hz sine, 150ms, sharp attack.

  playUmpireStrike(): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.15;
    const master = this._masterGain();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(650, now + 0.02);
    osc.frequency.linearRampToValueAtTime(580, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(master * 0.5, now + 0.005);
    gain.gain.setValueAtTime(master * 0.5, now + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // ── playUmpireBall ───────────────────────────────────────────────────────
  // Subtle low tone: 300 Hz sine, 80ms, quiet.

  playUmpireBall(): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.08;
    const master = this._masterGain();

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 300;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(master * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // ── playOrganCharge ──────────────────────────────────────────────────────
  // Classic stadium "charge": C5→D5→E5→G5 (100ms each), hold G5 (200ms).

  playOrganCharge(): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const master = this._masterGain();
    if (master <= 0) return;

    // Note frequencies (C5=523, D5=587, E5=659, G5=784)
    const notes = [523.25, 587.33, 659.25, 783.99];
    const stepMs = 100;
    const holdMs = 200;

    notes.forEach((freq, i) => {
      const isLast = i === notes.length - 1;
      const startSec = ctx.currentTime + (i * stepMs) / 1000;
      const durSec = isLast ? holdMs / 1000 : stepMs / 1000;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Second harmonic for organ-like timbre
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startSec);
      gain.gain.linearRampToValueAtTime(master * 0.3, startSec + 0.01);
      gain.gain.setValueAtTime(master * 0.3, startSec + durSec * 0.7);
      gain.gain.linearRampToValueAtTime(0, startSec + durSec);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0, startSec);
      gain2.gain.linearRampToValueAtTime(master * 0.1, startSec + 0.01);
      gain2.gain.setValueAtTime(master * 0.1, startSec + durSec * 0.7);
      gain2.gain.linearRampToValueAtTime(0, startSec + durSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc.start(startSec);
      osc.stop(startSec + durSec + 0.01);
      osc2.start(startSec);
      osc2.stop(startSec + durSec + 0.01);
    });
  }

  // ── playHomeRunHorn ──────────────────────────────────────────────────────
  // Deep horn blast: 150 Hz sawtooth + 300 Hz sine, 800ms.

  playHomeRunHorn(): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.8;
    const master = this._masterGain();

    // Low sawtooth — the "horn" body
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 150;

    const sawGain = ctx.createGain();
    sawGain.gain.setValueAtTime(0, now);
    sawGain.gain.linearRampToValueAtTime(master * 0.35, now + 0.08);
    sawGain.gain.setValueAtTime(master * 0.35, now + duration * 0.75);
    sawGain.gain.linearRampToValueAtTime(0, now + duration);

    // Lowpass to tame harshness
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;

    saw.connect(lp);
    lp.connect(sawGain);
    sawGain.connect(ctx.destination);

    // Sine layer for richness
    const sine = ctx.createOscillator();
    sine.type = 'sine';
    sine.frequency.value = 300;

    const sineGain = ctx.createGain();
    sineGain.gain.setValueAtTime(0, now);
    sineGain.gain.linearRampToValueAtTime(master * 0.2, now + 0.06);
    sineGain.gain.setValueAtTime(master * 0.2, now + duration * 0.7);
    sineGain.gain.linearRampToValueAtTime(0, now + duration);

    sine.connect(sineGain);
    sineGain.connect(ctx.destination);

    saw.start(now);
    saw.stop(now + duration + 0.01);
    sine.start(now);
    sine.stop(now + duration + 0.01);
  }

  // ── playCrowdNoise ───────────────────────────────────────────────────────
  // Continuous ambient crowd noise. Returns a handle to stop it.

  playCrowdNoise(): AmbientHandle {
    const ctx = this._getCtx();
    if (!ctx) {
      return { stop: () => undefined };
    }

    const master = this._masterGain();
    const durationSec = 10; // looped by creating new ones

    const buf = this._makeNoiseBuffer(ctx, durationSec);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    lp.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = master * 0.08;

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(ctx.currentTime);

    return {
      stop: () => {
        try {
          const now = ctx.currentTime;
          gain.gain.linearRampToValueAtTime(0, now + 0.3);
          src.stop(now + 0.35);
        } catch {
          // already stopped
        }
      },
    };
  }

  // ── playPitchThrow ───────────────────────────────────────────────────────
  // Whoosh: high-pass filtered noise burst, 100ms.

  playPitchThrow(): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.1;
    const master = this._masterGain();

    const buf = this._makeNoiseBuffer(ctx, 0.15);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2000, now);
    hp.frequency.linearRampToValueAtTime(4000, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(master * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.01);
  }

  // ── playStrikeoutSwing ───────────────────────────────────────────────────
  // Bat whoosh through air: bandpass noise sweep 400→2000 Hz over 150ms.

  playStrikeoutSwing(): void {
    const ctx = this._getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.15;
    const master = this._masterGain();

    const buf = this._makeNoiseBuffer(ctx, 0.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, now);
    bp.frequency.linearRampToValueAtTime(2000, now + duration);
    bp.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(master * 0.25, now + 0.02);
    gain.gain.linearRampToValueAtTime(master * 0.1, now + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.01);
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const soundEngine = new SoundEngine();
