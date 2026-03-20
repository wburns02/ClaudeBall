import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:5179';
const SS_DIR = '/tmp/cb_audit4';
mkdirSync(SS_DIR, { recursive: true });

let browser, page;
const notes = [];
const bugs = [];

async function ss(name) {
  const path = `${SS_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}
async function goto(path, ms = 2000) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForTimeout(ms);
  return page.url();
}
async function bodyText() {
  return page.innerText('body').catch(() => '');
}
async function getMainContent() {
  // Get content AFTER the sidebar
  const mainText = await page.evaluate(() => {
    const main = document.querySelector('main') || document.querySelector('[class*="main-content"]') || document.querySelector('[class*="page-content"]');
    if (main) return main.innerText;
    // Try to get everything after the nav sidebar
    const nav = document.querySelector('nav') || document.querySelector('[class*="sidebar"]');
    if (nav) {
      let sibling = nav.nextElementSibling;
      let text = '';
      while (sibling) {
        text += sibling.innerText + '\n';
        sibling = sibling.nextElementSibling;
      }
      return text;
    }
    return document.body.innerText;
  });
  return mainText || '';
}
const consoleErrors = [];
const pageErrors = [];

async function main() {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  // ── Create franchise ──────────────────────────────────────
  notes.push('=== CREATE FRANCHISE ===');
  await goto('/franchise/new', 3000);
  
  // Click Austin Thunderhawks specifically
  await page.locator('text=Austin Thunderhawks').first().click();
  await page.waitForTimeout(500);
  notes.push('Clicked Austin Thunderhawks');
  
  await page.locator('button:has-text("Start Season")').click();
  await page.waitForTimeout(4000);
  notes.push(`URL: ${page.url()}`);
  
  // ── Sim 30 days ──────────────────────────────────────────
  notes.push('\n=== SIM 30 DAYS ===');
  await goto('/franchise/schedule', 2000);
  
  // Sim by clicking individual game sim buttons
  // The schedule shows "Sim→7", "Sim→8" etc. which sim to that specific day
  // We need to advance day by day or use "Advance Day 1" from dashboard
  
  // Go back to dashboard to use "Advance Day 1" button
  await goto('/franchise', 1000);
  let mainContent = await getMainContent();
  notes.push(`Dashboard content: ${mainContent.substring(0, 300)}`);
  
  // Look for sim buttons on dashboard
  const advanceBtn = page.locator('button:has-text("Advance Day 1")');
  const sim7Btn = page.locator('button:has-text("Sim 7 Days")');
  const sim30Btn = page.locator('button:has-text("Sim 30 Days")');
  
  notes.push(`Advance Day 1 exists: ${await advanceBtn.count()}`);
  notes.push(`Sim 7 Days exists: ${await sim7Btn.count()}`);
  notes.push(`Sim 30 Days exists: ${await sim30Btn.count()}`);
  
  // Use Sim 30 Days first for bulk simulation
  if (await sim30Btn.count() > 0) {
    await sim30Btn.click();
    await page.waitForTimeout(8000); // Wait for sim to complete
    notes.push('Clicked Sim 30 Days');
    await ss('01_after_sim30');
    mainContent = await getMainContent();
    notes.push(`After sim30 dashboard: ${mainContent.substring(0, 500)}`);
  } else if (await sim7Btn.count() > 0) {
    // Sim 7 days x4 = 28 days
    for (let i = 0; i < 4; i++) {
      const btn = page.locator('button:has-text("Sim 7 Days")');
      if (await btn.count() > 0 && await btn.isEnabled()) {
        await btn.click();
        await page.waitForTimeout(3000);
        notes.push(`Sim 7 days click ${i+1}`);
      }
    }
    await ss('01_after_sim28');
  } else {
    // Try sim from schedule page
    await goto('/franchise/schedule', 1500);
    // Click Sim→N buttons multiple times
    let simsRun = 0;
    for (let i = 0; i < 15; i++) {
      const simBtns = await page.locator('button').filter({ hasText: /Sim→\d+/ }).all();
      if (simBtns.length > 0) {
        await simBtns[0].click();
        await page.waitForTimeout(2000);
        simsRun++;
      } else break;
    }
    notes.push(`Sim→N clicks: ${simsRun}`);
    await ss('01_after_simN');
  }
  
  // Verify we have some games played
  await goto('/franchise', 1000);
  const dashAfterSim = await getMainContent();
  notes.push(`Dashboard after sim: ${dashAfterSim.substring(0, 400)}`);
  const hasRecord = /\d+-\d+/.test(dashAfterSim);
  notes.push(`Has W-L record: ${hasRecord}`);
  
  if (!hasRecord) {
    bugs.push({
      page: '/franchise (Dashboard)',
      severity: 'HIGH',
      issue: 'Sim 30 Days button does not advance season — dashboard still shows 0-0 record',
      expected: 'After clicking "Sim 30 Days", teams should have W-L records',
      actual: `Dashboard content: ${dashAfterSim.substring(0, 200)}`
    });
  }
  
  await ss('02_dashboard_after_sim');

  // ── 1. Dashboard ──────────────────────────────────────────
  notes.push('\n=== PAGE: Dashboard ===');
  await goto('/franchise', 1500);
  const dashMain = await getMainContent();
  notes.push(`Dashboard main: ${dashMain.substring(0, 600)}`);
  await ss('03_dashboard');
  
  // Check key elements
  notes.push(`Has team record: ${/\d+-\d+/.test(dashMain)}`);
  notes.push(`Has standing: ${/AMERICAN|NATIONAL|EAST|WEST|CENTRAL/.test(dashMain)}`);
  notes.push(`Has Actions section: ${/ACTIONS|Advance|Sim/.test(dashMain)}`);
  notes.push(`Has Recent Games: ${/recent|last game|game log/i.test(dashMain)}`);
  
  // Click action buttons
  const dashBtns = await page.locator('button').filter({ hasText: /Advance|Sim|Go to/ }).all();
  notes.push(`Dashboard action buttons: ${dashBtns.length}`);
  for (const b of dashBtns) {
    notes.push(`  - "${await b.innerText()}"`);
  }

  // ── 2. Schedule page ──────────────────────────────────────
  notes.push('\n=== PAGE: Schedule ===');
  await goto('/franchise/schedule', 1500);
  const schedMain = await getMainContent();
  notes.push(`Schedule main: ${schedMain.substring(0, 800)}`);
  await ss('04_schedule');
  
  // Key checks
  notes.push(`Has game calendar: ${/MON|TUE|WED|THU|FRI|SAT|SUN/.test(schedMain)}`);
  notes.push(`Has game scores: ${/\d+-\d+/.test(schedMain)}`);
  notes.push(`Has season progress: ${/Day \d+|progress/i.test(schedMain)}`);
  notes.push(`Has Sim→ buttons: ${/Sim→\d+/.test(schedMain)}`);
  notes.push(`Has @ or vs: ${/@\s*[A-Z]{2,3}|vs\s*[A-Z]{2,3}/.test(schedMain)}`);
  
  // Try clicking a Sim button from schedule
  const simBtnsSchedule = await page.locator('button').filter({ hasText: /Sim→/ }).all();
  notes.push(`Sim→N buttons on schedule: ${simBtnsSchedule.length}`);
  if (simBtnsSchedule.length > 0) {
    const firstSimText = await simBtnsSchedule[0].innerText();
    notes.push(`First Sim button text: "${firstSimText}"`);
    await simBtnsSchedule[0].click();
    await page.waitForTimeout(3000);
    notes.push('Clicked schedule Sim button');
    const schedAfterSim = await getMainContent();
    notes.push(`Schedule after single sim: ${schedAfterSim.substring(0, 400)}`);
    await ss('04b_schedule_after_sim');
  }
  
  // Click on a game result to see box score
  const gameLinks = await page.locator('a[href*="box-score"]').all();
  notes.push(`Box score links: ${gameLinks.length}`);

  // ── 3. Lineup Editor ──────────────────────────────────────
  notes.push('\n=== PAGE: Lineup Editor ===');
  await goto('/franchise/lineup-editor', 1500);
  const lineupMain = await getMainContent();
  notes.push(`Lineup main: ${lineupMain.substring(0, 800)}`);
  await ss('05_lineup_editor');
  
  notes.push(`Has batting order: ${/batting|order|lineup/i.test(lineupMain)}`);
  notes.push(`Has player names: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(lineupMain)}`);
  
  // Check for draggable elements
  const draggable = await page.locator('[draggable]').count();
  notes.push(`Draggable elements: ${draggable}`);
  
  // Check for pitching tab  
  const lineupBtns = await page.locator('button').all();
  const lineupBtnTexts = [];
  for (const b of lineupBtns) {
    const t = await b.innerText().catch(() => '');
    if (t.trim()) lineupBtnTexts.push(`"${t.trim()}"`);
  }
  notes.push(`Lineup page buttons: ${lineupBtnTexts.join(', ')}`);
  
  // Look for tabs specifically
  const tabs = await page.locator('[role="tab"], button').filter({ hasText: /batting|pitching|rotation|bullpen/i }).all();
  notes.push(`Lineup tabs: ${tabs.length}`);
  for (const t of tabs) {
    notes.push(`  Tab: "${await t.innerText()}"`);
  }
  
  if (draggable === 0) {
    bugs.push({
      page: '/franchise/lineup-editor',
      severity: 'HIGH',
      issue: 'No draggable elements for reordering batting lineup',
      expected: 'Each batting order slot should be draggable for reordering',
      actual: '0 elements with draggable attribute found'
    });
  }
  
  // Click pitching tab if it exists
  const pitchTab = page.locator('button').filter({ hasText: /pitching|rotation/i }).first();
  if (await pitchTab.count() > 0) {
    await pitchTab.click();
    await page.waitForTimeout(500);
    await ss('05b_lineup_pitching');
  }
  
  // Click save
  const saveBtn = page.locator('button:has-text("Save")').first();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(500);
    await ss('05c_lineup_save');
    const saveResult = await getMainContent();
    notes.push(`After save: ${saveResult.substring(0, 200)}`);
  }

  // ── 4. Roster Page ────────────────────────────────────────
  notes.push('\n=== PAGE: Roster ===');
  await goto('/franchise/roster', 1500);
  const rosterMain = await getMainContent();
  notes.push(`Roster main: ${rosterMain.substring(0, 800)}`);
  await ss('06_roster');
  
  notes.push(`Has positions: ${/SP|RP|C\b|1B|2B|3B|SS|LF|CF|RF|DH/i.test(rosterMain)}`);
  notes.push(`Has player names: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(rosterMain)}`);
  notes.push(`Has stats: ${/\.\d{3}|ERA|\d+\.\d{2}/i.test(rosterMain)}`);
  notes.push(`Has OVR: ${/OVR|overall/i.test(rosterMain)}`);
  
  // Count visible player rows
  const playerRows = await page.locator('tr, [class*="player-row"], [class*="roster-row"]').count();
  notes.push(`Player row elements: ${playerRows}`);
  
  // Check for trade/release actions
  const tradeCount = await page.locator('button').filter({ hasText: /trade/i }).count();
  const releaseCount = await page.locator('button').filter({ hasText: /release/i }).count();
  notes.push(`Trade buttons: ${tradeCount}, Release buttons: ${releaseCount}`);
  
  // Click first player name to see stats page
  const firstPlayerLink = await page.locator('a[href*="player"]').first();
  if (await firstPlayerLink.count() > 0) {
    const playerHref = await firstPlayerLink.getAttribute('href');
    notes.push(`Player link href: ${playerHref}`);
    await firstPlayerLink.click();
    await page.waitForTimeout(1000);
    await ss('06b_player_detail');
    const playerDetail = await getMainContent();
    notes.push(`Player detail: ${playerDetail.substring(0, 400)}`);
    await page.goBack();
    await page.waitForTimeout(500);
  }

  // ── 5. News ───────────────────────────────────────────────
  notes.push('\n=== PAGE: News ===');
  await goto('/franchise/news', 1500);
  const newsMain = await getMainContent();
  notes.push(`News main: ${newsMain.substring(0, 800)}`);
  await ss('07_news');
  
  notes.push(`Has news content: ${newsMain.length > 200}`);
  notes.push(`Has game scores: ${/\d+-\d+/.test(newsMain)}`);
  notes.push(`Has transactions: ${/sign|trade|release|injur/i.test(newsMain)}`);
  notes.push(`Has standings: ${/W\s+L|standing/i.test(newsMain)}`);
  
  if (newsMain.trim().length < 200 || newsMain.includes('No news')) {
    bugs.push({
      page: '/franchise/news',
      severity: 'MEDIUM',
      issue: 'News/Bulletin page is empty or has very little content after simming 30+ days',
      expected: 'League news feed with scores, transactions, standings updates',
      actual: `Content: ${newsMain.trim().substring(0, 300)}`
    });
  }

  // ── 6. Standings ─────────────────────────────────────────
  notes.push('\n=== PAGE: Standings ===');
  await goto('/franchise/standings', 1500);
  const standMain = await getMainContent();
  notes.push(`Standings main: ${standMain.substring(0, 800)}`);
  await ss('08_standings');
  
  notes.push(`Has W-L: ${/\d+-\d+|\d+\s+\d+/.test(standMain)}`);
  notes.push(`Has PCT: ${/\.[\d]{3}/.test(standMain)}`);
  notes.push(`Has GB: ${/GB/.test(standMain)}`);
  notes.push(`Has divisions: ${/EAST|WEST|CENTRAL/i.test(standMain)}`);
  notes.push(`Has all 30 teams: ${(standMain.match(/[A-Z]{3}/g)||[]).length}`);
  
  if (!/\d+-\d+/.test(standMain) && !/\d+\s+\d+/.test(standMain)) {
    bugs.push({
      page: '/franchise/standings',
      severity: 'HIGH',
      issue: 'Standings page shows no win-loss records after simming',
      expected: 'Division standings with W, L, PCT, GB columns populated',
      actual: `Content: ${standMain.substring(0, 300)}`
    });
  }
  
  // Try clicking AL tab
  const alTab = page.locator('button').filter({ hasText: /^AL$|American League/i }).first();
  if (await alTab.count() > 0) {
    await alTab.click();
    await page.waitForTimeout(300);
    await ss('08b_standings_al');
  }

  // ── 7. League Leaders ─────────────────────────────────────
  notes.push('\n=== PAGE: League Leaders ===');
  await goto('/franchise/leaders', 1500);
  const leadersMain = await getMainContent();
  notes.push(`Leaders main: ${leadersMain.substring(0, 800)}`);
  await ss('09_leaders');
  
  notes.push(`Has AVG/OBP: ${/AVG|OBP|SLG|\.[\d]{3}/i.test(leadersMain)}`);
  notes.push(`Has HR/RBI: ${/HR\b|RBI|home run/i.test(leadersMain)}`);
  notes.push(`Has players listed: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(leadersMain)}`);
  notes.push(`Games played: ${leadersMain.match(/\d+ games played/i)?.[0] || 'not found'}`);
  
  // Check tabs
  const leaderTabs = await page.locator('button').filter({ hasText: /batting|pitching|fielding/i }).all();
  notes.push(`Leader tabs: ${leaderTabs.length}`);
  for (const t of leaderTabs) {
    notes.push(`  Tab: "${await t.innerText()}"`);
  }
  
  // Click pitching tab
  const pitchingLeadersTab = page.locator('button').filter({ hasText: /pitching/i }).first();
  if (await pitchingLeadersTab.count() > 0) {
    await pitchingLeadersTab.click();
    await page.waitForTimeout(500);
    await ss('09b_leaders_pitching');
    const pitchLeaders = await getMainContent();
    notes.push(`Pitching leaders: ${pitchLeaders.substring(0, 400)}`);
    notes.push(`Has ERA: ${/ERA|WHIP|\d+\.\d{2}/i.test(pitchLeaders)}`);
  }
  
  // Click fielding tab
  const fieldingTab = page.locator('button').filter({ hasText: /fielding/i }).first();
  if (await fieldingTab.count() > 0) {
    await fieldingTab.click();
    await page.waitForTimeout(500);
    const fieldLeaders = await getMainContent();
    notes.push(`Fielding leaders: ${fieldLeaders.substring(0, 200)}`);
  }

  // ── 8. Hot/Cold ───────────────────────────────────────────
  notes.push('\n=== PAGE: Hot/Cold ===');
  await goto('/franchise/hot-cold', 1500);
  const hcMain = await getMainContent();
  notes.push(`Hot/Cold main: ${hcMain.substring(0, 800)}`);
  await ss('10_hot_cold');
  
  notes.push(`Has player names: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(hcMain)}`);
  notes.push(`Has temperature: ${/hot|fire|cold|ice|streak/i.test(hcMain)}`);
  notes.push(`Has stats: ${/\.[\d]{3}|HR|RBI|ERA/i.test(hcMain)}`);
  
  if (hcMain.trim().length < 400) {
    bugs.push({
      page: '/franchise/hot-cold',
      severity: 'LOW',
      issue: 'Hot/Cold page is sparse — limited player heat data shown',
      expected: 'Player list with hot/cold indicators based on recent 7-14 day performance',
      actual: `Content (${hcMain.trim().length} chars): ${hcMain.trim().substring(0, 200)}`
    });
  }

  // ── 9. Free Agency ────────────────────────────────────────
  notes.push('\n=== PAGE: Free Agency ===');
  await goto('/franchise/free-agency', 1500);
  const faMain = await getMainContent();
  notes.push(`FA main: ${faMain.substring(0, 800)}`);
  await ss('11_free_agency');
  
  notes.push(`Has players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(faMain)}`);
  notes.push(`Has positions: ${/SP|RP|C\b|1B|2B|3B|SS|OF|DH/i.test(faMain)}`);
  notes.push(`Has salary: ${/\$[\d,]+|salary|\d+M/i.test(faMain)}`);
  notes.push(`Has sign button: ${/\bSign\b/i.test(faMain)}`);
  notes.push(`Has filter: ${/filter|position|OVR/i.test(faMain)}`);
  notes.push(`Player count in FA: ${(faMain.match(/\bSign\b/gi)||[]).length}`);
  
  // Try clicking a player to expand
  const playerCards = await page.locator('[class*="player"], [class*="card"], tr').all();
  notes.push(`FA player elements: ${playerCards.length}`);
  
  // Try clicking Sign button on first player
  const signBtn = page.locator('button').filter({ hasText: /^Sign$/i }).first();
  if (await signBtn.count() > 0) {
    await signBtn.click();
    await page.waitForTimeout(1000);
    await ss('11b_fa_sign_modal');
    const signModal = await getMainContent();
    notes.push(`Sign modal/result: ${signModal.substring(0, 400)}`);
    // Check if contract UI appeared
    notes.push(`Has contract/years: ${/years|contract|offer|salary/i.test(signModal)}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    notes.push('No Sign button found on FA page');
    bugs.push({
      page: '/franchise/free-agency',
      severity: 'HIGH',
      issue: 'Free Agency page shows 0 available players or no Sign buttons',
      expected: 'List of free agents with Sign buttons and contract negotiation',
      actual: `FA page shows: "${faMain.trim().substring(0, 200)}"`
    });
  }

  // ── 10. Waivers ───────────────────────────────────────────
  notes.push('\n=== PAGE: Waivers ===');
  await goto('/franchise/waivers', 1500);
  const waiMain = await getMainContent();
  notes.push(`Waivers main: ${waiMain.substring(0, 800)}`);
  await ss('12_waivers');
  
  notes.push(`Has claim: ${/claim/i.test(waiMain)}`);
  notes.push(`Has players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(waiMain)}`);
  notes.push(`Has positions: ${/SP|RP|C\b|1B|2B|3B|SS|OF/i.test(waiMain)}`);
  
  if (!waiMain.toLowerCase().includes('claim') && !waiMain.toLowerCase().includes('waiver')) {
    bugs.push({
      page: '/franchise/waivers',
      severity: 'MEDIUM',
      issue: 'Waiver Wire shows no claim functionality or is empty',
      expected: 'List of players on waivers with ability to claim them',
      actual: `Content: ${waiMain.trim().substring(0, 300)}`
    });
  }

  // ── 11. Injuries ──────────────────────────────────────────
  notes.push('\n=== PAGE: Injuries ===');
  await goto('/franchise/injuries', 1500);
  const injMain = await getMainContent();
  notes.push(`Injuries main: ${injMain.substring(0, 800)}`);
  await ss('13_injuries');
  
  notes.push(`Has IL: ${/IL|injured list|DL/i.test(injMain)}`);
  notes.push(`Has injured players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(injMain)}`);
  notes.push(`Has day counts: ${/\d+ days?|return/i.test(injMain)}`);
  notes.push(`Has activate button: ${/activate|place on/i.test(injMain)}`);

  // ── 12. Trade Center ──────────────────────────────────────
  notes.push('\n=== PAGE: Trade Center ===');
  await goto('/franchise/trade', 1500);
  const tradeMain = await getMainContent();
  notes.push(`Trade main: ${tradeMain.substring(0, 800)}`);
  await ss('14_trade');
  
  notes.push(`Has team selector: ${/select team|trade partner|partner/i.test(tradeMain)}`);
  notes.push(`Has player lists: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(tradeMain)}`);
  notes.push(`Has propose: ${/propose|send offer|submit/i.test(tradeMain)}`);
  notes.push(`Has your players: ${/your players|give|send/i.test(tradeMain)}`);
  notes.push(`Has their players: ${/their players|receive|get/i.test(tradeMain)}`);
  
  // Try selecting a trade partner
  const tradeSelect = page.locator('select').first();
  if (await tradeSelect.count() > 0) {
    const optCount = await page.locator('select option').count();
    notes.push(`Trade partner options: ${optCount}`);
    if (optCount > 1) {
      await tradeSelect.selectOption({ index: 1 });
      await page.waitForTimeout(800);
      const tradeAfterSelect = await getMainContent();
      notes.push(`Trade after team select: ${tradeAfterSelect.substring(0, 400)}`);
      await ss('14b_trade_team_selected');
    }
  } else {
    // Maybe it's not a select element
    const teamButtons = await page.locator('button').filter({ hasText: /ICL|CLT|NFK|HFD|NSH|IND/ }).all();
    notes.push(`Team selector buttons: ${teamButtons.length}`);
  }

  // ── 13. Finances ──────────────────────────────────────────
  notes.push('\n=== PAGE: Finances ===');
  await goto('/franchise/finances', 1500);
  const finMain = await getMainContent();
  notes.push(`Finances main: ${finMain.substring(0, 800)}`);
  await ss('15_finances');
  
  notes.push(`Has budget: ${/budget/i.test(finMain)}`);
  notes.push(`Has payroll: ${/payroll/i.test(finMain)}`);
  notes.push(`Has dollar: ${/\$[\d,]+/.test(finMain)}`);
  notes.push(`Has revenue: ${/revenue|income|ticket|attendance/i.test(finMain)}`);
  
  if (!finMain.includes('$') || finMain.trim().length < 300) {
    bugs.push({
      page: '/franchise/finances',
      severity: 'HIGH',
      issue: 'Finances page shows no monetary data — no dollar amounts visible',
      expected: 'Budget overview, payroll totals, revenue streams, expense breakdown',
      actual: `Content: ${finMain.trim().substring(0, 400)}`
    });
  }

  // ── 14. Minor Leagues ─────────────────────────────────────
  notes.push('\n=== PAGE: Minor Leagues ===');
  await goto('/franchise/minors', 1500);
  const minMain = await getMainContent();
  notes.push(`Minors main: ${minMain.substring(0, 1000)}`);
  await ss('16_minors');
  
  notes.push(`Has AAA: ${/AAA|Triple-A/.test(minMain)}`);
  notes.push(`Has AA: ${/\bAA\b|Double-A/.test(minMain)}`);
  notes.push(`Has A-ball: ${/\bA\b|Single-A|Low-A/.test(minMain)}`);
  notes.push(`Has prospects: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(minMain)}`);
  notes.push(`Has grades: ${/\bA\b|\bB\b|\bC\b|\bD\b|grade|tool/i.test(minMain)}`);
  notes.push(`Content length: ${minMain.trim().length}`);
  
  if (!(/AAA|Triple-A/i.test(minMain))) {
    bugs.push({
      page: '/franchise/minors',
      severity: 'HIGH',
      issue: 'Minor League page does not show multi-level system (AAA/AA/A)',
      expected: 'Tiered farm system showing Triple-A, Double-A, and Single-A affiliates with prospect ratings',
      actual: `Content: ${minMain.trim().substring(0, 400)}`
    });
  }

  // ── 15. Scouting ──────────────────────────────────────────
  notes.push('\n=== PAGE: Scouting ===');
  await goto('/franchise/scouting', 1500);
  const scoutMain = await getMainContent();
  notes.push(`Scouting main: ${scoutMain.substring(0, 800)}`);
  await ss('17_scouting');
  
  notes.push(`Has player grades: ${/grade|[A-F][+-]?\s+(?:hit|power|speed|field|arm)/i.test(scoutMain)}`);
  notes.push(`Has tool ratings: ${/hit|power|speed|field|arm/i.test(scoutMain)}`);
  notes.push(`Has scout reports: ${/report|scouting|projection/i.test(scoutMain)}`);
  notes.push(`Content length: ${scoutMain.trim().length}`);

  // ── 16. Training ──────────────────────────────────────────
  notes.push('\n=== PAGE: Training ===');
  await goto('/franchise/training', 1500);
  const trainMain = await getMainContent();
  notes.push(`Training main: ${trainMain.substring(0, 1000)}`);
  await ss('18_training');
  
  notes.push(`Has player names: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(trainMain)}`);
  notes.push(`Has attributes: ${/speed|power|contact|fielding|arm|stamina/i.test(trainMain)}`);
  notes.push(`Has focus/intensity: ${/focus|intensity|program|train/i.test(trainMain)}`);
  notes.push(`Content length: ${trainMain.trim().length}`);
  
  // Try clicking a training option
  const trainBtns = await page.locator('button').filter({ hasText: /assign|focus|set/i }).all();
  notes.push(`Training action buttons: ${trainBtns.length}`);
  if (trainBtns.length > 0) {
    await trainBtns[0].click();
    await page.waitForTimeout(500);
    await ss('18b_training_action');
  }

  // ── 17. Draft ─────────────────────────────────────────────
  notes.push('\n=== PAGE: Draft ===');
  await goto('/franchise/draft', 1500);
  const draftMain = await getMainContent();
  notes.push(`Draft main: ${draftMain.substring(0, 800)}`);
  await ss('19_draft');
  
  notes.push(`Has prospects: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(draftMain)}`);
  notes.push(`Has rounds: ${/round|pick/i.test(draftMain)}`);
  notes.push(`Is offseason only: ${/offseason|not available|draft will/i.test(draftMain)}`);

  // ── 18. Career Mode ───────────────────────────────────────
  notes.push('\n=== PAGE: Career Mode ===');
  await goto('/career', 1500);
  const careerMain = await getMainContent();
  notes.push(`Career main: ${careerMain.substring(0, 800)}`);
  await ss('20_career');
  
  notes.push(`Has player stats: ${/batting|pitching|season/i.test(careerMain)}`);
  notes.push(`Has navigation: ${/training|stats|contract|HOF/i.test(careerMain)}`);
  notes.push(`Is "start career": ${/start.*career|no career|create/i.test(careerMain)}`);
  
  // Try starting a career
  const startCareerBtn = page.locator('button').filter({ hasText: /start.*career|create/i }).first();
  if (await startCareerBtn.count() > 0) {
    await startCareerBtn.click();
    await page.waitForTimeout(1000);
    await ss('20b_career_start');
    notes.push(`Career start page: ${page.url()}`);
  }

  // ── 19. Payroll ───────────────────────────────────────────
  notes.push('\n=== PAGE: Payroll ===');
  await goto('/franchise/payroll', 1500);
  const payMain = await getMainContent();
  notes.push(`Payroll main: ${payMain.substring(0, 800)}`);
  await ss('21_payroll');
  
  notes.push(`Has salary: ${/salary|\$[\d,]+/i.test(payMain)}`);
  notes.push(`Has total payroll: ${/total|payroll/i.test(payMain)}`);
  notes.push(`Content length: ${payMain.trim().length}`);
  
  if (payMain.trim().length < 200 || !payMain.includes('$')) {
    bugs.push({
      page: '/franchise/payroll',
      severity: 'HIGH',
      issue: 'Payroll page shows no player salary data',
      expected: 'Player-by-player breakdown of salaries with totals and budget',
      actual: `Content (${payMain.trim().length} chars): ${payMain.trim().substring(0, 300)}`
    });
  }

  // ── 20. Game Log ──────────────────────────────────────────
  notes.push('\n=== PAGE: Game Log ===');
  await goto('/franchise/game-log', 1500);
  const gameLogMain = await getMainContent();
  notes.push(`Game log main: ${gameLogMain.substring(0, 800)}`);
  await ss('22_game_log');
  
  notes.push(`Has game scores: ${/\d+-\d+/.test(gameLogMain)}`);
  notes.push(`Has dates: ${/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug)/i.test(gameLogMain)}`);
  notes.push(`Has W/L: ${/\bW\b|\bL\b/.test(gameLogMain)}`);
  notes.push(`Has opponents: ${/@\s*[A-Z]{2,3}|vs\s*[A-Z]{2,3}/.test(gameLogMain)}`);
  notes.push(`Content length: ${gameLogMain.trim().length}`);
  
  // Click on game entry
  const gameRows = await page.locator('a[href*="box-score"], tr[class*="game"], [class*="game-row"]').all();
  notes.push(`Clickable game rows: ${gameRows.length}`);

  // ── 21. Additional Pages ──────────────────────────────────
  notes.push('\n=== PAGE: Franchise History ===');
  await goto('/franchise/history', 1500);
  const histMain = await getMainContent();
  notes.push(`History: ${histMain.substring(0, 500)}`);
  await ss('23_history');
  
  notes.push('\n=== PAGE: Awards ===');
  await goto('/franchise/awards', 1500);
  const awardsMain = await getMainContent();
  notes.push(`Awards: ${awardsMain.substring(0, 500)}`);
  await ss('24_awards');
  notes.push(`Has award names: ${/MVP|Cy Young|Rookie|Gold Glove/i.test(awardsMain)}`);
  
  notes.push('\n=== PAGE: All-Star ===');
  await goto('/franchise/all-star', 1500);
  const allStarMain = await getMainContent();
  notes.push(`All-Star: ${allStarMain.substring(0, 500)}`);
  await ss('25_all_star');
  
  notes.push('\n=== PAGE: Records ===');
  await goto('/franchise/records', 1500);
  const recMain = await getMainContent();
  notes.push(`Records: ${recMain.substring(0, 500)}`);
  await ss('26_records');
  notes.push(`Has franchise records: ${/season|record|all-time/i.test(recMain)}`);
  
  notes.push('\n=== PAGE: Trade Proposals ===');
  await goto('/franchise/trade-proposals', 1500);
  const tpMain = await getMainContent();
  notes.push(`Trade proposals: ${tpMain.substring(0, 500)}`);
  await ss('27_trade_proposals');
  notes.push(`Has proposals: ${/proposal|offer|pending|accept|reject/i.test(tpMain)}`);
  
  notes.push('\n=== PAGE: Development Hub ===');
  await goto('/franchise/development', 1500);
  const devMain = await getMainContent();
  notes.push(`Dev hub: ${devMain.substring(0, 500)}`);
  await ss('28_development_hub');
  
  notes.push('\n=== PAGE: Team Stats ===');
  await goto('/franchise/team-stats', 1500);
  const tsUrl = page.url();
  const tsMain = await getMainContent();
  notes.push(`Team stats URL: ${tsUrl}`);
  notes.push(`Team stats: ${tsMain.substring(0, 500)}`);
  await ss('29_team_stats');
  
  if (tsUrl.includes('unknown')) {
    bugs.push({
      page: '/franchise/team-stats',
      severity: 'HIGH',
      issue: 'Team Stats sidebar link redirects to /franchise/team-stats/unknown',
      expected: 'Should redirect to /franchise/team-stats/<userTeamId>',
      actual: `URL: ${tsUrl}. "Team not found" error displayed.`
    });
  }

  // ── 22. Console Errors ────────────────────────────────────
  notes.push('\n=== CONSOLE ERRORS ===');
  notes.push(`Total console errors: ${consoleErrors.length}`);
  notes.push(`Total page errors: ${pageErrors.length}`);
  consoleErrors.slice(0, 20).forEach((e,i) => notes.push(`  Error ${i+1}: ${e.substring(0,200)}`));
  pageErrors.forEach((e,i) => notes.push(`  Page error ${i+1}: ${e.substring(0,200)}`));

  // ── FINAL BUGS ────────────────────────────────────────────
  notes.push('\n=== BUGS FOUND ===');
  bugs.forEach((b,i) => {
    notes.push(`BUG ${i+1} [${b.severity}] ${b.page}`);
    notes.push(`  Issue: ${b.issue}`);
    notes.push(`  Expected: ${b.expected}`);
    notes.push(`  Actual: ${b.actual?.substring(0, 200)}`);
  });

  await browser.close();
  writeFileSync('/tmp/cb_audit4_notes.txt', notes.join('\n'));
  writeFileSync('/tmp/cb_audit4_bugs.json', JSON.stringify(bugs, null, 2));
  console.log(notes.join('\n'));
}

main().catch(e => {
  console.error('Audit failed:', e);
  if (browser) browser.close().catch(() => {});
});
