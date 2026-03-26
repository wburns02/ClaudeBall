import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test('Simulate 20-year dynasty career', async ({ page }) => {
  test.setTimeout(1200000); // 20 minutes

  // === CREATE DYNASTY ===
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(500);

  await page.getByTestId('dynasty-mode-btn').click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Start as GM")').click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /casual/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Choose Team/ }).click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Austin")').first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Start Classic Dynasty/ }).click();
  await page.waitForURL(/franchise/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log('Franchise created.');

  const seasonResults: string[] = [];

  for (let season = 0; season < 20; season++) {
    // Ensure on dashboard
    await page.goto(`${BASE}/franchise`);
    await page.waitForTimeout(2000);

    // === SIM ENTIRE SEASON VIA JS (bypasses overlay issues) ===
    const simResult = await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      const findMainBtn = (text: string) => {
        const main = document.querySelector('main');
        if (!main) return null;
        return [...main.querySelectorAll('button')].find(b => b.textContent?.includes(text)) ?? null;
      };

      const dismissAll = async () => {
        for (let i = 0; i < 5; i++) {
          await sleep(300);
          // Click any overlay buttons
          for (const text of ['View Results', 'Dismiss', '✕ Dismiss']) {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim().includes(text));
            if (btn) { btn.click(); await sleep(300); }
          }
          // Click fixed overlays
          const overlay = document.querySelector('.fixed.inset-0.bg-black');
          if (overlay) {
            const overlayBtn = overlay.querySelector('button');
            if (overlayBtn) { overlayBtn.click(); await sleep(300); }
          }
        }
      };

      // Sim season
      for (let batch = 0; batch < 8; batch++) {
        const sim30 = findMainBtn('Sim 30 Days');
        if (!sim30) break;
        sim30.click();
        await sleep(2500);
        await dismissAll();
      }

      // Get record
      const main = document.querySelector('main');
      const text = main?.textContent ?? '';
      const match = text.match(/(\d+)-(\d+)\s+\.(\d{3})/);
      const record = match ? `${match[1]}-${match[2]}` : '?';

      // Check for playoffs
      let playoffs = false;
      const poBtn = findMainBtn('Go to Playoffs');
      if (poBtn) { playoffs = true; }

      return { record, playoffs };
    });

    // Handle playoffs if qualified
    if (simResult.playoffs) {
      try {
        await page.locator('main button:has-text("Go to Playoffs")').first().click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        for (const round of ['Sim Wild Card', 'Sim Division', 'Sim Championship', 'Sim World Series']) {
          try {
            await page.locator(`main button:has-text("${round}")`).first().click({ timeout: 3000 });
            await page.waitForTimeout(2000);
          } catch {}
        }
      } catch {}
    }

    // Go to offseason and advance
    await page.goto(`${BASE}/franchise/offseason`);
    await page.waitForTimeout(2000);

    let advanced = false;
    try {
      await page.locator('main button:has-text("Advance to")').first().click({ timeout: 5000 });
      advanced = true;
      await page.waitForTimeout(3000);
    } catch {}

    if (!advanced) {
      // Try from dashboard
      await page.goto(`${BASE}/franchise`);
      await page.waitForTimeout(2000);
      try {
        await page.locator('main button:has-text("Offseason Hub")').first().click({ timeout: 3000 });
        await page.waitForTimeout(1500);
        await page.locator('main button:has-text("Advance to")').first().click({ timeout: 5000 });
        advanced = true;
        await page.waitForTimeout(3000);
      } catch {}
    }

    if (!advanced) {
      seasonResults.push(`S${season + 2}: ${simResult.record}${simResult.playoffs ? ' PO' : ''} — STUCK`);
      console.log(`Season ${season + 2}: STUCK`);
      break;
    }

    // Get year
    const yearText = await page.locator('main').first().textContent({ timeout: 5000 }).catch(() => '');
    const yearMatch = yearText.match(/(\d{4}) Season/);
    const year = yearMatch ? yearMatch[1] : `${2027 + season}`;

    seasonResults.push(`${year}: ${simResult.record}${simResult.playoffs ? ' PO' : ''}`);
    console.log(`Season ${season + 2} (${year}): ${simResult.record}${simResult.playoffs ? ' PO' : ''}`);
  }

  console.log('\n========= 20-YEAR DYNASTY CAREER =========');
  for (const r of seasonResults) console.log(r);
  console.log('===========================================\n');

  expect(seasonResults.length).toBeGreaterThanOrEqual(5);
  expect(seasonResults.filter(r => r.includes('STUCK'))).toHaveLength(0);
});
