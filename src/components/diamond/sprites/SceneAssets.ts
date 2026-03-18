// ── SceneAssets.ts ─────────────────────────────────────────────────────────
// Loads environment / scene assets: stadium background, weather sky panels,
// scoreboard decoration, home-run celebration sprites, and dust effect overlays.
//
// Each group:
//   stadium    — loaded raw (not green-screened)
//   weather    — loaded raw 2×2 panel grid
//   scoreboard — green-screen chroma-key removal applied
//   homerun    — green-screen chroma-key removal applied
//   dirtDust   — green-screen chroma-key removal, irregular crop rects
//
// Call loadSceneAssets() once after DiamondRenderer init. All results are
// cached in module scope so repeated calls are free.

import { ImageSource, Texture, Rectangle } from 'pixi.js';
import { removeBackground } from './BackgroundRemover.ts';
import { WEATHER_FRAMES, HOMERUN_EFFECT_FRAMES, DUST_CROP_RECTS } from './SpriteConfig.ts';
import type { WeatherType } from './SpriteConfig.ts';

// ── Public shape ───────────────────────────────────────────────────────────

export interface SceneAssets {
  /** Raw full stadium-panorama texture (use as-is). */
  stadiumTexture: Texture;
  /** 4 weather sky textures indexed by WeatherType. */
  weatherTextures: Record<WeatherType, Texture>;
  /** Scoreboard decoration texture (green-screen removed). */
  scoreboardTexture: Texture;
  /** 6 home-run celebration frame textures (green-screen removed). */
  homerunFrames: Texture[];
  /** Named dust-effect crop textures (green-screen removed). */
  dustTextures: Partial<Record<keyof typeof DUST_CROP_RECTS, Texture>>;
}

// ── Module-level cache ─────────────────────────────────────────────────────

let _cached: SceneAssets | null = null;
let _loading: Promise<SceneAssets> | null = null;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Load all scene/environment assets. Idempotent — returns cached result on
 * subsequent calls. Logs warnings on partial failures rather than throwing,
 * so the diamond still renders even if some assets fail to load.
 */
export async function loadSceneAssets(): Promise<SceneAssets> {
  if (_cached !== null) return _cached;
  if (_loading !== null) return _loading;

  _loading = _doLoad();
  _cached = await _loading;
  return _cached;
}

/** Destroy all cached textures (call on scene teardown). */
export function clearSceneAssets(): void {
  if (_cached) {
    _cached.stadiumTexture.destroy();
    Object.values(_cached.weatherTextures).forEach((t) => (t as Texture).destroy());
    _cached.scoreboardTexture.destroy();
    _cached.homerunFrames.forEach((t) => t.destroy());
    Object.values(_cached.dustTextures).forEach((t) => (t as Texture | undefined)?.destroy());
    _cached = null;
    _loading = null;
  }
}

// ── Internal loader ────────────────────────────────────────────────────────

async function _doLoad(): Promise<SceneAssets> {
  const [stadiumTexture, weatherTextures, scoreboardTexture, homerunFrames, dustTextures] =
    await Promise.all([
      _loadRawTexture('/sprites/stadium1.png'),
      _loadWeather('/sprites/weather1.png'),
      _loadGreenScreenTexture('/sprites/scoreboard.png'),
      _loadHomerunFrames('/sprites/homerun1.png'),
      _loadDustTextures('/sprites/dirtdust2.png'),
    ]);

  return {
    stadiumTexture,
    weatherTextures,
    scoreboardTexture,
    homerunFrames,
    dustTextures,
  };
}

// ── Raw texture (no background removal) ───────────────────────────────────

async function _loadRawTexture(url: string): Promise<Texture> {
  try {
    const canvas = await _loadImageToCanvas(url);
    const src = new ImageSource({ resource: canvas });
    return new Texture({ source: src });
  } catch (err) {
    console.warn(`[SceneAssets] Failed to load ${url}:`, err);
    return Texture.EMPTY;
  }
}

// ── Weather 2×2 grid ───────────────────────────────────────────────────────

