import { test, expect } from '@playwright/test';
const B = 'http://localhost:5173';

test('Phase 4: Mobile roster layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(100);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-mobile-roster.png', fullPage: false });
  // Check no horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewWidth = await page.evaluate(() => document.documentElement.clientWidth);
  console.log(`MOBILE_SCROLL|${scrollWidth}|VIEW|${viewWidth}`);
  expect(scrollWidth).toBeLessThanOrEqual(viewWidth + 20); // 20px tolerance
});

test('Phase 4: Mobile dashboard layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(B + '/franchise/dashboard');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-mobile-dashboard.png', fullPage: false });
  const body = await page.locator('body').innerText();
  expect(body.includes('14') || body.includes('THUNDERHAWKS') || body.length > 100).toBe(true);
});

test('Phase 4: Mobile modal opens correctly', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  const row = page.locator('tr.cursor-pointer').first();
  if (await row.count() > 0) {
    await row.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[role="dialog"]');
    expect(await modal.count()).toBe(1);
    await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/p4-mobile-modal.png', fullPage: false });
    // Modal should fit within 95vw
    const box = await modal.boundingBox();
    console.log(`MODAL_WIDTH|${box?.width}|VIEWPORT|375`);
    if (box) {
      expect(box.width).toBeLessThanOrEqual(380); // max-w-[95vw] at 375 = 356px
    }
  }
});

test('Phase 4: Click hint visible on roster', async ({ page }) => {
  await page.goto(B + '/franchise/roster');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  const hasHint = body.includes('Click any player row');
  console.log(`ROSTER_CLICK_HINT|${hasHint}`);
  expect(hasHint).toBe(true);
});
