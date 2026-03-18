// ── BackgroundRemover.ts ───────────────────────────────────────────────────
// Loads an image into a Canvas2D context and removes gray/white/checkered
// backgrounds by zeroing the alpha of "background-like" pixels.
//
// Rules (evaluated per pixel BEFORE alpha removal):
//  1. Any pixel where (R+G+B)/3 > 185 → transparent (light gray / white)
//  2. Extra catch for the classic checkered mid-gray (170–220, nearly neutral)
//  3. Protected from removal:
//     - Skin tones: R > G > B and (R - B) > 30
//     - Glove/brown leather: R > 100 and G > 60 and B < 80
//     - Uniform colors: strong hue saturation — skip if max(R,G,B) - min(R,G,B) > 40
//       AND the brightest channel is not R≈G≈B (i.e., it isn't gray)

/**
 * Remove light gray / white / checkered backgrounds from a JPG image.
 *
 * @param imageUrl  URL of the sprite sheet (relative or absolute)
 * @returns         A canvas with the background pixels zeroed out (alpha = 0)
 */
export async function removeBackground(imageUrl: string): Promise<HTMLCanvasElement> {
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

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;

    if (_shouldRemove(r, g, b)) {
      data[i + 3] = 0; // zero alpha → transparent
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ── Per-pixel decision ────────────────────────────────────────────────────

function _shouldRemove(r: number, g: number, b: number): boolean {
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
