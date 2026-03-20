import { test, expect } from '@playwright/test';
const B = 'http://localhost:5173';

test('Phase 4: Dashboard polish check', async ({ page }) => {
  await page.goto(B + '/franchise/dashboard');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  console.log(`DASHBOARD_CONTENT|${body.slice(0, 500)}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-dashboard.png', fullPage: false });
  expect(body.length).toBeGreaterThan(100);
});

test('Phase 4: Roster page polish', async ({ page }) => {
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  // Check buttons have proper states
  const buttons = page.locator('button');
  const count = await buttons.count();
  console.log(`ROSTER_BUTTON_COUNT|${count}`);
  const rows = page.locator('tr.cursor-pointer');
  const rowCount = await rows.count();
  console.log(`ROSTER_ROW_COUNT|${rowCount}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-roster.png', fullPage: false });
  expect(rowCount).toBeGreaterThan(0);
});

test('Phase 4: Player modal animation and states', async ({ page }) => {
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  const row = page.locator('tr.cursor-pointer').first();
  if (await row.count() > 0) {
    await row.click();
    await page.waitForTimeout(400);
    // Check modal has proper structure
    const modal = page.locator('[role="dialog"]');
    expect(await modal.count()).toBe(1);
    // Check close button
    const closeBtn = page.locator('button[aria-label="Close"]');
    expect(await closeBtn.count()).toBe(1);
    // Check action buttons
    const viewBtn = page.locator('button').filter({ hasText: /View Full Stats/ });
    expect(await viewBtn.count()).toBeGreaterThan(0);
    await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-modal-open.png', fullPage: false });
  }
});

test('Phase 4: Hot cold page polish', async ({ page }) => {
  await page.goto(B + '/franchise/hot-cold');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  const hasClickHint = body.includes('Click any row');
  console.log(`HOTCOLD_CLICK_HINT|${hasClickHint}`);
  const rows = page.locator('tr.cursor-pointer');
  const rowCount = await rows.count();
  console.log(`HOTCOLD_ROW_COUNT|${rowCount}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-hotcold.png', fullPage: false });
  expect(rowCount).toBeGreaterThan(0);
});

test('Phase 4: Goals / Owner Office has CTAs', async ({ page }) => {
  await page.goto(B + '/franchise/goals');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  const hasQuickActions = body.includes('Standings') || body.includes('Manage Roster');
  console.log(`GOALS_HAS_CTAS|${hasQuickActions}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-goals.png', fullPage: false });
  expect(hasQuickActions).toBe(true);
});

test('Phase 4: Finances page has action buttons', async ({ page }) => {
  await page.goto(B + '/franchise/finances');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  const hasPayroll = body.includes('Payroll') || body.includes('payroll');
  console.log(`FINANCES_HAS_ACTIONS|${hasPayroll}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-finances.png', fullPage: false });
  expect(hasPayroll).toBe(true);
});

test('Phase 4: Scouting upgrade feedback', async ({ page }) => {
  await page.goto(B + '/franchise/scouting');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  console.log(`SCOUTING_CONTENT|${body.slice(0, 600)}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-scouting.png', fullPage: false });
  expect(body.length).toBeGreaterThan(50);
});

test('Phase 4: Trade page empty state', async ({ page }) => {
  await page.goto(B + '/franchise/trade');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  console.log(`TRADE_CONTENT|${body.slice(0, 600)}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-trade.png', fullPage: false });
  expect(body.length).toBeGreaterThan(50);
});

test('Phase 4: Training center functionality', async ({ page }) => {
  await page.goto(B + '/franchise/training');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  const hasPlayers = body.length > 200;
  console.log(`TRAINING_CONTENT_LEN|${body.length}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-training.png', fullPage: false });
  expect(hasPlayers).toBe(true);
});

test('Phase 4: Free Agency page', async ({ page }) => {
  await page.goto(B + '/franchise/free-agency');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  const rows = page.locator('tr');
  const count = await rows.count();
  console.log(`FA_ROW_COUNT|${count}`);
  console.log(`FA_CONTENT|${body.slice(0, 400)}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-fa.png', fullPage: false });
  expect(body.length).toBeGreaterThan(100);
});

test('Phase 4: Standings page', async ({ page }) => {
  await page.goto(B + '/franchise/standings');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  console.log(`STANDINGS_CONTENT|${body.slice(0, 400)}`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-standings.png', fullPage: false });
  expect(body.length).toBeGreaterThan(100);
});

test('Phase 4: Player stats detail page', async ({ page }) => {
  // Navigate via roster → modal → View Full Stats
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  const row = page.locator('tr.cursor-pointer').first();
  if (await row.count() > 0) {
    await row.click();
    await page.waitForTimeout(500);
    const viewBtn = page.locator('button').filter({ hasText: /View Full Stats/ });
    if (await viewBtn.count() > 0) {
      await viewBtn.click();
      await page.waitForTimeout(800);
      const body = await page.locator('body').innerText();
      console.log(`PLAYER_STATS_CONTENT|${body.slice(0, 600)}`);
      await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-player-stats.png', fullPage: false });
      expect(page.url()).toContain('/franchise/player-stats/');
    }
  }
});

test('Phase 4: Console errors audit', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  const pages = ['/franchise/dashboard', '/franchise/roster', '/franchise/hot-cold',
    '/franchise/scouting', '/franchise/trade', '/franchise/standings', '/franchise/training'];
  for (const p of pages) {
    await page.goto(B + p);
    await page.waitForTimeout(600);
  }
  console.log(`CONSOLE_ERRORS|${JSON.stringify(errors)}`);
  console.log(`ERROR_COUNT|${errors.length}`);
  expect(errors.length).toBe(0);
});
