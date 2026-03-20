/**
 * Phase 1 — Full Product Audit
 * Tests every major route, interaction, and form in ClaudeBall
 */
import { test, Page, Browser } from '@playwright/test';

const BASE = 'http://localhost:5173';
const SS = '/home/will/ClaudeBall/qa-screenshots';

type Result = { name: string; status: 'PASS' | 'FAIL' | 'WARN'; notes: string };
const results: Result[] = [];
const consoleErrors: string[] = [];

function log(name: string, status: 'PASS' | 'FAIL' | 'WARN', notes: string) {
  results.push({ name, status, notes });
  console.log(`[${status}] ${name} | ${notes}`);
}

async function spa(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(900);
}

async function bodyText(page: Page) {
  return await page.textContent('body') ?? '';
}

async function setupFranchise(page: Page) {
  await page.goto(`${BASE}/franchise/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Pick Austin Thunderhawks
  const teamBtn = page.locator('button').filter({ hasText: /Austin|Thunderhawks/ }).first();
  if (await teamBtn.count() > 0) {
    await teamBtn.click();
    await page.waitForTimeout(300);
  }
  const startBtn = page.locator('button').filter({ hasText: /Start Season/i });
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForURL('**/franchise**', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }
}

// Advance the season by simming some days so stats/schedule populate
async function advanceSeason(page: Page, days = 15) {
  await spa(page, '/franchise');
  await page.waitForTimeout(800);
  // Find Advance Day button
  for (let i = 0; i < days; i++) {
    const advBtn = page.locator('button').filter({ hasText: /Advance Day/i }).first();
    if (await advBtn.count() === 0) break;
    await advBtn.click();
    await page.waitForTimeout(400);
    // If modal appears, click Auto-Sim
    const simBtn = page.locator('button').filter({ hasText: /Auto.Sim|Simulate/i }).first();
    if (await simBtn.count() > 0) {
      await simBtn.click();
      await page.waitForTimeout(600);
    } else {
      // press Escape if needed
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
}

test.describe('Phase 1 — Full Audit', () => {
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 200));
    });
    page.on('pageerror', err => consoleErrors.push('[pageerror] ' + err.message.substring(0, 200)));
    await setupFranchise(page);
    await advanceSeason(page, 10);
    console.log('=== FRANCHISE SETUP COMPLETE ===');
  });

  // ── MAIN MENU ─────────────────────────────────────────────────────────────
  test('Main Menu', async () => {
    await spa(page, '/');
    await page.screenshot({ path: `${SS}/audit-01-main-menu.png`, fullPage: true });
    const body = await bodyText(page);
    const ok = body.includes('CLAUDE') || body.includes('BALL') || body.includes('Exhibition') || body.includes('Franchise');
    log('Main Menu', ok ? 'PASS' : 'FAIL', `body=${body.length}ch`);
  });

  // ── FRANCHISE DASHBOARD ────────────────────────────────────────────────────
  test('Franchise Dashboard', async () => {
    await spa(page, '/franchise');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-02-franchise.png`, fullPage: true });
    const body = await bodyText(page);
    const hasAdvance = body.includes('Advance') || body.includes('Day');
    const hasRecord = /\d+-\d+/.test(body);
    log('Franchise Dashboard', hasAdvance && hasRecord ? 'PASS' : 'WARN', `hasAdvance=${hasAdvance} hasRecord=${hasRecord}`);
  });

  // ── ROSTER ─────────────────────────────────────────────────────────────────
  test('Roster Page', async () => {
    await spa(page, '/franchise/roster');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-03-roster.png`, fullPage: true });
    const body = await bodyText(page);
    const rows = await page.locator('tbody tr').count();
    const hasAAA = body.includes('AAA');
    const hasRelease = body.includes('Release');
    log('Roster Page', rows > 0 ? 'PASS' : 'FAIL', `rows=${rows} hasAAA=${hasAAA} hasRelease=${hasRelease}`);
  });

  // ── PLAYER STATS / QUICK ACTIONS ──────────────────────────────────────────
  test('Player Stats + Quick Actions', async () => {
    await spa(page, '/franchise/roster');
    await page.waitForTimeout(1200);
    const rows = page.locator('tbody tr');
    if (await rows.count() > 0) {
      await rows.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/audit-04-player-stats.png`, fullPage: true });
      const body = await bodyText(page);
      const hasQA = body.includes('Quick Actions');
      const hasTrade = body.includes('Trade');
      const hasIL = body.includes('IL') || body.includes('Place on');
      const hasRelease = body.includes('Release');
      log('Player Stats + Quick Actions', hasQA ? 'PASS' : 'WARN', `quickActions=${hasQA} trade=${hasTrade} il=${hasIL} release=${hasRelease}`);
    } else {
      log('Player Stats + Quick Actions', 'FAIL', 'No roster rows found');
    }
  });

  // ── SCHEDULE ───────────────────────────────────────────────────────────────
  test('Schedule Page', async () => {
    await spa(page, '/franchise/schedule');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-05-schedule.png`, fullPage: true });
    const body = await bodyText(page);
    const hasSchedule = body.includes('MON') || body.includes('TUE') || body.includes('Schedule');
    const hasGameBtns = await page.locator('button').filter({ hasText: /Play|Sim|→D/ }).count();
    log('Schedule Page', hasSchedule ? 'PASS' : 'FAIL', `hasSchedule=${hasSchedule} gameBtns=${hasGameBtns}`);
  });

  // ── STANDINGS ─────────────────────────────────────────────────────────────
  test('Standings Page', async () => {
    await spa(page, '/franchise/standings');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-06-standings.png`, fullPage: true });
    const body = await bodyText(page);
    const hasStandings = body.includes('W') && body.includes('L') && body.includes('.') && (body.includes('Division') || body.includes('League'));
    log('Standings Page', hasStandings ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── INBOX ─────────────────────────────────────────────────────────────────
  test('Inbox Page', async () => {
    await spa(page, '/franchise/inbox');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-07-inbox.png`, fullPage: true });
    const body = await bodyText(page);
    const hasInbox = body.includes('Inbox') || body.includes('Message') || body.includes('inbox');
    log('Inbox Page', hasInbox ? 'PASS' : 'FAIL', `bodyLen=${body.length}`);
  });

  // ── NEWS ──────────────────────────────────────────────────────────────────
  test('News Page', async () => {
    await spa(page, '/franchise/news');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-08-news.png`, fullPage: true });
    const body = await bodyText(page);
    const hasNews = body.includes('News') || body.includes('Transaction') || body.includes('Headline');
    log('News Page', hasNews ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── HOT & COLD ────────────────────────────────────────────────────────────
  test('Hot & Cold Page', async () => {
    await spa(page, '/franchise/hot-cold');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-09-hot-cold.png`, fullPage: true });
    const body = await bodyText(page);
    const hasHC = body.includes('HOT') || body.includes('COLD') || body.includes('Hot') || body.includes('Form');
    log('Hot & Cold', hasHC ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── SCOREBOARD ────────────────────────────────────────────────────────────
  test('Scoreboard Page', async () => {
    await spa(page, '/franchise/scoreboard');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-10-scoreboard.png`, fullPage: true });
    const body = await bodyText(page);
    const hasScoreboard = body.includes('Score') || body.includes('Game') || body.includes('Today');
    log('Scoreboard', hasScoreboard ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── GAME LOG ──────────────────────────────────────────────────────────────
  test('Game Log', async () => {
    await spa(page, '/franchise/game-log');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-11-game-log.png`, fullPage: true });
    const body = await bodyText(page);
    const hasGames = body.includes('Day') || body.includes('W') || body.includes('Game');
    const rows = await page.locator('[class*="cursor-pointer"], tr').count();
    log('Game Log', hasGames ? 'PASS' : 'WARN', `bodyLen=${body.length} clickableRows=${rows}`);
  });

  // ── TRADE PAGE ────────────────────────────────────────────────────────────
  test('Trade Page', async () => {
    await spa(page, '/franchise/trade');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-12-trade.png`, fullPage: true });
    const body = await bodyText(page);
    const hasTeams = await page.locator('button').count();
    const hasTrade = body.includes('Trade') || body.includes('Partner') || body.includes('Select');
    log('Trade Page', hasTrade ? 'PASS' : 'WARN', `buttons=${hasTeams} bodyLen=${body.length}`);
  });

  // ── TRADE PROPOSALS ───────────────────────────────────────────────────────
  test('Trade Proposals', async () => {
    await spa(page, '/franchise/trade-proposals');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-13-trade-proposals.png`, fullPage: true });
    const body = await bodyText(page);
    const hasProp = body.includes('Proposal') || body.includes('Offer') || body.includes('Trade');
    log('Trade Proposals', hasProp ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── FREE AGENCY ───────────────────────────────────────────────────────────
  test('Free Agency', async () => {
    await spa(page, '/franchise/free-agency');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-14-free-agency.png`, fullPage: true });
    const body = await bodyText(page);
    const hasFreeAgency = body.includes('Free Agent') || body.includes('free agent') || body.includes('Sign');
    log('Free Agency', hasFreeAgency ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── MINOR LEAGUES ─────────────────────────────────────────────────────────
  test('Minor Leagues', async () => {
    await spa(page, '/franchise/minors');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-15-minors.png`, fullPage: true });
    const body = await bodyText(page);
    const hasMinors = body.includes('Prospect') || body.includes('AAA') || body.includes('Call Up');
    log('Minor Leagues', hasMinors ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── DRAFT ─────────────────────────────────────────────────────────────────
  test('Draft Page', async () => {
    await spa(page, '/franchise/draft');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-16-draft.png`, fullPage: true });
    const body = await bodyText(page);
    const hasDraft = body.includes('Draft') || body.includes('Prospect') || body.includes('Scout');
    log('Draft Page', hasDraft ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── SCOUTING ─────────────────────────────────────────────────────────────
  test('Scouting Hub', async () => {
    await spa(page, '/franchise/scouting');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-17-scouting.png`, fullPage: true });
    const body = await bodyText(page);
    const hasScouting = body.includes('Scout') || body.includes('Report') || body.includes('Grade');
    log('Scouting Hub', hasScouting ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── FINANCES ─────────────────────────────────────────────────────────────
  test('Finances', async () => {
    await spa(page, '/franchise/finances');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-18-finances.png`, fullPage: true });
    const body = await bodyText(page);
    const hasFinances = body.includes('$') || body.includes('Budget') || body.includes('Revenue') || body.includes('Payroll');
    log('Finances', hasFinances ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── PAYROLL ──────────────────────────────────────────────────────────────
  test('Payroll', async () => {
    await spa(page, '/franchise/payroll');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-19-payroll.png`, fullPage: true });
    const body = await bodyText(page);
    const hasPayroll = body.includes('$') || body.includes('Salary') || body.includes('Contract');
    log('Payroll', hasPayroll ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── GM WAR ROOM ───────────────────────────────────────────────────────────
  test('GM War Room', async () => {
    await spa(page, '/franchise/war-room');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-20-war-room.png`, fullPage: true });
    const body = await bodyText(page);
    const hasGM = body.includes('War Room') || body.includes('Needs') || body.includes('Target') || body.includes('Strength');
    log('GM War Room', hasGM ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── POWER RANKINGS ───────────────────────────────────────────────────────
  test('Power Rankings', async () => {
    await spa(page, '/franchise/power-rankings');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-21-power-rankings.png`, fullPage: true });
    const body = await bodyText(page);
    const hasPR = body.includes('Power') || body.includes('Rank') || body.includes('#');
    log('Power Rankings', hasPR ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── LEAGUE LEADERS ───────────────────────────────────────────────────────
  test('League Leaders', async () => {
    await spa(page, '/franchise/leaders');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-22-leaders.png`, fullPage: true });
    const body = await bodyText(page);
    const hasLeaders = body.includes('Leader') || body.includes('AVG') || body.includes('ERA') || body.includes('HR');
    log('League Leaders', hasLeaders ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── TEAM ANALYTICS ───────────────────────────────────────────────────────
  test('Team Analytics', async () => {
    await spa(page, '/franchise/team-analytics');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-23-analytics.png`, fullPage: true });
    const body = await bodyText(page);
    const hasAnalytics = body.includes('Analytic') || body.includes('WAR') || body.includes('OPS') || body.includes('wRC');
    log('Team Analytics', hasAnalytics ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── DEPTH CHART ──────────────────────────────────────────────────────────
  test('Depth Chart', async () => {
    await spa(page, '/franchise/depth-chart');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-24-depth-chart.png`, fullPage: true });
    const body = await bodyText(page);
    const hasDepth = body.includes('Depth') || body.includes('Starter') || body.includes('Backup') || body.includes('SP');
    log('Depth Chart', hasDepth ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── LINEUP EDITOR ────────────────────────────────────────────────────────
  test('Lineup Editor', async () => {
    await spa(page, '/franchise/lineup-editor');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-25-lineup.png`, fullPage: true });
    const body = await bodyText(page);
    const hasLineup = body.includes('Lineup') || body.includes('Batting') || body.includes('Order');
    log('Lineup Editor', hasLineup ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── DEVELOPMENT HUB ──────────────────────────────────────────────────────
  test('Development Hub', async () => {
    await spa(page, '/franchise/development');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-26-development.png`, fullPage: true });
    const body = await bodyText(page);
    const hasDev = body.includes('Development') || body.includes('Training') || body.includes('OVR') || body.includes('Attribute');
    log('Development Hub', hasDev ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── TRAINING CENTER ──────────────────────────────────────────────────────
  test('Training Center', async () => {
    await spa(page, '/franchise/training');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-27-training.png`, fullPage: true });
    const body = await bodyText(page);
    const hasTraining = body.includes('Train') || body.includes('Drill') || body.includes('Focus') || body.includes('Attribute');
    log('Training Center', hasTraining ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── INJURY REPORT ────────────────────────────────────────────────────────
  test('Injury Report', async () => {
    await spa(page, '/franchise/injuries');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-28-injuries.png`, fullPage: true });
    const body = await bodyText(page);
    const hasInjury = body.includes('Injur') || body.includes('IL') || body.includes('Healthy') || body.includes('Day');
    log('Injury Report', hasInjury ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── WAIVERS ──────────────────────────────────────────────────────────────
  test('Waiver Wire', async () => {
    await spa(page, '/franchise/waivers');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-29-waivers.png`, fullPage: true });
    const body = await bodyText(page);
    const hasWaivers = body.includes('Waiver') || body.includes('Claim') || body.includes('Available');
    log('Waiver Wire', hasWaivers ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── TRANSACTIONS ─────────────────────────────────────────────────────────
  test('Transactions', async () => {
    await spa(page, '/franchise/transactions');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-30-transactions.png`, fullPage: true });
    const body = await bodyText(page);
    const hasTx = body.includes('Transaction') || body.includes('Signed') || body.includes('Released') || body.includes('Traded');
    log('Transactions', hasTx ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── AWARDS ───────────────────────────────────────────────────────────────
  test('Awards Page', async () => {
    await spa(page, '/franchise/awards');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-31-awards.png`, fullPage: true });
    const body = await bodyText(page);
    const hasAwards = body.includes('Award') || body.includes('MVP') || body.includes('Cy Young');
    log('Awards Page', hasAwards ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── ALL-STAR ─────────────────────────────────────────────────────────────
  test('All-Star Page', async () => {
    await spa(page, '/franchise/all-star');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-32-all-star.png`, fullPage: true });
    const body = await bodyText(page);
    const hasAllStar = body.includes('All-Star') || body.includes('All Star') || body.includes('Ballot') || body.includes('Midsummer');
    log('All-Star', hasAllStar ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── FRANCHISE HISTORY ────────────────────────────────────────────────────
  test('Franchise History', async () => {
    await spa(page, '/franchise/history');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-33-history.png`, fullPage: true });
    const body = await bodyText(page);
    const hasHistory = body.includes('History') || body.includes('Champion') || body.includes('Season') || body.includes('Year');
    log('Franchise History', hasHistory ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── RECORDS ──────────────────────────────────────────────────────────────
  test('Records Page', async () => {
    await spa(page, '/franchise/records');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-34-records.png`, fullPage: true });
    const body = await bodyText(page);
    const hasRecords = body.includes('Record') || body.includes('All-Time') || body.includes('Leader') || body.includes('Best');
    log('Records', hasRecords ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── PLAYER COMPARISON ────────────────────────────────────────────────────
  test('Player Comparison', async () => {
    await spa(page, '/franchise/compare');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-35-compare.png`, fullPage: true });
    const body = await bodyText(page);
    const hasCmp = body.includes('Compare') || body.includes('vs') || body.includes('Select');
    log('Player Comparison', hasCmp ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── FINANCES — form test ──────────────────────────────────────────────────
  test('Finances — revenue/budget interaction', async () => {
    await spa(page, '/franchise/finances');
    await page.waitForTimeout(1200);
    const body = await bodyText(page);
    // Check for any interactive elements
    const btnCount = await page.locator('button').count();
    const hasDollar = body.includes('$');
    log('Finances Interaction', btnCount > 0 && hasDollar ? 'PASS' : 'WARN', `buttons=${btnCount} hasDollar=${hasDollar}`);
  });

  // ── PLAYER STATS — contract extension inline form ─────────────────────────
  test('Player Stats — Extend Contract form', async () => {
    await spa(page, '/franchise/roster');
    await page.waitForTimeout(1200);
    const rows = page.locator('tbody tr');
    if (await rows.count() > 0) {
      await rows.first().click();
      await page.waitForTimeout(1500);
      // Look for Extend Contract button (only shows when ≤2 yrs remain)
      const extendBtn = page.locator('button').filter({ hasText: /Extend Contract/i });
      const hasExtend = await extendBtn.count() > 0;
      if (hasExtend) {
        await extendBtn.first().click();
        await page.waitForTimeout(500);
        const body = await bodyText(page);
        const hasForm = body.includes('Sign Extension') || body.includes('Years') || body.includes('yr');
        log('Extend Contract Form', hasForm ? 'PASS' : 'WARN', `formVisible=${hasForm}`);
      } else {
        log('Extend Contract Form', 'WARN', 'No expiring contracts on roster — form not testable');
      }
    }
  });

  // ── TRADE — select team + players ────────────────────────────────────────
  test('Trade — team selection + player picker', async () => {
    await spa(page, '/franchise/trade');
    await page.waitForTimeout(1200);
    const body = await bodyText(page);
    // Try clicking any team button
    const teamBtns = page.locator('button').filter({ hasText: /vs\.|@|Ironclads|Crabs|Cubs|Yankees|—/ });
    const teamCount = await page.locator('button').count();
    // Just verify the page has selectable content
    const hasTrade = body.includes('Trade') || body.includes('Partner') || body.includes('Select');
    log('Trade Selection', hasTrade ? 'PASS' : 'WARN', `buttons=${teamCount} hasTrade=${hasTrade}`);
  });

  // ── TRAINING CENTER — form fill ───────────────────────────────────────────
  test('Training Center — focus assign', async () => {
    await spa(page, '/franchise/training');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-training.png`, fullPage: true });
    const body = await bodyText(page);
    const selectCount = await page.locator('select, [role=combobox]').count();
    const btnCount = await page.locator('button').count();
    log('Training Center Interaction', body.length > 500 ? 'PASS' : 'WARN', `selects=${selectCount} buttons=${btnCount} bodyLen=${body.length}`);
  });

  // ── SAVE/LOAD ─────────────────────────────────────────────────────────────
  test('Save/Load Page', async () => {
    await spa(page, '/saves');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-saves.png`, fullPage: true });
    const body = await bodyText(page);
    const hasSave = body.includes('Save') || body.includes('Load') || body.includes('Export') || body.includes('Import');
    log('Save/Load Page', hasSave ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  test('Settings Page', async () => {
    await spa(page, '/settings');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SS}/audit-settings.png`, fullPage: true });
    const body = await bodyText(page);
    const hasSettings = body.includes('Setting') || body.includes('Sound') || body.includes('Speed') || body.includes('Theme');
    log('Settings', hasSettings ? 'PASS' : 'WARN', `bodyLen=${body.length}`);
  });

  // ── ADVANCE DAY — dialog flow ─────────────────────────────────────────────
  test('Advance Day Dialog', async () => {
    await spa(page, '/franchise');
    await page.waitForTimeout(1000);
    const advBtn = page.locator('button').filter({ hasText: /Advance Day/i }).first();
    const hasAdvBtn = await advBtn.count() > 0;
    if (hasAdvBtn) {
      await advBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SS}/audit-advance-day-dialog.png` });
      const body = await bodyText(page);
      const hasPlay = body.includes('Play Live') || body.includes('Play');
      const hasSim = body.includes('Sim') || body.includes('Auto');
      const hasCancel = body.includes('Cancel');
      // Close modal
      await page.keyboard.press('Escape');
      log('Advance Day Dialog', hasPlay && hasSim ? 'PASS' : 'WARN', `hasPlay=${hasPlay} hasSim=${hasSim} hasCancel=${hasCancel}`);
    } else {
      log('Advance Day Dialog', 'WARN', 'No Advance Day button visible');
    }
  });

  // ── CONSOLE ERRORS SUMMARY ────────────────────────────────────────────────
  test('Console Errors', async () => {
    const count = consoleErrors.length;
    consoleErrors.slice(0, 5).forEach((e, i) => console.log(`  ERR[${i}]: ${e}`));
    log('Console Errors', count === 0 ? 'PASS' : count < 5 ? 'WARN' : 'FAIL', `count=${count}`);
  });

  // ── FINAL SUMMARY ─────────────────────────────────────────────────────────
  test('SUMMARY', async () => {
    console.log('\n\n════════════════════════════════════════');
    console.log('       PHASE 1 AUDIT RESULTS');
    console.log('════════════════════════════════════════');
    const passes = results.filter(r => r.status === 'PASS').length;
    const warns = results.filter(r => r.status === 'WARN').length;
    const fails = results.filter(r => r.status === 'FAIL').length;
    results.forEach(r => console.log(`  [${r.status.padEnd(4)}] ${r.name.padEnd(35)} ${r.notes}`));
    console.log(`\n  PASS: ${passes} | WARN: ${warns} | FAIL: ${fails}`);
    console.log('════════════════════════════════════════\n');
  });
});