async function _loadWeather(url: string): Promise<Record<WeatherType, Texture>> {
  const fallback: Record<WeatherType, Texture> = {
    day: Texture.EMPTY,
    sunset: Texture.EMPTY,
    night: Texture.EMPTY,
    overcast: Texture.EMPTY,
  };

  try {
    const canvas = await _loadImageToCanvas(url);
    const src = new ImageSource({ resource: canvas });
    const W = canvas.width;
    const H = canvas.height;
    const cw = W / 2;
    const ch = H / 2;

    const keys = Object.keys(WEATHER_FRAMES) as WeatherType[];
    const result: Record<WeatherType, Texture> = { ...fallback };

    for (const key of keys) {
      const idx = WEATHER_FRAMES[key];
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const rect = new Rectangle(col * cw, row * ch, cw, ch);
      result[key] = new Texture({ source: src, frame: rect });
    }

    return result;
  } catch (err) {
    console.warn(`[SceneAssets] Failed to load weather ${url}:`, err);
    return fallback;
  }
}

// ── Green-screen single texture ────────────────────────────────────────────

async function _loadGreenScreenTexture(url: string): Promise<Texture> {
  try {
    const canvas = await removeBackground(url, /* isGreenScreen */ true);
    const src = new ImageSource({ resource: canvas });
    return new Texture({ source: src });
  } catch (err) {
    console.warn(`[SceneAssets] Failed to load green-screen ${url}:`, err);
    return Texture.EMPTY;
  }
}

// ── Home-run 3×2 grid (green-screen) ──────────────────────────────────────

async function _loadHomerunFrames(url: string): Promise<Texture[]> {
  const frameCount = Object.keys(HOMERUN_EFFECT_FRAMES).length; // 6
  const fallback = Array.from({ length: frameCount }, () => Texture.EMPTY);

  try {
    const canvas = await removeBackground(url, /* isGreenScreen */ true);
    const src = new ImageSource({ resource: canvas });
    const W = canvas.width;
    const H = canvas.height;
    const cols = 3;
    const rows = 2;
    const cw = W / cols;
    const ch = H / rows;

    const frames: Texture[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const rect = new Rectangle(col * cw, row * ch, cw, ch);
        frames.push(new Texture({ source: src, frame: rect }));
      }
    }
    return frames;
  } catch (err) {
    console.warn(`[SceneAssets] Failed to load homerun frames ${url}:`, err);
    return fallback;
  }
}

// ── Dust sprites (green-screen, irregular crop rects) ─────────────────────

async function _loadDustTextures(
  url: string,
): Promise<Partial<Record<keyof typeof DUST_CROP_RECTS, Texture>>> {
  const fallback: Partial<Record<keyof typeof DUST_CROP_RECTS, Texture>> = {};

  try {
    const canvas = await removeBackground(url, /* isGreenScreen */ true);
    const src = new ImageSource({ resource: canvas });
    const imgW = canvas.width;
    const imgH = canvas.height;

    // Scale the hardcoded pixel rects to actual image dimensions.
    // The rects were defined assuming a 600×400 reference image.
    // Scale proportionally if image is larger / smaller.
    const refW = 600;
    const refH = 400;
    const scaleX = imgW / refW;
    const scaleY = imgH / refH;

    const result: Partial<Record<keyof typeof DUST_CROP_RECTS, Texture>> = {};

    for (const [key, r] of Object.entries(DUST_CROP_RECTS) as [keyof typeof DUST_CROP_RECTS, { x: number; y: number; w: number; h: number }][]) {
      const rect = new Rectangle(
        Math.round(r.x * scaleX),
        Math.round(r.y * scaleY),
        Math.round(r.w * scaleX),
        Math.round(r.h * scaleY),
      );
      result[key] = new Texture({ source: src, frame: rect });
    }

    return result;
  } catch (err) {
    console.warn(`[SceneAssets] Failed to load dust sprites ${url}:`, err);
    return fallback;
  }
}

// ── Canvas loader helper (no background removal) ───────────────────────────

function _loadImageToCanvas(url: string): Promise<HTMLCanvasElement> {
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
    img.onerror = () => reject(new Error(`SceneAssets: failed to load ${url}`));
    img.src = url;
  });
}
