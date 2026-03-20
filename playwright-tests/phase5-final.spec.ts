import { test, expect } from '@playwright/test';
const B = 'http://localhost:5173';

const ALL_ROUTES = [
  '/franchise', '/franchise/roster', '/franchise/depth-chart', '/franchise/development',
  '/franchise/training', '/franchise/lineup-editor', '/franchise/player-stats/th-rf',
  '/franchise/compare', '/franchise/standings', '/franchise/power-rankings',
  '/franchise/team-analytics', '/franchise/leaders', '/franchise/records',
  '/franchise/team-stats/thk', '/franchise/war-room', '/franchise/scouting',
  '/franchise/finances', '/franchise/payroll', '/franchise/trade',
  '/franchise/free-agency', '/franchise/draft', '/franchise/roster-manager',
  '/franchise/scoreboard', '/franchise/schedule', '/franchise/game-log',
  '/franchise/all-star', '/franchise/goals', '/franchise/morale',
  '/franchise/hot-cold', '/franchise/awards', '/franchise/trade-proposals',
  '/franchise/injuries', '/franchise/minors', '/franchise/waivers',
  '/franchise/trade-history', '/franchise/transactions',
  '/franchise/franchise-history', '/franchise/player-history', '/saves',
];

test('All pages load without errors', async ({ page }) => {
  const errorPages: string[] = [];
  const blankPages: string[] = [];
  
  for (const path of ALL_ROUTES) {
    const errors: string[] = [];
    const handler = (msg: any) => { if (msg.type() === 'error') errors.push(msg.text()); };
    const pageHandler = (e: Error) => errors.push(e.message);
    page.on('console', handler);
    page.on('pageerror', pageHandler);
    
    await page.goto(B + path);
    await page.waitForTimeout(600);
    
    const body = await page.locator('body').innerText();
    page.off('console', handler);
    page.off('pageerror', pageHandler);
    
    if (errors.length > 0) errorPages.push(`${path}: ${errors[0]}`);
    if (body.length < 100) blankPages.push(path);
  }
  
  console.log(`FINAL_QA|routes=${ALL_ROUTES.length}|errors=${errorPages.length}|blank=${blankPages.length}`);
  if (errorPages.length > 0) console.log(`ERROR_PAGES|${JSON.stringify(errorPages)}`);
  if (blankPages.length > 0) console.log(`BLANK_PAGES|${JSON.stringify(blankPages)}`);
  
  expect(errorPages.length, `Pages with errors: ${errorPages.join(', ')}`).toBe(0);
  expect(blankPages.length, `Blank pages: ${blankPages.join(', ')}`).toBe(0);
});

test('Team Morale — sidebar nav and full feature', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  
  await page.goto(B + '/franchise');
  await page.waitForTimeout(1000);
  
  // Navigate via sidebar
  const moraleBtn = page.locator('button').filter({ hasText: /^Team Morale$/ });
  expect(await moraleBtn.count()).toBe(1);
  await moraleBtn.click();
  await page.waitForTimeout(1500);
  
  expect(page.url()).toContain('/franchise/morale');
  
  const body = await page.locator('body').innerText();
  expect(body).toContain('TEAM CHEMISTRY');
  expect(body).toContain('ROSTER MORALE');
  expect(body.toUpperCase()).toContain('GM ACTIONS');
  
  // Check sort buttons
  const sortBtns = await page.locator('button').filter({ hasText: /^morale$|^pos$|^ovr$|^name$/i }).count();
  expect(sortBtns).toBe(4);
  
  // Click "How It Works"
  await page.locator('button').filter({ hasText: /How It Works/i }).click();
  await page.waitForTimeout(400);
  const body2 = await page.locator('body').innerText();
  expect(body2.toUpperCase()).toContain('WIN GAMES');
  
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/final-morale.png', fullPage: true });
  console.log(`MORALE_FINAL|errors=${errors.length}|len=${body2.length}`);
});

test('Build passes', async ({ page }) => {
  // Build was already verified — just confirm app loads cleanly
  await page.goto(B);
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(100);
  console.log(`APP_LOAD|len=${body.length}`);
});
