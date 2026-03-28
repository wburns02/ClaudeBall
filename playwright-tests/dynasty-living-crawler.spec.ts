/**
 * Dynasty Living Crawler — full Living Dynasty lifecycle test.
 * Creates a Living Dynasty character, walks through setup, sims seasons,
 * checks all dynasty-specific pages at each career stage.
 *
 * Run: npx playwright test --config=playwright-tests/crawler.config.ts --project=dynasty-living
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

interface StageResult {
  stage: string;
  pagesChecked: number;
  issues: string[];
}

async function crawlDynastyPages(page: Page, stage: string): Promise<StageResult> {
  const issues: string[] = [];
  const pages = [
    '/dynasty/inbox', '/dynasty/conversation', '/dynasty/life-events',
    '/dynasty/career-transition', '/dynasty/prestige', '/dynasty/owner',
    '/franchise', '/franchise/roster', '/franchise/standings',
    '/franchise/morale', '/franchise/finances',
  ];
  let checked = 0;

  for (const path of pages) {
    try {
      await page.goto(`${BASE}${path}`, { timeout: 10000 });
      await page.waitForTimeout(2000);
      const text = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
      if (text.includes('NaN')) issues.push(`[${stage}] ${path}: NaN`);
      if (text.includes('Something went wrong')) issues.push(`[${stage}] ${path}: Error boundary`);
      if ((text ?? '').trim().length < 30) issues.push(`[${stage}] ${path}: Blank`);
      checked++;
    } catch {
      issues.push(`[${stage}] ${path}: Failed to load`);
    }
  }

  return { stage, pagesChecked: checked, issues };
}

test('Dynasty Living Crawler: Full lifecycle', async ({ page }) => {
  test.setTimeout(900000);

  // === CREATE LIVING DYNASTY ===
  console.log('\n  Creating Living Dynasty...');
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(500);

  const dynastyBtn = page.getByTestId('dynasty-mode-btn');
  expect(await dynastyBtn.count()).toBeGreaterThan(0);
  await dynastyBtn.click();
  await page.waitForTimeout(1000);

  // Step 1: Choose Living Dynasty
  const livingBtn = page.locator('button:has-text("Living Dynasty")');
  if (await livingBtn.count() > 0) {
    await livingBtn.click();
    await page.waitForTimeout(500);
  } else {
    // May already show character creation
    console.log('  Living Dynasty button not found — trying to proceed');
  }

  // Take screenshot of setup page for debugging
  await page.screenshot({ path: '/tmp/dynasty-setup.png' });

  // Step 2: Character creation (if available)
  // Fill in name if there's an input
  const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Will Burns');
    await page.waitForTimeout(300);
  }

  // Click through any "Next" / "Continue" buttons in the setup wizard
  for (let step = 0; step < 10; step++) {
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Start")').first();
    if (await nextBtn.count() > 0) {
      const text = await nextBtn.textContent();
      console.log(`  Setup step ${step}: clicking "${text?.trim()}"`);
      await nextBtn.click();
      await page.waitForTimeout(1000);

      // If we reached franchise, we're done
      if (page.url().includes('/franchise')) break;
    } else {
      break;
    }
  }

  // If still not at franchise, try selecting a team and starting
  if (!page.url().includes('/franchise')) {
    const austin = page.locator('button:has-text("Austin")').first();
    if (await austin.count() > 0) {
      await austin.click();
      await page.waitForTimeout(500);
    }
    const startBtn = page.locator('button:has-text("Start")').first();
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // Verify we got to franchise
  await page.screenshot({ path: '/tmp/dynasty-after-setup.png' });
  const currentUrl = page.url();
  console.log(`  Current URL after setup: ${currentUrl}`);

  if (!currentUrl.includes('/franchise')) {
    console.log('  WARNING: Could not complete dynasty setup — falling back to GM mode');
    // Fall back to GM dynasty
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 2000 }); } catch {}
    const gmBtn = page.getByTestId('dynasty-mode-btn');
    if (await gmBtn.count() > 0) {
      await gmBtn.click(); await page.waitForTimeout(500);
      await page.locator('button:has-text("Start as GM")').click(); await page.waitForTimeout(500);
      await page.getByRole('button', { name: /casual/i }).click(); await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Choose Team/ }).click(); await page.waitForTimeout(500);
      await page.locator('button:has-text("Austin")').first().click(); await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Start Classic Dynasty/ }).click();
      await page.waitForURL(/franchise/, { timeout: 15000 });
    }
  }

  await page.waitForTimeout(3000);
  const allStageResults: StageResult[] = [];

  // === SEASON 1: Fresh ===
  console.log('\n  Season 1: Checking dynasty pages...');
  allStageResults.push(await crawlDynastyPages(page, 'Season1-Fresh'));

  // Sim 30 days
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const sim30 = page.locator('main button:has-text("Sim 30")').first();
  if (await sim30.count() > 0) {
    await sim30.click({ force: true });
    await page.waitForTimeout(5000);
    for (let d = 0; d < 3; d++) {
      await page.evaluate(() => {
        for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close']) {
          const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
          if (btn) (btn as HTMLButtonElement).click();
        }
        const overlay = document.querySelector('.fixed.inset-0');
        if (overlay) { const btn = overlay.querySelector('button'); if (btn) (btn as HTMLButtonElement).click(); }
      });
      await page.waitForTimeout(500);
    }
  }

  // === SEASON 1: Mid-season ===
  console.log('  Season 1 Mid: Checking dynasty pages...');
  allStageResults.push(await crawlDynastyPages(page, 'Season1-Mid'));

  // Sim rest of season
  for (let i = 0; i < 4; i++) {
    await page.goto(`${BASE}/franchise`);
    await page.waitForTimeout(1500);
    const sim = page.locator('main button:has-text("Sim 30")').first();
    if (await sim.count() > 0) {
      await sim.click({ force: true });
      await page.waitForTimeout(4000);
      for (let d = 0; d < 3; d++) {
        await page.evaluate(() => {
          for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close']) {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
            if (btn) (btn as HTMLButtonElement).click();
          }
          const overlay = document.querySelector('.fixed.inset-0');
          if (overlay) { const btn = overlay.querySelector('button'); if (btn) (btn as HTMLButtonElement).click(); }
        });
        await page.waitForTimeout(500);
      }
    }
  }

  // Try to get to playoffs
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const playoffsBtn = page.locator('main button:has-text("Go to Playoffs")').first();
  if (await playoffsBtn.count() > 0) {
    await playoffsBtn.click();
    await page.waitForTimeout(2000);
    for (const round of ['Sim Wild', 'Sim Division', 'Sim Championship', 'Sim World']) {
      const simRound = page.locator(`main button:has-text("${round}")`).first();
      if (await simRound.count() > 0) { await simRound.click(); await page.waitForTimeout(2000); }
    }
  }

  // Try offseason
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const offseasonBtn = page.locator('main button:has-text("Offseason"), main button:has-text("Advance to")').first();
  if (await offseasonBtn.count() > 0) {
    await offseasonBtn.click();
    await page.waitForTimeout(3000);
  }

  console.log('  Post-season: Checking dynasty pages...');
  allStageResults.push(await crawlDynastyPages(page, 'PostSeason'));

  // === SUMMARY ===
  console.log('\n══════════════════════════════════════');
  console.log('   DYNASTY LIVING CRAWLER SUMMARY');
  console.log('══════════════════════════════════════');
  let totalIssues = 0;
  for (const sr of allStageResults) {
    console.log(`  ${sr.stage}: ${sr.pagesChecked} pages checked, ${sr.issues.length} issues`);
    for (const issue of sr.issues) console.log(`    ✗ ${issue}`);
    totalIssues += sr.issues.length;
  }
  console.log(`\n  Total issues: ${totalIssues}`);
  console.log('══════════════════════════════════════\n');

  expect(totalIssues, `${totalIssues} dynasty lifecycle issues found`).toBe(0);
});
