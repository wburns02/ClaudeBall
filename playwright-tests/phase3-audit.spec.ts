import { test } from '@playwright/test';
const base = 'http://localhost:5173';
const SS = '/tmp/phase3-shots';

async function spa(page: any, path: string) {
  await page.evaluate((p: string) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function setupAndAdvance(page: any) {
  await page.goto(base);
  await page.waitForTimeout(2000);
  // If franchise not loaded, set it up
  const startBtn = page.locator('button:has-text("Start New Franchise")');
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForTimeout(500);
    const team = page.locator('button').filter({ hasText: /Austin/ }).first();
    if (await team.count() > 0) await team.click();
    await page.waitForTimeout(300);
    const startSeason = page.locator('button:has-text("Start Season")');
    if (await startSeason.count() > 0) await startSeason.click();
    await page.waitForTimeout(1500);
  }
  // Advance some days to get stats
  for (let i = 0; i < 15; i++) {
    const advBtn = page.locator('button:has-text("Advance Day"), button:has-text("Auto-Sim")').first();
    if (await advBtn.count() > 0) {
      await advBtn.click();
      await page.waitForTimeout(300);
    } else break;
  }
  await page.waitForTimeout(1000);
}

test('Snapshot key pages with franchise', async ({ page }) => {
  await setupAndAdvance(page);
  
  const pages = [
    '/franchise/development',
    '/franchise/training', 
    '/franchise/war-room',
    '/franchise/news',
    '/franchise/hot-cold',
    '/franchise/depth-chart',
    '/franchise/power-rankings',
    '/franchise/leaders',
    '/franchise/transactions',
    '/franchise/injuries',
  ];
  
  for (const p of pages) {
    await spa(page, p);
    await page.waitForTimeout(1000);
    const name = p.replace(/\//g, '-').replace(/^-franchise-/, '');
    await page.screenshot({ path: `${SS}/${name}.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`${name}|len=${body.length}`);
  }
});
