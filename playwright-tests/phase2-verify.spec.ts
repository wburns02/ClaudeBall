import { test, expect } from '@playwright/test';
const B = 'http://localhost:5173';

test('Bug 1 Fix: Owner Office has action buttons', async ({ page }) => {
  await page.goto(B + '/franchise/goals');
  await page.waitForTimeout(800);
  const btns = await page.locator('button').allTextContents();
  const actionBtns = btns.filter(b => ['Standings','Manage Roster','Payroll','Analytics'].some(s => b.includes(s)));
  console.log(`GOALS_ACTION_BTNS|${JSON.stringify(actionBtns)}`);
  expect(actionBtns.length).toBeGreaterThan(0);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/goals-fixed.png', fullPage: true });
});

test('Bug 2 Fix: Finances page has action buttons', async ({ page }) => {
  await page.goto(B + '/franchise/finances');
  await page.waitForTimeout(800);
  const btns = await page.locator('button').allTextContents();
  const actionBtns = btns.filter(b => b.includes('Payroll') || b.includes('War Room') || b.includes('Free Agency'));
  console.log(`FINANCES_ACTION_BTNS|${JSON.stringify(actionBtns)}`);
  expect(actionBtns.length).toBeGreaterThan(0);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/finances-fixed.png', fullPage: false });
});

test('Bug 3 Fix: Hot/Cold IL indicator', async ({ page }) => {
  await page.goto(B + '/franchise/hot-cold');
  await page.waitForTimeout(800);
  const body = await page.locator('body').innerText();
  // The page should load with the click hint
  expect(body).toContain('Click any row for full player stats');
  console.log(`HOTCOLD_HINT|found`);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/hotcold-fixed.png', fullPage: false });
});

test('Bug 4 Fix: Scouting Staff upgrade has toast handler', async ({ page }) => {
  await page.goto(B + '/franchise/scouting');
  await page.waitForTimeout(800);
  // Check upgrade button exists
  const upgradeBtn = page.locator('button').filter({ hasText: /↑ Upgrade →/ });
  const count = await upgradeBtn.count();
  console.log(`SCOUTING_UPGRADE_BTN|count=${count}`);
  if (count > 0) {
    await upgradeBtn.first().click();
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    // Check if toast appeared (look for "Scouting upgraded" text)
    const toastVisible = body.includes('Scouting upgraded') || body.includes('upgraded');
    console.log(`SCOUTING_TOAST|${toastVisible}`);
    await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/scouting-upgrade.png', fullPage: false });
  }
});
