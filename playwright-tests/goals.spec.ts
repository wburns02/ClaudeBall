import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
const base = 'http://localhost:5173';
const SS = '/tmp/goals-shots';

async function spa(page: any, path: string) {
  await page.evaluate((p: string) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test.beforeAll(() => { execSync(`mkdir -p ${SS}`); });

test('Full goals feature verification', async ({ page }) => {
  await page.goto(base);
  await page.waitForTimeout(2000);

  // Setup franchise
  const newFranchise = page.locator('button:has-text("New Franchise")');
  if (await newFranchise.count() > 0) {
    await newFranchise.click();
    await page.waitForTimeout(600);
    const team = page.locator('button').filter({ hasText: /Austin/ }).first();
    if (await team.count() > 0) await team.click();
    await page.waitForTimeout(400);
    const start = page.locator('button:has-text("Start Season")');
    if (await start.count() > 0) { await start.click(); await page.waitForTimeout(2000); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Go to franchise and sim 30 days
  await spa(page, '/franchise');
  await page.waitForTimeout(1500);
  const sim30 = page.locator('button:has-text("Sim 30 Days")');
  if (await sim30.count() > 0) { await sim30.click(); await page.waitForTimeout(3000); }

  // Check dashboard for Owner widget
  await spa(page, '/franchise');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/dashboard.png`, fullPage: true });
  const dashBody = await page.textContent('body') ?? '';
  const hasOwnerWidget = dashBody.includes("Owner") || dashBody.includes("Confidence");
  console.log(`DASHBOARD|len=${dashBody.length}|hasOwnerWidget=${hasOwnerWidget}`);

  // Check sidebar for Owner's Office link
  const sidebarLinks = await page.locator('a').allTextContents();
  const hasOwnerLink = sidebarLinks.some(t => t.includes("Owner"));
  console.log(`SIDEBAR|hasOwnerLink=${hasOwnerLink}|links=${JSON.stringify(sidebarLinks.slice(0,20))}`);

  // Check goals page
  await spa(page, '/franchise/goals');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/goals-full.png`, fullPage: true });
  const goalsBody = await page.textContent('body') ?? '';
  console.log(`GOALS|len=${goalsBody.length}|preview="${goalsBody.replace(/\s+/g,' ').substring(500, 900)}"`);

  expect(goalsBody.length).toBeGreaterThan(800);
  expect(goalsBody).toContain('Owner');
});
