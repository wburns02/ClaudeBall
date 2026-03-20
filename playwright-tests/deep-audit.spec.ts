import { test, Page } from '@playwright/test';
const BASE = 'http://localhost:5173';
const SS = '/home/will/ClaudeBall/qa-screenshots';
async function spa(page: Page, path: string) {
  await page.evaluate((p) => { window.history.pushState({},{},p); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForTimeout(900);
}
async function setupFranchise(page: Page) {
  await page.goto(`${BASE}/franchise/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const t = page.locator('button').filter({ hasText: /Austin|Thunderhawks/ }).first();
  if (await t.count() > 0) { await t.click(); await page.waitForTimeout(300); }
  const s = page.locator('button').filter({ hasText: /Start Season/i });
  if (await s.count() > 0) { await s.click(); await page.waitForURL('**/franchise**', {timeout:8000}).catch(()=>{}); await page.waitForTimeout(2500); }
}
async function advanceDays(page: Page, n=10) {
  await spa(page, '/franchise');
  for (let i=0;i<n;i++) {
    const b = page.locator('button').filter({hasText:/Advance Day/i}).first();
    if (await b.count()===0) break;
    await b.click(); await page.waitForTimeout(400);
    const sim = page.locator('button').filter({hasText:/Auto.Sim|Simulate/i}).first();
    if (await sim.count()>0) { await sim.click(); await page.waitForTimeout(600); }
    else { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }
}
test.describe('Deep Audit', () => {
  let page: Page;
  test.beforeAll(async ({browser}) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await setupFranchise(page);
    await advanceDays(page, 10);
  });
  test('Screenshot all thin pages', async () => {
    const thinPages = [
      ['/franchise/team-analytics', 'analytics'],
      ['/franchise/all-star', 'all-star'],
      ['/franchise/awards', 'awards'],
      ['/franchise/history', 'history'],
      ['/franchise/records', 'records'],
      ['/franchise/compare', 'compare'],
      ['/saves', 'saves'],
      ['/settings', 'settings'],
      ['/franchise/inbox', 'inbox'],
      ['/franchise/finances', 'finances'],
      ['/franchise/free-agency', 'free-agency'],
      ['/franchise/roster-manager', 'roster-manager'],
      ['/franchise/playoffs', 'playoffs'],
      ['/franchise/offseason', 'offseason'],
    ];
    for (const [path, name] of thinPages) {
      await spa(page, path);
      await page.waitForTimeout(1000);
      const body = await page.textContent('body') ?? '';
      await page.screenshot({ path: `${SS}/deep-${name}.png`, fullPage: true });
      console.log(`PAGE|${name}|len=${body.length}|first300="${body.replace(/\s+/g,' ').substring(0,300)}"`);
    }
  });
  test('Test Trades UI depth', async () => {
    await spa(page, '/franchise/trade');
    await page.waitForTimeout(1200);
    // Try selecting a team
    const allBtns = await page.locator('button').allTextContents();
    const teamBtns = allBtns.filter(t => t.length > 2 && t.length < 30 && !['Save','Cancel','Reset','Close','Back'].includes(t));
    console.log(`TRADE_BTNS|${JSON.stringify(teamBtns.slice(0,10))}`);
    // Find any team-selector buttons
    const gridBtns = page.locator('button').filter({ hasText: /[A-Z]{2,4}/ });
    const gc = await gridBtns.count();
    console.log(`TRADE_TEAM_BTNS|${gc}`);
    if (gc > 0) {
      // Try clicking first team
      await gridBtns.first().click();
      await page.waitForTimeout(800);
      const body2 = await page.textContent('body') ?? '';
      await page.screenshot({ path: `${SS}/deep-trade-selected.png`, fullPage: true });
      console.log(`TRADE_AFTER_SELECT|len=${body2.length}|preview="${body2.replace(/\s+/g,' ').substring(0,200)}"`);
    }
  });
  test('Test Finances detail', async () => {
    await spa(page, '/franchise/finances');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/deep-finances-full.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`FINANCES|len=${body.length}|"${body.replace(/\s+/g,' ').substring(0,400)}"`);
    const btns = await page.locator('button').allTextContents();
    console.log(`FINANCES_BTNS|${JSON.stringify(btns.slice(0,20))}`);
  });
  test('Test Player Comparison depth', async () => {
    await spa(page, '/franchise/compare');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/deep-compare-full.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`COMPARE|len=${body.length}|"${body.replace(/\s+/g,' ').substring(0,300)}"`);
    // Try finding player select
    const selects = await page.locator('select, input[type=text], [role=combobox]').count();
    console.log(`COMPARE_INPUTS|${selects}`);
  });
  test('Roster Manager depth', async () => {
    await spa(page, '/franchise/roster-manager');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/deep-roster-manager.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`ROSTER_MGR|len=${body.length}|"${body.replace(/\s+/g,' ').substring(0,400)}"`);
  });
  test('Settings depth', async () => {
    await spa(page, '/settings');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/deep-settings-full.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`SETTINGS|len=${body.length}|"${body.replace(/\s+/g,' ').substring(0,400)}"`);
    const btns = await page.locator('button').allTextContents();
    console.log(`SETTINGS_BTNS|${JSON.stringify(btns)}`);
  });
  test('Saves depth', async () => {
    await spa(page, '/saves');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/deep-saves-full.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`SAVES|len=${body.length}|"${body.replace(/\s+/g,' ').substring(0,400)}"`);
    const btns = await page.locator('button').allTextContents();
    console.log(`SAVES_BTNS|${JSON.stringify(btns)}`);
  });
});
