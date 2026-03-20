import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:5179';
const SCREENSHOTS_DIR = '/tmp/claudeball_screenshots';
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const bugs = [];
const notes = [];

let browser, page;

async function screenshot(name) {
  const path = `${SCREENSHOTS_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function goto(path, waitMs = 1500) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForTimeout(waitMs);
}

async function clickAndWait(selector, waitMs = 800) {
  try {
    await page.click(selector, { timeout: 5000 });
    await page.waitForTimeout(waitMs);
    return true;
  } catch (e) {
    return false;
  }
}

async function getVisibleText(selector) {
  try {
    return await page.locator(selector).first().innerText({ timeout: 3000 });
  } catch (e) {
    return null;
  }
}

async function checkForConsoleErrors() {
  // Already set up listener
}

const consoleErrors = [];
const networkErrors = [];

async function main() {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  page = await context.newPage();

  // Collect errors
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGE_ERROR: ${err.message}`));

  // ─────────────────────────────────────────
  // STEP 1: Navigate to main page, check for franchise
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 1: Initial State Check ===');
  await goto('/', 2000);
  await screenshot('01_main_menu');
  const mainMenuText = await page.content();
  notes.push(`Main menu loaded. Has "New Franchise": ${mainMenuText.includes('New Franchise')}`);

  // Check if franchise exists already
  await goto('/franchise', 2000);
  await screenshot('02_franchise_initial');
  const franchiseTitleText = await getVisibleText('h1, h2, [class*="title"]');
  notes.push(`Franchise page title: ${franchiseTitleText}`);

  // If no franchise, check redirect
  const currentUrl = page.url();
  notes.push(`After /franchise nav, URL: ${currentUrl}`);

  if (!currentUrl.includes('/franchise') || currentUrl.includes('/franchise/new')) {
    notes.push('No franchise found — creating one');
    await goto('/franchise/new', 2000);
    await screenshot('03_new_franchise_form');

    // Try to pick first team
    const teamButtons = await page.locator('button').all();
    let teamClicked = false;
    for (const btn of teamButtons.slice(0, 30)) {
      const txt = await btn.innerText().catch(() => '');
      if (txt && txt.length > 2 && !['Start Season', 'Back', 'Create'].includes(txt)) {
        await btn.click();
        teamClicked = true;
        notes.push(`Clicked team: ${txt}`);
        break;
      }
    }

    await page.waitForTimeout(500);
    await screenshot('04_team_selected');

    // Try Start Season button
    const startBtn = await page.locator('button:has-text("Start Season")');
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(2000);
      notes.push('Clicked Start Season');
    }

    await screenshot('05_after_start_season');
  }

  // ─────────────────────────────────────────
  // STEP 2: Sim 30 days on Schedule page
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 2: Schedule Page — Sim 30 days ===');
  await goto('/franchise/schedule', 2000);
  await screenshot('06_schedule_initial');

  // Find the schedule page content
  const scheduleText = await page.content();
  notes.push(`Schedule page - has "Sim" button: ${scheduleText.includes('Sim')}`);
  notes.push(`Schedule page - has "Advance": ${scheduleText.includes('Advance')}`);

  // Look for sim buttons
  const sim1Btn = await page.locator('button:has-text("Sim 1")');
  const sim7Btn = await page.locator('button:has-text("Sim 7")');
  const simWeekBtn = page.locator('button').filter({ hasText: /Sim.*Week|Sim.*7|Advance.*7/i });

  notes.push(`Sim 1 button count: ${await sim1Btn.count()}`);
  notes.push(`Sim 7 button count: ${await sim7Btn.count()}`);

  // Sim days in bulk
  let simsPerformed = 0;
  
  // Try "Sim Week" or similar 
  const allButtons = await page.locator('button').all();
  const buttonLabels = [];
  for (const btn of allButtons) {
    const t = await btn.innerText().catch(() => '');
    buttonLabels.push(t.trim());
  }
  notes.push(`Schedule buttons: ${buttonLabels.filter(b => b).join(' | ')}`);

  // Try sim buttons (look for any sim button)
  let simButtonSelector = null;
  for (const lbl of ['Sim Week', 'Sim 7 Days', 'Advance Week', 'Sim Day', 'Sim 1 Day']) {
    const btn = page.locator(`button:has-text("${lbl}")`);
    if (await btn.count() > 0) {
      simButtonSelector = lbl;
      break;
    }
  }

  // Also check for number-based sim buttons
  if (!simButtonSelector) {
    const simBtns = await page.locator('button').filter({ hasText: /sim/i }).all();
    if (simBtns.length > 0) {
      const firstSimText = await simBtns[0].innerText();
      notes.push(`First sim button text: "${firstSimText}"`);
      simButtonSelector = firstSimText.trim();
    }
  }

  notes.push(`Using sim button: "${simButtonSelector}"`);

  if (simButtonSelector) {
    // Sim multiple times to get 30 days of data
    for (let i = 0; i < 10; i++) {
      const btn = page.locator(`button:has-text("${simButtonSelector}")`).first();
      if (await btn.count() > 0 && await btn.isEnabled()) {
        await btn.click();
        await page.waitForTimeout(1500);
        simsPerformed++;
      } else {
        notes.push(`Sim button disabled/gone after ${i} clicks`);
        break;
      }
    }
  }

  notes.push(`Simulated ${simsPerformed} times`);
  await screenshot('07_schedule_after_sim');

  // Check current day/date indicator
  const schedulePageText = await page.innerText('body').catch(() => '');
  const dateMatch = schedulePageText.match(/\b(April|May|June|July|August|September|Oct\w*|November|December)\s+\d+/);
  notes.push(`Current date shown: ${dateMatch ? dateMatch[0] : 'not found'}`);

  // ─────────────────────────────────────────
  // STEP 3: Franchise Dashboard
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 3: Franchise Dashboard ===');
  await goto('/franchise', 2000);
  await screenshot('08_franchise_dashboard');
  const dashText = await page.innerText('body').catch(() => '');
  notes.push(`Dashboard - has record/wins: ${/\d+-\d+/.test(dashText)}`);
  notes.push(`Dashboard - has standings: ${dashText.toLowerCase().includes('standing')}`);
  notes.push(`Dashboard - has news/feed: ${dashText.toLowerCase().includes('news') || dashText.toLowerCase().includes('bulletin')}`);

  // Check for key dashboard widgets
  const dashboardBtns = await page.locator('button').all();
  const dashBtnLabels = [];
  for (const btn of dashboardBtns.slice(0, 20)) {
    const t = await btn.innerText().catch(() => '');
    if (t.trim()) dashBtnLabels.push(t.trim());
  }
  notes.push(`Dashboard buttons: ${dashBtnLabels.join(' | ')}`);

  // ─────────────────────────────────────────
  // STEP 4: Lineup Editor
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 4: Lineup Editor ===');
  await goto('/franchise/lineup-editor', 2000);
  await screenshot('09_lineup_editor');
  const lineupText = await page.innerText('body').catch(() => '');
  notes.push(`Lineup editor loaded: ${lineupText.length > 100}`);
  notes.push(`Has batting order: ${lineupText.toLowerCase().includes('batting') || lineupText.toLowerCase().includes('lineup')}`);
  notes.push(`Has pitching tab: ${lineupText.toLowerCase().includes('pitch')}`);

  // Check tabs
  const lineupTabs = await page.locator('[role="tab"], button').filter({ hasText: /batting|pitching|rotation|bullpen/i }).all();
  for (const tab of lineupTabs) {
    const tabText = await tab.innerText();
    notes.push(`  Lineup tab: "${tabText}"`);
    await tab.click();
    await page.waitForTimeout(500);
  }
  await screenshot('10_lineup_pitching_tab');

  // Check for drag-and-drop elements
  const draggableItems = await page.locator('[draggable="true"]').count();
  notes.push(`Draggable items in lineup: ${draggableItems}`);
  if (draggableItems === 0) {
    bugs.push({
      page: '/franchise/lineup-editor',
      severity: 'HIGH',
      issue: 'No draggable items found in lineup editor — drag-and-drop batting order may not be working',
      expected: 'Batting order slots should be draggable',
      actual: 'Zero elements have draggable=true attribute'
    });
  }

  // ─────────────────────────────────────────
  // STEP 5: Roster Page
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 5: Roster Page ===');
  await goto('/franchise/roster', 2000);
  await screenshot('11_roster');
  const rosterText = await page.innerText('body').catch(() => '');
  notes.push(`Roster page loaded: ${rosterText.length > 100}`);
  notes.push(`Has player names: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(rosterText)}`);

  // Check trade/release buttons
  const tradeBtn = await page.locator('button:has-text("Trade")').count();
  const releaseBtn = await page.locator('button:has-text("Release")').count();
  notes.push(`Trade buttons: ${tradeBtn}, Release buttons: ${releaseBtn}`);

  if (tradeBtn > 0) {
    // Click first trade button and see what happens
    await page.locator('button:has-text("Trade")').first().click();
    await page.waitForTimeout(800);
    await screenshot('12_roster_trade_click');
    const afterTradeText = await page.innerText('body').catch(() => '');
    notes.push(`After clicking Trade button — URL: ${page.url()}`);
    notes.push(`After clicking Trade — has modal/form: ${afterTradeText.includes('Trade') && afterTradeText.length > rosterText.length}`);
    // Go back if navigated away
    if (!page.url().includes('/roster')) {
      await page.goBack();
      await page.waitForTimeout(500);
    }
  }

  // ─────────────────────────────────────────
  // STEP 6: News Page
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 6: News Page ===');
  await goto('/franchise/news', 2000);
  await screenshot('13_news');
  const newsText = await page.innerText('body').catch(() => '');
  notes.push(`News page loaded: ${newsText.length > 50}`);
  notes.push(`Has news items: ${newsText.toLowerCase().includes('news') || newsText.toLowerCase().includes('bulletin')}`);

  const newsItemCount = await page.locator('[class*="news"], [class*="bulletin"], article, .news-item').count();
  notes.push(`News item elements: ${newsItemCount}`);

  if (newsText.toLowerCase().includes('no news') || newsText.toLowerCase().includes('no bulletin') || newsText.trim().length < 100) {
    bugs.push({
      page: '/franchise/news',
      severity: 'MEDIUM',
      issue: 'News/Bulletin page appears empty after simming 30 days',
      expected: 'League news, transactions, injury reports should appear',
      actual: `Page body very short (${newsText.trim().length} chars) or explicitly empty`
    });
  }

  // ─────────────────────────────────────────
  // STEP 7: Standings
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 7: Standings ===');
  await goto('/franchise/standings', 2000);
  await screenshot('14_standings');
  const standingsText = await page.innerText('body').catch(() => '');
  notes.push(`Standings loaded: ${standingsText.length > 100}`);
  notes.push(`Has W/L columns: ${standingsText.includes('W') && standingsText.includes('L')}`);
  notes.push(`Has division names: ${/AL East|AL West|AL Central|NL East|NL West|NL Central/i.test(standingsText)}`);

  if (!/\d+-\d+/.test(standingsText) && !/\d+\s+\d+/.test(standingsText)) {
    bugs.push({
      page: '/franchise/standings',
      severity: 'HIGH',
      issue: 'Standings page shows no win-loss records',
      expected: 'Teams with W-L records after simming',
      actual: 'No numeric win-loss pattern found in page'
    });
  }

  // ─────────────────────────────────────────
  // STEP 8: League Leaders
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 8: League Leaders ===');
  await goto('/franchise/leaders', 2000);
  await screenshot('15_league_leaders_batting');
  const leadersText = await page.innerText('body').catch(() => '');
  notes.push(`Leaders page loaded: ${leadersText.length > 100}`);
  notes.push(`Has batting stats: ${/\.2\d\d|AVG|BA|batting/i.test(leadersText)}`);

  // Click pitching tab
  const pitchingTab = await page.locator('button, [role="tab"]').filter({ hasText: /pitching|ERA|pitcher/i }).first();
  if (await pitchingTab.count() > 0) {
    await pitchingTab.click();
    await page.waitForTimeout(800);
    await screenshot('16_league_leaders_pitching');
    const pitchingText = await page.innerText('body').catch(() => '');
    notes.push(`Pitching tab works: ${/ERA|\d+\.\d{2}|K\/9|WHIP/i.test(pitchingText)}`);
  } else {
    bugs.push({
      page: '/franchise/leaders',
      severity: 'MEDIUM',
      issue: 'No pitching tab found on League Leaders page',
      expected: 'Batting and Pitching tabs',
      actual: 'Could not find pitching tab'
    });
  }

  // ─────────────────────────────────────────
  // STEP 9: Hot/Cold
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 9: Hot/Cold ===');
  await goto('/franchise/hot-cold', 2000);
  await screenshot('17_hot_cold');
  const hotColdText = await page.innerText('body').catch(() => '');
  notes.push(`Hot/Cold loaded: ${hotColdText.length > 100}`);
  notes.push(`Has hot players: ${hotColdText.toLowerCase().includes('hot')}`);
  notes.push(`Has cold players: ${hotColdText.toLowerCase().includes('cold')}`);

  if (hotColdText.toLowerCase().includes('no players') || hotColdText.trim().length < 200) {
    bugs.push({
      page: '/franchise/hot-cold',
      severity: 'MEDIUM',
      issue: 'Hot/Cold page appears empty or minimal after simming',
      expected: 'Players showing hot/cold streaks based on recent performance',
      actual: `Page body: ${hotColdText.trim().substring(0, 200)}`
    });
  }

  // ─────────────────────────────────────────
  // STEP 10: Free Agency
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 10: Free Agency ===');
  await goto('/franchise/free-agency', 2000);
  await screenshot('18_free_agency');
  const freeAgencyText = await page.innerText('body').catch(() => '');
  notes.push(`Free Agency loaded: ${freeAgencyText.length > 100}`);
  notes.push(`Has players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(freeAgencyText)}`);
  notes.push(`Has sign buttons: ${freeAgencyText.toLowerCase().includes('sign')}`);

  // Try expanding a player card if present
  const expandBtns = await page.locator('button').filter({ hasText: /expand|details|view|more/i }).all();
  notes.push(`Expandable items: ${expandBtns.length}`);

  // Try to sign a player
  const signBtn = await page.locator('button:has-text("Sign")').first();
  if (await signBtn.count() > 0) {
    await signBtn.click();
    await page.waitForTimeout(1000);
    await screenshot('19_free_agency_sign_attempt');
    const afterSign = await page.innerText('body').catch(() => '');
    notes.push(`After Sign click — shows offer/form: ${afterSign.toLowerCase().includes('offer') || afterSign.toLowerCase().includes('contract')}`);
    // Check for confirmation/success
    const successToast = await page.locator('[class*="toast"], [class*="alert"], [class*="success"]').count();
    notes.push(`Success/toast elements after sign: ${successToast}`);
    // Press Escape to close any modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // ─────────────────────────────────────────
  // STEP 11: Waivers
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 11: Waivers ===');
  await goto('/franchise/waivers', 2000);
  await screenshot('20_waivers');
  const waiversText = await page.innerText('body').catch(() => '');
  notes.push(`Waivers loaded: ${waiversText.length > 100}`);
  notes.push(`Has claim buttons: ${waiversText.toLowerCase().includes('claim')}`);
  notes.push(`Has waiver players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(waiversText)}`);

  // ─────────────────────────────────────────
  // STEP 12: Injuries
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 12: Injury Report ===');
  await goto('/franchise/injuries', 2000);
  await screenshot('21_injuries');
  const injuriesText = await page.innerText('body').catch(() => '');
  notes.push(`Injuries page loaded: ${injuriesText.length > 100}`);
  notes.push(`Has IL/DL reference: ${/IL|DL|injured/i.test(injuriesText)}`);

  const ilBtns = await page.locator('button').filter({ hasText: /IL|place|activate/i }).all();
  notes.push(`IL action buttons: ${ilBtns.length}`);

  // ─────────────────────────────────────────
  // STEP 13: Trade Center
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 13: Trade Center ===');
  await goto('/franchise/trade', 2000);
  await screenshot('22_trade_center');
  const tradeText = await page.innerText('body').catch(() => '');
  notes.push(`Trade page loaded: ${tradeText.length > 100}`);
  notes.push(`Has team selector: ${tradeText.toLowerCase().includes('team')}`);
  notes.push(`Has propose button: ${tradeText.toLowerCase().includes('propose') || tradeText.toLowerCase().includes('offer')}`);

  // Try interacting with trade UI
  const tradeTeamSelect = await page.locator('select, [class*="select"]').first();
  if (await tradeTeamSelect.count() > 0) {
    notes.push('Trade has team select dropdown');
  }

  // Check trade proposals sub-page
  await goto('/franchise/trade-proposals', 1500);
  await screenshot('23_trade_proposals');
  const proposalsText = await page.innerText('body').catch(() => '');
  notes.push(`Trade proposals loaded: ${proposalsText.length > 100}`);
  notes.push(`Has proposals: ${proposalsText.toLowerCase().includes('proposal') || proposalsText.toLowerCase().includes('offer')}`);

  // ─────────────────────────────────────────
  // STEP 14: Finances
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 14: Finances ===');
  await goto('/franchise/finances', 2000);
  await screenshot('24_finances');
  const financesText = await page.innerText('body').catch(() => '');
  notes.push(`Finances loaded: ${financesText.length > 100}`);
  notes.push(`Has budget/payroll: ${financesText.toLowerCase().includes('budget') || financesText.toLowerCase().includes('payroll')}`);
  notes.push(`Has dollar amounts: ${/\$[\d,]+|\d+M/.test(financesText)}`);

  if (!financesText.toLowerCase().includes('budget') && !financesText.toLowerCase().includes('payroll') && !financesText.toLowerCase().includes('salary')) {
    bugs.push({
      page: '/franchise/finances',
      severity: 'HIGH',
      issue: 'Finances page shows no financial data (no budget/payroll/salary)',
      expected: 'Budget sliders, payroll breakdown, revenue/expense data',
      actual: `Page content: ${financesText.trim().substring(0, 300)}`
    });
  }

  // ─────────────────────────────────────────
  // STEP 15: Minor Leagues
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 15: Minor Leagues ===');
  await goto('/franchise/minors', 2000);
  await screenshot('25_minors');
  const minorsText = await page.innerText('body').catch(() => '');
  notes.push(`Minors loaded: ${minorsText.length > 100}`);
  notes.push(`Has level labels (AAA/AA/A): ${/AAA|AA[^A]|Single[-\s]A|\bA\b.*level/i.test(minorsText)}`);
  notes.push(`Has prospects: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(minorsText)}`);
  notes.push(`Minors page length: ${minorsText.trim().length}`);

  if (!(/AAA|AA[^A]|Minor/i.test(minorsText))) {
    bugs.push({
      page: '/franchise/minors',
      severity: 'HIGH',
      issue: 'Minor League page shows no minor league system with levels',
      expected: 'AAA/AA/A-ball teams with prospect lists',
      actual: `Page content: ${minorsText.trim().substring(0, 300)}`
    });
  }

  // ─────────────────────────────────────────
  // STEP 16: Scouting
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 16: Scouting ===');
  await goto('/franchise/scouting', 2000);
  await screenshot('26_scouting');
  const scoutingText = await page.innerText('body').catch(() => '');
  notes.push(`Scouting loaded: ${scoutingText.length > 100}`);
  notes.push(`Has grades/ratings: ${/grade|rating|[A-F][+-]?|\d{2,3}\/\d{2,3}/i.test(scoutingText)}`);
  notes.push(`Has scout reports: ${scoutingText.toLowerCase().includes('scout') || scoutingText.toLowerCase().includes('report')}`);

  // ─────────────────────────────────────────
  // STEP 17: Training
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 17: Training Center ===');
  await goto('/franchise/training', 2000);
  await screenshot('27_training');
  const trainingText = await page.innerText('body').catch(() => '');
  notes.push(`Training loaded: ${trainingText.length > 100}`);
  notes.push(`Has training options: ${trainingText.toLowerCase().includes('train')}`);
  notes.push(`Has attributes: ${/speed|power|contact|fielding|arm/i.test(trainingText)}`);

  // Try to interact with training
  const trainBtns = await page.locator('button').filter({ hasText: /train|improve|focus/i }).all();
  notes.push(`Training action buttons: ${trainBtns.length}`);
  if (trainBtns.length > 0) {
    await trainBtns[0].click();
    await page.waitForTimeout(500);
    await screenshot('28_training_after_click');
  }

  // ─────────────────────────────────────────
  // STEP 18: Draft
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 18: Draft ===');
  await goto('/franchise/draft', 2000);
  await screenshot('29_draft');
  const draftText = await page.innerText('body').catch(() => '');
  notes.push(`Draft loaded: ${draftText.length > 100}`);
  notes.push(`Has prospects: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(draftText)}`);
  notes.push(`Has draft controls: ${draftText.toLowerCase().includes('draft') || draftText.toLowerCase().includes('pick')}`);

  if (draftText.toLowerCase().includes('offseason') || draftText.toLowerCase().includes('not available') || draftText.trim().length < 200) {
    notes.push(`WARN: Draft page may be unavailable during season: ${draftText.trim().substring(0, 200)}`);
  }

  // ─────────────────────────────────────────
  // STEP 19: Career Mode
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 19: Career Mode ===');
  await goto('/career', 2000);
  await screenshot('30_career_mode');
  const careerText = await page.innerText('body').catch(() => '');
  notes.push(`Career mode loaded: ${careerText.length > 100}`);
  notes.push(`Has player info: ${careerText.toLowerCase().includes('career') || careerText.toLowerCase().includes('player')}`);

  // Check if career player exists
  if (careerText.toLowerCase().includes('create') || careerText.toLowerCase().includes('no player')) {
    notes.push('No career player found — career mode not started');
    // Try to start career
    const createBtn = await page.locator('button').filter({ hasText: /create|start|new player/i }).first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await page.waitForTimeout(1000);
      await screenshot('31_create_career_player');
      const createText = await page.innerText('body').catch(() => '');
      notes.push(`Create career page: has form: ${createText.toLowerCase().includes('name') || createText.toLowerCase().includes('position')}`);
    }
  }

  // ─────────────────────────────────────────
  // STEP 20: Additional pages — Payroll, Game Log, History
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 20: Additional Pages ===');

  await goto('/franchise/payroll', 1500);
  await screenshot('32_payroll');
  const payrollText = await page.innerText('body').catch(() => '');
  notes.push(`Payroll page - has salary data: ${/\$[\d,]+|\d+M/.test(payrollText)}`);
  notes.push(`Payroll content length: ${payrollText.trim().length}`);

  await goto('/franchise/game-log', 1500);
  await screenshot('33_game_log');
  const gameLogText = await page.innerText('body').catch(() => '');
  notes.push(`Game log loaded: ${gameLogText.length > 100}`);
  notes.push(`Has game results: ${/\d+-\d+|W|L/.test(gameLogText)}`);
  notes.push(`Game log content length: ${gameLogText.trim().length}`);

  await goto('/franchise/history', 1500);
  await screenshot('34_franchise_history');
  const historyText = await page.innerText('body').catch(() => '');
  notes.push(`Franchise history loaded: ${historyText.length > 100}`);

  await goto('/franchise/records', 1500);
  await screenshot('35_records');
  const recordsText = await page.innerText('body').catch(() => '');
  notes.push(`Records page loaded: ${recordsText.length > 100}`);

  await goto('/franchise/awards', 1500);
  await screenshot('36_awards');
  const awardsText = await page.innerText('body').catch(() => '');
  notes.push(`Awards page loaded: ${awardsText.length > 100}`);

  await goto('/franchise/all-star', 1500);
  await screenshot('37_all_star');
  const allStarText = await page.innerText('body').catch(() => '');
  notes.push(`All-Star page loaded: ${allStarText.length > 100}`);

  // ─────────────────────────────────────────
  // STEP 21: Test team stats and player stats
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 21: Stats Detail Pages ===');

  await goto('/franchise/team-stats', 1500);
  await screenshot('38_team_stats');
  const teamStatsUrl = page.url();
  const teamStatsText = await page.innerText('body').catch(() => '');
  notes.push(`Team stats URL redirect: ${teamStatsUrl}`);
  notes.push(`Team stats content: ${teamStatsText.trim().length} chars`);
  notes.push(`Has batting stats: ${/AVG|OBP|SLG|batting/i.test(teamStatsText)}`);

  // ─────────────────────────────────────────
  // STEP 22: Re-check Schedule for remaining functionality
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 22: Schedule Deep Check ===');
  await goto('/franchise/schedule', 1500);
  await screenshot('39_schedule_full');

  // Look for season progress bar
  const progressBar = await page.locator('[role="progressbar"], [class*="progress"]').count();
  notes.push(`Progress bar elements: ${progressBar}`);

  // Check for game details/click
  const gameRows = await page.locator('tr, [class*="game-row"], [class*="game-item"]').count();
  notes.push(`Game rows in schedule: ${gameRows}`);

  // Look for any "Advance to Playoffs" or season-end indicators
  const seasonEndText = await page.innerText('body').catch(() => '');
  notes.push(`Season end/playoffs indicator: ${seasonEndText.toLowerCase().includes('playoff') || seasonEndText.toLowerCase().includes('season end')}`);

  // ─────────────────────────────────────────
  // STEP 23: Sidebar navigation check
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 23: Sidebar Navigation ===');
  await goto('/franchise', 1500);
  await screenshot('40_sidebar_nav');
  
  const sidebarLinks = await page.locator('nav a, [class*="sidebar"] a, [class*="nav"] a').all();
  const sidebarLinkLabels = [];
  for (const link of sidebarLinks.slice(0, 30)) {
    const t = await link.innerText().catch(() => '');
    const href = await link.getAttribute('href').catch(() => '');
    if (t.trim()) sidebarLinkLabels.push(`${t.trim()} -> ${href}`);
  }
  notes.push(`Sidebar links: ${sidebarLinkLabels.join(', ')}`);

  // ─────────────────────────────────────────
  // STEP 24: Check for console errors accumulated
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 24: Console Errors Accumulated ===');
  notes.push(`Total console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 20).forEach((e, i) => {
    notes.push(`  Error ${i+1}: ${e.substring(0, 200)}`);
  });

  // ─────────────────────────────────────────
  // STEP 25: Test specific known-issue areas
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 25: Specific Feature Tests ===');

  // Test: Schedule "Sim All" or bulk sim
  await goto('/franchise/schedule', 1500);
  const allSimBtns = await page.locator('button').all();
  const simBtnLabels = [];
  for (const btn of allSimBtns) {
    const t = await btn.innerText().catch(() => '');
    if (/sim|advance|next|play/i.test(t)) simBtnLabels.push(t.trim());
  }
  notes.push(`Schedule sim-type buttons: ${simBtnLabels.join(' | ')}`);

  // Test: Lineup editor save
  await goto('/franchise/lineup-editor', 1500);
  const saveBtn = await page.locator('button:has-text("Save")').first();
  notes.push(`Lineup editor has Save button: ${await saveBtn.count() > 0}`);

  // Test: Free agency - check for budget display
  await goto('/franchise/free-agency', 1500);
  const faPageText = await page.innerText('body').catch(() => '');
  notes.push(`Free agency shows budget/cap: ${/budget|cap|remaining|\$\d/i.test(faPageText)}`);
  notes.push(`Free agency player count (rough): ${(faPageText.match(/\bSP\b|\bRP\b|\bC\b|\b1B\b|\bSS\b|\bOF\b|\bDH\b/g) || []).length}`);

  // Test: WaiverWire has players?
  await goto('/franchise/waivers', 1500);
  const waiversFullText = await page.innerText('body').catch(() => '');
  notes.push(`Waivers has player entries: ${(waiversFullText.match(/Claim|Release/gi) || []).length}`);

  // Test: Development hub
  await goto('/franchise/development', 1500);
  await screenshot('41_development_hub');
  const devText = await page.innerText('body').catch(() => '');
  notes.push(`Development hub loaded: ${devText.length > 100}`);
  notes.push(`Dev hub content: ${devText.trim().substring(0, 300)}`);

  // Test: Settings page
  await goto('/settings', 1500);
  await screenshot('42_settings');
  const settingsText = await page.innerText('body').catch(() => '');
  notes.push(`Settings loaded: ${settingsText.length > 100}`);

  // ─────────────────────────────────────────
  // STEP 26: Check roster data integrity
  // ─────────────────────────────────────────
  notes.push('\n=== STEP 26: Roster Data Integrity ===');
  await goto('/franchise/roster', 1500);
  const rosterFullText = await page.innerText('body').catch(() => '');
  
  // Count players visible
  const playerMatches = rosterFullText.match(/\b(SP|RP|C|1B|2B|3B|SS|LF|CF|RF|OF|DH)\b/g) || [];
  notes.push(`Position abbreviations found in roster: ${playerMatches.length}`);

  // Check for stats on roster (AVG, ERA etc)
  notes.push(`Roster shows batting stats: ${/\.[\d]{3}|AVG/i.test(rosterFullText)}`);
  notes.push(`Roster shows pitching stats: ${/ERA|\d+\.\d{2}/i.test(rosterFullText)}`);

  // ─────────────────────────────────────────
  // FINAL: Summary
  // ─────────────────────────────────────────
  notes.push('\n=== FINAL: Bug Summary ===');
  notes.push(`Total bugs found: ${bugs.length}`);
  bugs.forEach((bug, i) => {
    notes.push(`BUG ${i+1} [${bug.severity}] - ${bug.page}`);
    notes.push(`  Issue: ${bug.issue}`);
    notes.push(`  Expected: ${bug.expected}`);
    notes.push(`  Actual: ${bug.actual}`);
  });

  await browser.close();

  // Write report
  writeFileSync('/tmp/claudeball_audit_notes.txt', notes.join('\n'));
  writeFileSync('/tmp/claudeball_audit_bugs.json', JSON.stringify(bugs, null, 2));
  console.log('=== AUDIT COMPLETE ===');
  console.log(notes.join('\n'));
}

main().catch(err => {
  console.error('Audit failed:', err);
  if (browser) browser.close();
});
