// ── SpriteSheetLoader.ts ──────────────────────────────────────────────────
// Loads sprite sheet images, removes gray/white/checkered backgrounds via
// BackgroundRemover, then slices the cleaned canvas into individual Texture
// objects for Pixi.

import { ImageSource, Texture, Rectangle } from 'pixi.js';
import type { SpriteSheetConfig } from './SpriteConfig.ts';
import { removeBackground } from './BackgroundRemover.ts';

// ── Cache ─────────────────────────────────────────────────────────────────

// Map from cache-key → sliced frame textures
const _frameCache = new Map<string, Texture[]>();

// Map from URL → cleaned canvas (so we only run the pixel pass once per image)
const _canvasCache = new Map<string, HTMLCanvasElement>();

// ── Core loader ───────────────────────────────────────────────────────────

/**
 * Load a sprite sheet from `url`, strip the background, and slice it into a
 * cols×rows grid of Texture objects in row-major order.
 *
 * `trimTop` / `trimBottom` are fractional values (0–1) applied to each grid
 * cell's height to skip blank padding.  E.g. trimTop=0.40, trimBottom=0.74
 * keeps only the middle 34% of each cell where the player content lives.
 *
 * Results are cached — subsequent calls with the same arguments return
 * the cached array immediately without reprocessing.
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

  // ── Step 1: load & clean the image on a canvas ─────────────────────────
  let canvas = _canvasCache.get(url);
  if (canvas === undefined) {
    try {
      canvas = await removeBackground(url);
      _canvasCache.set(url, canvas);
    } catch (err) {
      console.warn('[SpriteSheetLoader] BackgroundRemover failed, using raw image:', err);
      // Fallback: create a plain canvas from the raw image
      canvas = await _loadRawCanvas(url);
      _canvasCache.set(url, canvas);
    }
  }

  // ── Step 2: build a Pixi ImageSource from the canvas ───────────────────
  // ImageSource auto-uploads on first render; no explicit .load() call needed.
  const imgSource = new ImageSource({ resource: canvas });

  const imgW = canvas.width;
  const imgH = canvas.height;
  const cellW = imgW / cols;
  const cellH = imgH / rows;

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

      const frame = new Texture({
        source: imgSource,
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
 * Clear the internal texture and canvas caches (call on scene teardown to
 * free GPU memory and allow GC to collect canvas objects).
 */
export function clearSpriteCache(): void {
  for (const frames of _frameCache.values()) {
    for (const tex of frames) {
      tex.destroy();
    }
  }
  _frameCache.clear();
  _canvasCache.clear();
}

// ── Fallback raw canvas loader ────────────────────────────────────────────

function _loadRawCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error(`SpriteSheetLoader: failed to load ${url}`));
    img.src = url;
  });
}
