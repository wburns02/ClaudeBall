import { test, Page } from '@playwright/test';
const BASE = 'http://localhost:5173';
const SS = '/home/will/ClaudeBall/qa-screenshots';
async function spa(page: Page, path: string) {
  await page.evaluate((p) => { window.history.pushState({},{},p); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForTimeout(900);
}
async function setupAndAdvance(page: Page) {
  await page.goto(`${BASE}/franchise/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const t = page.locator('button').filter({ hasText: /Austin|Thunderhawks/ }).first();
  if (await t.count() > 0) { await t.click(); await page.waitForTimeout(300); }
  const s = page.locator('button').filter({ hasText: /Start Season/i });
  if (await s.count() > 0) { await s.click(); await page.waitForURL('**/franchise**', {timeout:8000}).catch(()=>{}); await page.waitForTimeout(2500); }
  // sim 10 days via dashboard
  await spa(page, '/franchise');
  for (let i=0;i<10;i++) {
    const b = page.locator('button').filter({hasText:/Advance Day/i}).first();
    if (await b.count()===0) break;
    await b.click(); await page.waitForTimeout(400);
    const sim = page.locator('button').filter({hasText:/Auto.Sim|Simulate/i}).first();
    if (await sim.count()>0) { await sim.click(); await page.waitForTimeout(600); }
    else { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }
}
test.describe('Targeted Bug Checks', () => {
  let page: Page;
  test.beforeAll(async ({browser}) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await setupAndAdvance(page);
  });

  test('Compare Players — type in search', async () => {
    await spa(page, '/franchise/compare');
    await page.waitForTimeout(1200);
    // Find input[placeholder*=Search]
    const input = page.locator('input[placeholder*="Search"]').first();
    const count = await input.count();
    console.log(`COMPARE_INPUT_COUNT|${count}`);
    if (count > 0) {
      await input.click();
      await page.waitForTimeout(300);
      await input.fill('Jaylen');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SS}/compare-typing.png`, fullPage: true });
      const body = await page.textContent('body') ?? '';
      const hasResults = body.includes('Jaylen') || body.includes('Brooks');
      console.log(`COMPARE_SEARCH|hasResults=${hasResults}|body="${body.replace(/\s+/g,' ').substring(200,500)}"`);
      // Check for dropdown suggestions
      const dropdown = page.locator('[role=listbox], [class*="dropdown"], [class*="suggest"]');
      const dropCount = await dropdown.count();
      console.log(`COMPARE_DROPDOWN|${dropCount}`);
    } else {
      console.log(`COMPARE_INPUT|NOT_FOUND`);
    }
  });

  test('Inbox after days simmed', async () => {
    // Check inbox from franchise dashboard context (not SPA nav)
    await spa(page, '/franchise');
    await page.waitForTimeout(1200);
    // Now navigate to inbox
    await spa(page, '/franchise/inbox');
    await page.waitForTimeout(1000);
    const body = await page.textContent('body') ?? '';
    const hasMessages = !body.includes('No messages yet');
    const msgCount = (body.match(/Day \d+|Signed|Released|Traded|injured/gi) || []).length;
    console.log(`INBOX|hasMessages=${hasMessages}|msgCount=${msgCount}|len=${body.length}`);
    await page.screenshot({ path: `${SS}/inbox-after-advance.png`, fullPage: true });
  });

  test('Awards page — which awards show', async () => {
    await spa(page, '/franchise/awards');
    await page.waitForTimeout(1200);
    const body = await page.textContent('body') ?? '';
    const hasMVP = body.includes('MVP');
    const hasCY = body.includes('Cy Young');
    const hasROY = body.includes('Rookie');
    const hasSS = body.includes('Silver Slugger') || body.includes('Silver');
    const hasGG = body.includes('Gold Glove');
    console.log(`AWARDS|mvp=${hasMVP}|cy=${hasCY}|roy=${hasROY}|silver=${hasSS}|gg=${hasGG}`);
    await page.screenshot({ path: `${SS}/awards-full.png`, fullPage: true });
  });

  test('Trade page — actual team selection', async () => {
    await spa(page, '/franchise/trade');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/trade-initial.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`TRADE_INITIAL|len=${body.length}|preview="${body.replace(/\s+/g,' ').substring(600,900)}"`);
    // Find all buttons and identify team ones
    const allBtns = await page.locator('button').allTextContents();
    const teamLike = allBtns.filter(t => /^[A-Z]{3,4}$|^[A-Z][a-z]+ [A-Z][a-z]+/.test(t.trim()));
    console.log(`TRADE_TEAM_BTNS|${JSON.stringify(teamLike.slice(0,15))}`);
    // Try clicking something that looks like a team  
    const abbrevBtns = page.locator('button').filter({ hasText: /^ICL$|^CLT$|^NFK$|^HFD$|^NSH$/ }).first();
    if (await abbrevBtns.count() > 0) {
      await abbrevBtns.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SS}/trade-team-selected.png`, fullPage: true });
      const b2 = await page.textContent('body') ?? '';
      console.log(`TRADE_AFTER|len=${b2.length}|hasPlayer=${b2.includes('Send') || b2.includes('Player') || b2.includes('pitcher') || b2.includes('Contact')}`);
    } else {
      // Try clicking any non-sidebar button
      const nonSidebar = page.locator('main button, [class*="content"] button').first();
      if (await nonSidebar.count() > 0) {
        const txt = await nonSidebar.textContent();
        console.log(`TRADE_FIRST_CONTENT_BTN|"${txt}"`);
      }
    }
  });

  test('Free Agency — sign a player', async () => {
    await spa(page, '/franchise/free-agency');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/free-agency-full.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    console.log(`FA|len=${body.length}|preview="${body.replace(/\s+/g,' ').substring(600,900)}"`);
    // Find Sign buttons
    const signBtns = page.locator('button').filter({ hasText: /Sign|Offer|Interest/ });
    const signCount = await signBtns.count();
    console.log(`FA_SIGN_BTNS|${signCount}`);
    if (signCount > 0) {
      await signBtns.first().click();
      await page.waitForTimeout(600);
      const b2 = await page.textContent('body') ?? '';
      const hasFeedback = b2.includes('Signed') || b2.includes('Offer') || b2.includes('Year') || b2.includes('M/yr');
      console.log(`FA_AFTER_SIGN|hasFeedback=${hasFeedback}`);
      await page.screenshot({ path: `${SS}/free-agency-signed.png`, fullPage: true });
    }
  });

  test('Waiver Wire — claim a player', async () => {
    await spa(page, '/franchise/waivers');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/waivers-full.png`, fullPage: true });
    const body = await page.textContent('body') ?? '';
    const claimBtns = page.locator('button').filter({ hasText: /Claim|Add/ });
    console.log(`WAIVERS|len=${body.length}|claimBtns=${await claimBtns.count()}`);
  });

  test('Settings — interact with controls', async () => {
    await spa(page, '/settings');
    await page.waitForTimeout(1200);
    const allBtns = await page.locator('button').allTextContents();
    const settingsBtns = allBtns.filter(b => !['Claude Ball','Home','Quick Game','Franchise','Career','Historical','Settings'].includes(b.trim()));
    console.log(`SETTINGS_INTERACTIVE|${JSON.stringify(settingsBtns)}`);
    // Try clicking Veteran difficulty
    const vetBtn = page.locator('button').filter({ hasText: /Veteran/i }).first();
    if (await vetBtn.count() > 0) {
      await vetBtn.click();
      await page.waitForTimeout(300);
      console.log(`SETTINGS_VET_CLICK|OK`);
    }
    // Test volume slider
    const sliders = page.locator('input[type=range]');
    console.log(`SETTINGS_SLIDERS|${await sliders.count()}`);
  });

  test('Saves — save a slot', async () => {
    await spa(page, '/saves');
    await page.waitForTimeout(1200);
    const saveHereBtns = page.locator('button').filter({ hasText: /Save Here/ });
    const count = await saveHereBtns.count();
    console.log(`SAVES|saveHereBtns=${count}`);
    if (count > 0) {
      await saveHereBtns.first().click();
      await page.waitForTimeout(500);
      const b = await page.textContent('body') ?? '';
      const hasSaved = b.includes('Saved') || b.includes('Austin') || b.includes('2026');
      console.log(`SAVES_AFTER|hasSaved=${hasSaved}|bodyLen=${b.length}`);
      await page.screenshot({ path: `${SS}/saves-after.png`, fullPage: true });
    }
  });
});
