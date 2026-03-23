// ── SpriteAnimator.ts ─────────────────────────────────────────────────────
// Manages a single Pixi Sprite and drives frame-based animations from
// a Texture[] strip. Used by SpritePlayerScene to animate each player.

import { Sprite, Ticker } from 'pixi.js';
import type { Texture } from 'pixi.js';

// ── SpriteAnimator ────────────────────────────────────────────────────────

export class SpriteAnimator {
  private sprite: Sprite;
  private _frames: Texture[] = [];
  private _currentFrame = 0;

  // Active animation state
  private _playing = false;
  private _looping = false;
  private _elapsed = 0;
  private _onTick: ((ticker: Ticker) => void) | null = null;
  private _resolve: (() => void) | null = null;

  constructor(initialTexture?: Texture) {
    this.sprite = new Sprite(initialTexture);
    this.sprite.anchor.set(0.5, 1); // pivot at feet / bottom-center
  }

  // ── Sprite access ─────────────────────────────────────────────────

  getSprite(): Sprite {
    return this.sprite;
  }

  // ── Positioning / transform ───────────────────────────────────────

  setPosition(x: number, y: number): void {
    if (this.sprite.destroyed) return;
    this.sprite.x = x;
    this.sprite.y = y;
  }

  setScale(s: number): void {
    // Preserve horizontal flip when re-scaling
    const flipX = this.sprite.scale.x < 0 ? -1 : 1;
    this.sprite.scale.set(flipX * s, s);
  }

  setFlip(horizontal: boolean): void {
    const absX = Math.abs(this.sprite.scale.x);
    this.sprite.scale.x = horizontal ? -absX : absX;
  }

  setVisible(visible: boolean): void {
    this.sprite.visible = visible;
  }

  // ── Frame array preload ───────────────────────────────────────────

  /**
   * Pre-load the frame array so `setFrame()` works before `playAnimation()`
   * has been called.  The first frame is shown immediately.
   */
  loadFrames(frames: Texture[]): void {
    if (frames.length === 0) return;
    this._frames = frames;
    this._currentFrame = 0;
    const first = frames[0];
    if (first !== undefined) {
      this.sprite.texture = first;
    }
  }

  // ── Static frame control ──────────────────────────────────────────

  /**
   * Show a specific frame from the current frame array without animating.
   */
  setFrame(index: number): void {
    if (this._frames.length === 0 || this.sprite.destroyed) return;
    const clamped = Math.max(0, Math.min(index, this._frames.length - 1));
    this._currentFrame = clamped;
    const tex = this._frames[clamped];
    if (tex !== undefined) {
      this.sprite.texture = tex;
    }
  }

  /**
   * Set a static texture directly (e.g. one specific frame texture).
   */
  setTexture(texture: Texture): void {
    this.stop();
    this.sprite.texture = texture;
  }

  // ── Animation playback ────────────────────────────────────────────

  /**
   * Play through `frames` over `duration` milliseconds.
   * If `loop` is true, repeats indefinitely (Promise resolves when stop() is called).
   * If `loop` is false, resolves when the last frame finishes.
   */
  playAnimation(
    frames: Texture[],
    duration: number,
    loop = false,
  ): Promise<void> {
    // Stop any existing animation
    this._stopInternal(false);

    if (frames.length === 0) return Promise.resolve();

    this._frames = frames;
    this._currentFrame = 0;
    this._playing = true;
    this._looping = loop;
    this._elapsed = 0;

    // Show first frame immediately
    const first = frames[0];
    if (first !== undefined) {
      this.sprite.texture = first;
    }

    return new Promise<void>((resolve) => {
      this._resolve = resolve;

      const msPerFrame = duration / frames.length;

      const onTick = (ticker: Ticker) => {
        if (!this._playing || this.sprite.destroyed) {
          this._stopInternal(true);
          return;
        }

        this._elapsed += ticker.deltaMS;

        const frameIndex = Math.floor(this._elapsed / msPerFrame);

        if (frameIndex >= frames.length) {
          if (this._looping) {
            // Loop: wrap around
            this._elapsed = this._elapsed % (msPerFrame * frames.length);
            this._currentFrame = 0;
            const tex = frames[0];
            if (tex !== undefined) {
              this.sprite.texture = tex;
            }
          } else {
            // Done: show last frame and resolve
            const lastTex = frames[frames.length - 1];
            if (lastTex !== undefined) {
              this.sprite.texture = lastTex;
            }
            this._currentFrame = frames.length - 1;
            this._stopInternal(true);
          }
        } else if (frameIndex !== this._currentFrame) {
          this._currentFrame = frameIndex;
          const tex = frames[frameIndex];
          if (tex !== undefined) {
            this.sprite.texture = tex;
          }
        }
      };

      this._onTick = onTick;
      Ticker.shared.add(onTick);
    });
  }

  /**
   * Stop the current animation and hold on the current frame.
   */
  stop(): void {
    this._stopInternal(true);
  }

  private _stopInternal(resolve: boolean): void {
    if (this._onTick !== null) {
      Ticker.shared.remove(this._onTick);
      this._onTick = null;
    }
    this._playing = false;
    if (resolve && this._resolve !== null) {
      const r = this._resolve;
      this._resolve = null;
      r();
    } else {
      this._resolve = null;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  destroy(): void {
    this._stopInternal(false);
    this.sprite.destroy();
  }
}
