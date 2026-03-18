// ── SpriteSheetLoader.ts ──────────────────────────────────────────────────
// Loads sprite sheet images and slices them into individual frame Texture objects.
// Sprites are JPG files with gray/checkered backgrounds (no true transparency).
// The backgrounds are acceptable on the dark diamond field.

import { Assets, Texture, Rectangle } from 'pixi.js';
import type { SpriteSheetConfig } from './SpriteConfig.ts';

// ── Cache ─────────────────────────────────────────────────────────────────

// Map from URL → sliced frame textures
const _frameCache = new Map<string, Texture[]>();

// ── Core loader ───────────────────────────────────────────────────────────

/**
 * Load a sprite sheet from `url` and slice it into a cols×rows grid.
 * Returns an array of Texture objects in row-major order:
 *   frame 0 = top-left, frame 1 = next to right, ..., wrapping to next row.
 *
 * `trimTop` / `trimBottom` are fractional values (0–1) applied to each grid
 * cell's height to skip blank background padding at the top and bottom of each
 * frame. For example: trimTop=0.40, trimBottom=0.74 keeps only the middle
 * 34% of each cell's height where the actual player content lives.
 *
 * Results are cached — subsequent calls with the same arguments return
 * the cached array immediately.
 */
export async function loadSpriteSheet(
  url: string,
  cols: number,
  rows: number,
  trimTop = 0,
  trimBottom = 1,
): Promise<Texture[]> {
  const cacheKey = `${url}:${cols}x${rows}:${trimTop}:${trimBottom}`;

  const cached = _frameCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Load the base texture via Pixi's asset pipeline
  const baseTexture = await Assets.load<Texture>(url);

  const cellW = baseTexture.width / cols;
  const cellH = baseTexture.height / rows;

  // Apply vertical trim: slice only [trimTop…trimBottom] of each cell's height
  const sliceOffsetY = cellH * trimTop;
  const sliceH       = cellH * (trimBottom - trimTop);

  const frames: Texture[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const rect = new Rectangle(
        Math.round(col * cellW),
        Math.round(row * cellH + sliceOffsetY),
        Math.round(cellW),
        Math.round(sliceH),
      );

      // Pixi 8: Texture.from with a frame requires using the source + frame API
      const frame = new Texture({
        source: baseTexture.source,
        frame: rect,
      });

      frames.push(frame);
    }
  }

  _frameCache.set(cacheKey, frames);
  return frames;
}

/**
 * Convenience wrapper: load a SpriteSheetConfig object.
 * Passes trimTop/trimBottom through to the slicer if provided.
 */
export async function loadSheet(config: SpriteSheetConfig): Promise<Texture[]> {
  return loadSpriteSheet(
    config.url,
    config.cols,
    config.rows,
    config.trimTop ?? 0,
    config.trimBottom ?? 1,
  );
}

/**
 * Preload multiple sprite sheets in parallel.
 * Returns a map from URL to frame arrays.
 */
export async function preloadSheets(
  configs: SpriteSheetConfig[],
): Promise<Map<string, Texture[]>> {
  const results = await Promise.all(
    configs.map(async (cfg) => {
      const frames = await loadSheet(cfg);
      return [cfg.url, frames] as [string, Texture[]];
    }),
  );
  return new Map(results);
}

/**
 * Clear the internal texture cache (call on scene teardown to free GPU memory).
 */
export function clearSpriteCache(): void {
  for (const frames of _frameCache.values()) {
    for (const tex of frames) {
      tex.destroy();
    }
  }
  _frameCache.clear();
}
