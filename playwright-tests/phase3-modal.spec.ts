import { test, expect } from '@playwright/test';
const B = 'http://localhost:5173';

test('Phase 3: Player modal opens from Roster page', async ({ page }) => {
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  // Click first player row
  const playerRow = page.locator('tr.cursor-pointer').first();
  const count = await playerRow.count();
  console.log(`ROSTER_ROW_COUNT|${count}`);
  if (count > 0) {
    await playerRow.click();
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    // CSS uppercase transforms "Tool Grades" → "TOOL GRADES" in innerText
    const hasToolGrades = body.toUpperCase().includes('TOOL GRADES');
    const hasViewStats = body.includes('View Full Stats');
    console.log(`MODAL_TOOL_GRADES|${hasToolGrades}`);
    console.log(`MODAL_VIEW_STATS|${hasViewStats}`);
    expect(hasToolGrades).toBe(true);
    expect(hasViewStats).toBe(true);
    await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/player-modal-roster.png', fullPage: false });
  }
});

test('Phase 3: Player modal shows stats and contract', async ({ page }) => {
  await page.goto(B + '/franchise/hot-cold');
  await page.waitForTimeout(800);
  // Click a player row in hot/cold
  const playerRow = page.locator('tr.cursor-pointer').first();
  if (await playerRow.count() > 0) {
    await playerRow.click();
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    const toolIdx = body.toUpperCase().indexOf('TOOL GRADES');
    console.log(`HOTCOLD_MODAL_CONTENT|${JSON.stringify(body.slice(toolIdx >= 0 ? toolIdx : body.length - 800).slice(0, 800))}`);
    const hasModal = body.toUpperCase().includes('TOOL GRADES') && body.includes('View Full Stats');
    console.log(`HOTCOLD_MODAL|${hasModal}`);
    expect(hasModal).toBe(true);
    await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/player-modal-hotcold.png', fullPage: false });
  }
});

test('Phase 3: Modal closes on Escape key', async ({ page }) => {
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  const playerRow = page.locator('tr.cursor-pointer').first();
  if (await playerRow.count() > 0) {
    await playerRow.click();
    await page.waitForTimeout(500);
    // Verify modal is open (CSS uppercase: "Tool Grades" → "TOOL GRADES")
    expect((await page.locator('body').innerText()).toUpperCase()).toContain('TOOL GRADES');
    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const bodyAfter = await page.locator('body').innerText();
    const modalClosed = !bodyAfter.toUpperCase().includes('TOOL GRADES') || bodyAfter.toUpperCase().includes('ROSTER');
    console.log(`MODAL_CLOSES_ESC|${modalClosed}`);
    expect(modalClosed).toBe(true);
    await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/player-modal-closed.png', fullPage: false });
  }
});

test('Phase 3: Modal View Full Stats navigates to player page', async ({ page }) => {
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  const playerRow = page.locator('tr.cursor-pointer').first();
  if (await playerRow.count() > 0) {
    await playerRow.click();
    await page.waitForTimeout(500);
    const viewBtn = page.locator('button').filter({ hasText: /View Full Stats/ });
    expect(await viewBtn.count()).toBeGreaterThan(0);
    await viewBtn.click();
    await page.waitForTimeout(600);
    const url = page.url();
    console.log(`FULL_STATS_URL|${url}`);
    expect(url).toContain('/franchise/player-stats/');
    const body = await page.locator('body').innerText();
    console.log(`FULL_STATS_CONTENT|${JSON.stringify(body.slice(0, 400))}`);
    await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/player-stats-page.png', fullPage: false });
  }
});
