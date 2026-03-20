import { test, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const SS_DIR = '/home/will/ClaudeBall/qa-screenshots';

const consoleErrors: string[] = [];

// Helper: SPA-navigate using the React Router (click a sidebar link or use history)
async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(800);
}

test.describe('ClaudeBall QA Sweep', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(`[pageerror] ${err.message}`);
    });

    // === FRANCHISE SETUP ===
    await page.goto(`${BASE}/franchise/new`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const teamBtn = page.locator('button').filter({ hasText: /Austin/ }).first();
    await teamBtn.click();
    await page.waitForTimeout(300);

    const startBtn = page.locator('button').filter({ hasText: /Start Season/i });
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForURL(`**\/franchise**`, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      console.log(`FRANCHISE_SETUP|URL: ${page.url().replace(BASE, '')}|body: ${(await page.textContent('body') ?? '').length} chars`);
    }
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ============================================================
  // TEST 1: Main Menu
  // ============================================================
  test('1. Main Menu', async () => {
    // Navigate to home via SPA
    await spaNavigate(page, '/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS_DIR}/01-main-menu.png`, fullPage: true });

    const bodyText = await page.textContent('body') ?? '';
    const pass = bodyText.includes('CLAUDE') || bodyText.includes('BALL') || bodyText.includes('Exhibition');
    console.log(`RESULT|1|Main Menu|${pass ? 'PASS' : 'FAIL'}|content_ok=${pass} ; body_len=${bodyText.length}`);
  });

  // ============================================================
  // TEST 2: Franchise Dashboard (actual route: /franchise)
  // ============================================================
  test('2. Franchise Dashboard', async () => {
    // Navigate back to franchise dashboard via SPA
    await spaNavigate(page, '/franchise');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS_DIR}/02-franchise-dashboard.png`, fullPage: true });

    const notes: string[] = [];
    const currentUrl = page.url();
    notes.push(`URL: ${currentUrl.replace(BASE, '')}`);

    const bodyText = await page.textContent('body') ?? '';
    notes.push(`Body length: ${bodyText.length}`);

    // Find Advance Day button
    const advanceBtns = page.locator('button').filter({ hasText: /advance day/i });
    const btnCount = await advanceBtns.count();
    notes.push(`Advance Day buttons: ${btnCount}`);

    let modalHasPlayLive = false;
    let modalHasAutoSim = false;
    let cancelWorks = false;
    let escapeWorks = false;

    if (btnCount > 0) {
      // 2a: Click to open modal
      await advanceBtns.first().click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${SS_DIR}/02b-dashboard-modal.png`, fullPage: true });

      const bodyModal = await page.textContent('body') ?? '';
      modalHasPlayLive = bodyModal.includes('Play Live');
      modalHasAutoSim = bodyModal.includes('Auto-Sim') || bodyModal.includes('Auto Sim') || bodyModal.includes('Simulate');
      const hasCancel = bodyModal.includes('Cancel');
      notes.push(`Play Live: ${modalHasPlayLive} ; Auto-Sim: ${modalHasAutoSim} ; Cancel: ${hasCancel}`);

      // 2b: Test Cancel button
      const cancelBtn = page.locator('button').filter({ hasText: /^cancel$/i }).first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(600);
        cancelWorks = true;
        notes.push('Cancel: OK');
        await page.screenshot({ path: `${SS_DIR}/02c-after-cancel.png`, fullPage: true });
      }

      // 2c: Re-open and test Escape
      await advanceBtns.first().click();
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SS_DIR}/02d-after-escape.png`, fullPage: true });
      const cancelAfterEsc = await page.locator('button').filter({ hasText: /^cancel$/i }).count();
      escapeWorks = cancelAfterEsc === 0;
      notes.push(`Escape closes modal: ${escapeWorks}`);
    }

    const status = btnCount > 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT|2|Franchise Dashboard|${status}|${notes.join(' ; ')}`);
  });

  // ============================================================
  // TEST 3: Roster + Player Stats + Career Arc
  // ============================================================
  test('3. Roster + Player Stats + Career Arc', async () => {
    await spaNavigate(page, '/franchise/roster');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS_DIR}/03-roster.png`, fullPage: true });

    const notes: string[] = [];
    const bodyText = await page.textContent('body') ?? '';
    const hasNoFranchise = bodyText.includes('No franchise loaded');
    notes.push(`No franchise: ${hasNoFranchise}`);

    const playerRows = page.locator('tbody tr');
    const rowCount = await playerRows.count();
    notes.push(`Roster rows: ${rowCount}`);

    let navigatedToPlayer = false;
    let careerArcFound = false;
    let careerArcIsTopRight = false;
    let chartFound = false;

    if (rowCount > 0) {
      const firstRowText = await playerRows.first().textContent();
      notes.push(`First player: ${firstRowText?.trim().substring(0, 25)}`);

      await playerRows.first().click();
      await page.waitForTimeout(1500);
      navigatedToPlayer = true;
      notes.push(`Player URL: ${page.url().replace(BASE, '')}`);

      await page.screenshot({ path: `${SS_DIR}/03b-player-stats.png`, fullPage: true });

      // Career Arc
      const careerArcEl = page.locator('text=Career Arc').first();
      careerArcFound = (await careerArcEl.count()) > 0;
      notes.push(`Career Arc: ${careerArcFound}`);

      if (careerArcFound) {
        const box = await careerArcEl.boundingBox();
        notes.push(`Career Arc pos: x=${box?.x?.toFixed(0)}, y=${box?.y?.toFixed(0)}`);
        careerArcIsTopRight = !!(box && (box.x || 0) > 640 && (box.y || 0) < 350);
        notes.push(`Career Arc top-right: ${careerArcIsTopRight}`);

        if (box) {
          await page.screenshot({
            path: `${SS_DIR}/03c-career-arc-panel.png`,
            clip: {
              x: Math.max(0, (box.x || 0) - 10),
              y: Math.max(0, (box.y || 0) - 10),
              width: 680,
              height: 420
            }
          });
        }
      }

      // Charts
      const svgCount = await page.locator('svg').count();
      const rechartsCount = await page.locator('[class*="recharts"]').count();
      chartFound = svgCount > 0 || rechartsCount > 0;
      notes.push(`SVG: ${svgCount}, Recharts elements: ${rechartsCount}`);

      const referenceAreas = await page.locator('[class*="recharts-reference-area"]').count();
      notes.push(`Phase BG areas: ${referenceAreas}`);
      const lineCount = await page.locator('[class*="recharts-line"]').count();
      notes.push(`Trajectory lines: ${lineCount}`);
      const chartTexts = await page.locator('svg text').allTextContents();
      const ageLabels = chartTexts.filter(t => /^\d{2}$/.test(t.trim()) && +t >= 18 && +t <= 45);
      notes.push(`Age labels: [${ageLabels.join(',')}]`);
    }

    const status = (navigatedToPlayer && careerArcFound && chartFound) ? 'PASS' :
                   navigatedToPlayer ? 'PARTIAL' : 'FAIL';
    console.log(`RESULT|3|Roster+Player+CareerArc|${status}|${notes.join(' ; ')}`);
  });

  // ============================================================
  // TEST 4: Hot & Cold
  // ============================================================
  test('4. Hot and Cold Page', async () => {
    await spaNavigate(page, '/franchise/hot-cold');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS_DIR}/04-hot-cold.png`, fullPage: true });

    const bodyText = await page.textContent('body') ?? '';
    const hasContent = bodyText.length > 200;
    const hasHotCold = bodyText.toLowerCase().includes('hot') || bodyText.toLowerCase().includes('cold');
    const hasNoFranchise = bodyText.includes('No franchise loaded');

    const notes = [`Loaded: ${hasContent}`, `Hot/Cold: ${hasHotCold}`, `No franchise: ${hasNoFranchise}`];
    const status = hasContent && !hasNoFranchise ? 'PASS' : hasContent ? 'WARN_NO_FRANCHISE' : 'FAIL';
    console.log(`RESULT|4|Hot and Cold|${status}|${notes.join(' ; ')}`);
  });

  // ============================================================
  // TEST 5: Create Player
  // ============================================================
  test('5. Create Player Page', async () => {
    await spaNavigate(page, '/franchise/create-player');
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: `${SS_DIR}/05-create-player-header.png`,
      clip: { x: 0, y: 0, width: 1280, height: 200 }
    });
    await page.screenshot({ path: `${SS_DIR}/05b-create-player-full.png`, fullPage: true });

    const bodyText = await page.textContent('body') ?? '';
    const hasCreateContent = bodyText.toLowerCase().includes('create player');

    const createBtns = page.locator('button').filter({ hasText: /create player/i });
    const btnCount = await createBtns.count();

    // The visible Create Player button in the top-right has specific position
    // Find the one that is actually in the header area (y < 150)
    let btnAtTop = false;
    for (let i = 0; i < btnCount; i++) {
      const box = await createBtns.nth(i).boundingBox();
      if (box && (box.y || 0) < 150 && (box.x || 0) > 0) {
        btnAtTop = true;
        notes_cp.push(`Header btn[${i}] at x=${box.x?.toFixed(0)}, y=${box.y?.toFixed(0)}`);
      }
    }

    const notes = [
      `"Create Player" text: ${hasCreateContent}`,
      `Create Player buttons: ${btnCount}`,
      `Button at top (y<150): ${btnAtTop}`,
      ...notes_cp
    ];

    const status = hasCreateContent && btnCount > 0 && btnAtTop ? 'PASS' : hasCreateContent ? 'PARTIAL' : 'FAIL';
    console.log(`RESULT|5|Create Player|${status}|${notes.join(' ; ')}`);
  });

  // ============================================================
  // TEST 6: Standings
  // ============================================================
  test('6. Standings Page', async () => {
    await spaNavigate(page, '/franchise/standings');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS_DIR}/06-standings.png`, fullPage: true });

    const bodyText = await page.textContent('body') ?? '';
    const hasNoFranchise = bodyText.includes('No franchise loaded');
    const hasStandings = bodyText.toLowerCase().includes('standing') || bodyText.toLowerCase().includes('division');

    const notes = [`Standings: ${hasStandings}`, `No franchise: ${hasNoFranchise}`];
    const status = hasStandings && !hasNoFranchise ? 'PASS' : hasStandings ? 'WARN_NO_FRANCHISE' : 'FAIL';
    console.log(`RESULT|6|Standings|${status}|${notes.join(' ; ')}`);
  });

  // ============================================================
  // TEST 7: Inbox
  // ============================================================
  test('7. Inbox Page', async () => {
    await spaNavigate(page, '/franchise/inbox');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS_DIR}/07-inbox.png`, fullPage: true });

    const bodyText = await page.textContent('body') ?? '';
    const hasInbox = bodyText.toLowerCase().includes('inbox') || bodyText.toLowerCase().includes('message');
    const hasNoFranchise = bodyText.includes('No franchise loaded');

    const notes = [`Inbox: ${hasInbox}`, `No franchise: ${hasNoFranchise}`];
    console.log(`RESULT|7|Inbox|${hasInbox ? 'PASS' : 'FAIL'}|${notes.join(' ; ')}`);
  });

  // ============================================================
  // TEST 8: Console Errors
  // ============================================================
  test('8. Console Errors Summary', async () => {
    console.log(`CONSOLE_ERRORS_COUNT|${consoleErrors.length}`);
    consoleErrors.slice(0, 10).forEach((err, i) => {
      console.log(`CONSOLE_ERROR_${i}|${err.substring(0, 200)}`);
    });
    const status = consoleErrors.length === 0 ? 'PASS' : consoleErrors.length <= 3 ? 'WARN' : 'FAIL';
    console.log(`RESULT|8|Console Errors|${status}|error count=${consoleErrors.length}`);
  });
});

const notes_cp: string[] = [];
