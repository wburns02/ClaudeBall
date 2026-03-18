// ── BackgroundRemover.ts ───────────────────────────────────────────────────
// Loads an image into a Canvas2D context and removes gray/white/checkered
// backgrounds by zeroing the alpha of "background-like" pixels.
//
// Rules for GRAY backgrounds (old JPG sprites — evaluated per pixel):
//  1. Any pixel where (R+G+B)/3 > 185 → transparent (light gray / white)
//  2. Extra catch for the classic checkered mid-gray (170–220, nearly neutral)
//  3. Protected from removal:
//     - Skin tones: R > G > B and (R - B) > 30
//     - Glove/brown leather: R > 100 and G > 60 and B < 80
//     - Uniform colors: strong hue saturation — skip if max(R,G,B) - min(R,G,B) > 40
//       AND the brightest channel is not R≈G≈B (i.e., it isn't gray)
//
// Rules for GREEN (#00FF00) chroma-key backgrounds (v2 PNG sprites):
//  - Pure green: G > 200 AND R < 100 AND B < 100 → alpha = 0
//  - Near-green: G > 180 AND G > R*1.5 AND G > B*1.5 → alpha reduced proportionally
//  - Anti-aliasing: partially-green edge pixels get alpha reduced proportionally
//    rather than a hard 0/255 cutoff

/**
 * Remove backgrounds from a sprite sheet image.
 *
 * For v2 PNG sprites (green #00FF00 chroma-key), supply isGreenScreen=true.
 * For legacy JPG sprites (gray/white/checkered), supply isGreenScreen=false (default).
 *
 * @param imageUrl      URL of the sprite sheet (relative or absolute)
 * @param isGreenScreen Whether the background is green (#00FF00) chroma-key
 * @returns             A canvas with the background pixels zeroed out (alpha = 0)
 */
export async function removeBackground(
  imageUrl: string,
  isGreenScreen = false,
): Promise<HTMLCanvasElement> {
  // Load the image
  const img = await _loadImage(imageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: return canvas with the image drawn (no transparency)
    const fallback = document.createElement('canvas');
    fallback.width = img.naturalWidth;
    fallback.height = img.naturalHeight;
    const fc = fallback.getContext('2d');
    fc?.drawImage(img, 0, 0);
    return fallback;
  }

  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data; // RGBA flat array

  if (isGreenScreen) {
    // ── Green chroma-key pass ───────────────────────────────────────────────
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;

      const alphaReduction = _greenScreenAlpha(r, g, b);
      if (alphaReduction > 0) {
        // Reduce alpha proportionally (anti-aliasing at edges)
        const currentAlpha = data[i + 3]!;
        data[i + 3] = Math.round(currentAlpha * (1 - alphaReduction));
      }
    }
  } else {
    // ── Legacy gray/white/checkered pass ───────────────────────────────────
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;

      if (_shouldRemoveGray(r, g, b)) {
        data[i + 3] = 0; // zero alpha → transparent
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ── Green chroma-key: returns a 0–1 removal fraction ──────────────────────
// 0   = keep pixel fully (not green at all)
// 1   = remove pixel fully (pure green background)
// 0–1 = partial removal for anti-aliased edges

function _greenScreenAlpha(r: number, g: number, b: number): number {
  // Pure bright green (#00FF00): hard remove
  if (g > 200 && r < 100 && b < 100) {
    return 1;
  }

  // Darker green backgrounds (Grok often generates ~R=32,G=174,B=92):
  // Green must be dominant channel and significantly higher than red
  if (g > 140 && g > r * 1.3 && g > b * 1.2 && r < 120) {
    // How green-dominant is this pixel?
    const greenDominance = (g - Math.max(r, b)) / g;
    if (greenDominance > 0.25) {
      // Strong green dominance — likely background
      const strength = Math.min(1, (greenDominance - 0.25) / 0.35);
      return 0.3 + strength * 0.7; // 0.3 to 1.0
    }
  }

  // Near-green fringe (anti-aliasing edges)
  if (g > 160 && g > r * 1.5 && g > b * 1.5) {
    const greenExcess = (g - 160) / 95;
    const dominance = Math.min(
      (g - r * 1.5) / 100,
      (g - b * 1.5) / 100,
    );
    const fraction = Math.min(1, Math.max(0, (greenExcess + dominance) / 2));
    return fraction;
  }

  return 0; // not green — keep fully
}

// ── Legacy gray/white/checkered per-pixel decision ─────────────────────────

function _shouldRemoveGray(r: number, g: number, b: number): boolean {
  const avg = (r + g + b) / 3;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const saturation = maxC - minC; // 0 = fully gray, high = colorful

  // ── Keep colorful pixels (uniforms, equipment with strong hue) ──────────
  // If saturation is high the pixel is clearly not a gray/white background
  if (saturation > 40) {
    // But still check for light-colored uniforms that LOOK saturated but are
    // actually near-white (e.g., light yellow #ffffcc).  Those should be removed.
    // Rule: if all channels are still above 210, it's probably a light-cream bg.
    if (r > 210 && g > 210 && b > 210) {
      return true; // near-white, remove
    }
    return false; // genuinely colorful — keep
  }

  // ── Protect skin tones ───────────────────────────────────────────────────
  // Skin: R > G > B and the red–blue gap is meaningful (warm cast)
  if (r > g && g >= b && (r - b) > 30 && r > 120) {
    return false;
  }

  // ── Protect glove / brown leather ────────────────────────────────────────
  if (r > 100 && g > 55 && b < 85 && r > g && g > b) {
    return false;
  }

  // ── Protect dark hair / shadow tones ─────────────────────────────────────
  if (avg < 80) {
    return false; // dark pixel — keep (shadow, dark uniform)
  }

  // ── Remove light gray, mid-gray checkered, and white ─────────────────────
  // Primary threshold: average brightness > 185 with low saturation
  if (avg > 185 && saturation <= 40) {
    return true;
  }

  // Extended mid-gray checkered pattern: 160–225 range, very neutral
  if (avg > 160 && saturation <= 20) {
    return true;
  }

  return false;
}

// ── Image loader helper ────────────────────────────────────────────────────

function _loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`BackgroundRemover: failed to load image: ${url}`));
    img.src = url;
  });
}
