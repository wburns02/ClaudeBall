import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:5179';
const SS_DIR = '/tmp/cb_audit2';
mkdirSync(SS_DIR, { recursive: true });

const bugs = [];
const notes = [];
let browser, page;

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

async function allButtonTexts() {
  const btns = await page.locator('button').all();
  const texts = [];
  for (const b of btns) {
    const t = await b.innerText().catch(() => '');
    if (t.trim()) texts.push(t.trim().replace(/\n/g, ' '));
  }
  return texts;
}

const consoleErrors = [];
const pageErrors = [];

async function main() {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  page = await ctx.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));

  // ── 1. Create franchise ──────────────────────────────────────
  notes.push('=== PHASE 1: Create Franchise ===');
  await goto('/franchise/new', 2500);
  await ss('01_new_franchise');
  
  const btns1 = await allButtonTexts();
  notes.push(`New franchise buttons: ${btns1.join(' | ')}`);
  
  // Find a team card/button
  const teamCards = await page.locator('[class*="team"], [class*="card"]').filter({ hasText: /[A-Z]{2,3}/ }).all();
  notes.push(`Team card elements: ${teamCards.length}`);
  
  // Click first team card that looks like a real team
  let teamPicked = false;
  for (const card of teamCards.slice(0, 5)) {
    try {
      await card.click();
      await page.waitForTimeout(300);
      teamPicked = true;
      const cardText = await card.innerText().catch(() => '');
      notes.push(`Clicked team: ${cardText.trim().substring(0, 50)}`);
      break;
    } catch(e) {}
  }
  
  if (!teamPicked) {
    // try button approach
    for (const btn of btns1) {
      if (btn.length > 3 && !['Start Season', 'Back', 'Create Franchise', 'Cancel'].includes(btn)) {
        const clicked = await page.locator(`button:has-text("${btn.substring(0, 20)}")`).first().click().catch(() => false);
        if (clicked !== false) {
          notes.push(`Clicked button as team: ${btn}`);
          teamPicked = true;
          await page.waitForTimeout(300);
          break;
        }
      }
    }
  }
  
  await ss('02_team_selected');
  
  // Now click Start Season or Create Franchise
  const startBtns = ['Start Season', 'Create Franchise', 'Start Franchise', 'Begin Season', 'Start'];
  for (const lbl of startBtns) {
    const b = page.locator(`button:has-text("${lbl}")`);
    if (await b.count() > 0) {
      notes.push(`Clicking: "${lbl}"`);
      await b.first().click();
      await page.waitForTimeout(3000);
      break;
    }
  }
  
  await ss('03_after_start');
  const urlAfterStart = page.url();
  notes.push(`URL after franchise creation: ${urlAfterStart}`);
  
  // Navigate to franchise to confirm
  await goto('/franchise', 2000);
  const dashUrl = page.url();
  notes.push(`Franchise dashboard URL: ${dashUrl}`);
  
  if (dashUrl.includes('/franchise/new')) {
    notes.push('WARNING: Still on /franchise/new — franchise not created!');
    bugs.push({ page: '/franchise/new', severity: 'CRITICAL', issue: 'Franchise creation appears to fail — redirected back to /franchise/new', expected: 'Franchise created and user redirected to /franchise dashboard', actual: `URL remains: ${dashUrl}` });
  }
  
  await ss('04_franchise_dashboard_initial');
  const dashText = await bodyText();
  notes.push(`Dashboard text length: ${dashText.length}`);
  notes.push(`Dashboard has team name: ${/[A-Z][a-z]+ [A-Z][a-z]+|[A-Z]{2,3}/.test(dashText)}`);
  notes.push(`Dashboard has W-L record: ${/\d+-\d+/.test(dashText)}`);
  notes.push(`Dashboard first 500 chars: ${dashText.substring(0, 500)}`);

  // ── 2. Sim 30 days ──────────────────────────────────────────
  notes.push('\n=== PHASE 2: Schedule — Sim Days ===');
  await goto('/franchise/schedule', 2000);
  await ss('05_schedule_initial');
  
  const schedText = await bodyText();
  notes.push(`Schedule initial text (500 chars): ${schedText.substring(0, 500)}`);
  
  const schedBtns = await allButtonTexts();
  notes.push(`Schedule buttons: ${schedBtns.join(' | ')}`);
  
  // Find any sim-related button
  const simBtns = schedBtns.filter(b => /sim|advance|next day|play|week/i.test(b));
  notes.push(`Sim buttons found: ${simBtns.join(' | ')}`);
  
  let simsRun = 0;
  if (simBtns.length > 0) {
    const bestSimBtn = simBtns[0];
    for (let i = 0; i < 15; i++) {
      const btn = page.locator(`button`).filter({ hasText: new RegExp(bestSimBtn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
      if (await btn.count() > 0 && await btn.isEnabled().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(2000);
        simsRun++;
      } else {
        notes.push(`Sim button unavailable after ${i} runs`);
        break;
      }
    }
  }
  
  notes.push(`Simulated ${simsRun} times`);
  await ss('06_schedule_after_sim');
  const schedTextAfter = await bodyText();
  notes.push(`Schedule after sim (500 chars): ${schedTextAfter.substring(0, 500)}`);
  
  // Check if we have game results
  notes.push(`Schedule has game scores: ${/\d+-\d+/.test(schedTextAfter)}`);
  notes.push(`Schedule has dates: ${/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(schedTextAfter)}`);

  // Try a few more sim approaches
  if (simsRun === 0) {
    // Look for any clickable sim-related items
    const allInputs = await page.locator('input[type="range"], select').all();
    notes.push(`Inputs/selects on schedule page: ${allInputs.length}`);
    
    // Screenshot the full page to see what's there
    const schedFullBtns = await page.locator('button').all();
    const schedFullBtnTexts = [];
    for (const b of schedFullBtns) {
      const t = await b.innerText().catch(() => '');
      const enabled = await b.isEnabled().catch(() => false);
      schedFullBtnTexts.push(`"${t.trim()}" (${enabled ? 'enabled' : 'disabled'})`);
    }
    notes.push(`All schedule buttons with state: ${schedFullBtnTexts.join(', ')}`);
    
    bugs.push({
      page: '/franchise/schedule',
      severity: 'CRITICAL',
      issue: 'Schedule page has no functional sim buttons — cannot advance season',
      expected: 'Buttons to sim 1 day, sim week, or advance season',
      actual: `Available buttons: ${schedBtns.join(', ')}`
    });
  }

  // ── 3. Franchise Dashboard deep check ──────────────────────
  notes.push('\n=== PHASE 3: Dashboard Deep Check ===');
  await goto('/franchise', 2000);
  await ss('07_dashboard_after_sim');
  const dash2 = await bodyText();
  notes.push(`Dashboard after sim - text length: ${dash2.length}`);
  notes.push(`Has record: ${/\d+-\d+/.test(dash2)}`);
  notes.push(`Has news: ${/news|bulletin|transaction/i.test(dash2)}`);
  notes.push(`Has standings snippet: ${/standing|GB|games back/i.test(dash2)}`);
  notes.push(`Dashboard full text: ${dash2.substring(0, 800)}`);
  
  // Check dashboard widgets
  const dashWidgets = await page.locator('[class*="widget"], [class*="card"], [class*="panel"], section').all();
  notes.push(`Dashboard widget/panel/section count: ${dashWidgets.length}`);

  // ── 4. Lineup Editor ────────────────────────────────────────
  notes.push('\n=== PHASE 4: Lineup Editor ===');
  await goto('/franchise/lineup-editor', 2000);
  await ss('08_lineup_editor');
  const lineupText = await bodyText();
  notes.push(`Lineup editor text (600 chars): ${lineupText.substring(0, 600)}`);
  
  // Check for tabs
  const lineupBtns = await allButtonTexts();
  notes.push(`Lineup buttons: ${lineupBtns.join(' | ')}`);
  
  // Find batting tab
  const battingTab = await page.locator('button, [role="tab"]').filter({ hasText: /batting|lineup|hitter/i }).first();
  if (await battingTab.count() > 0) {
    notes.push('Found batting tab');
    await battingTab.click();
    await page.waitForTimeout(500);
  }
  
  // Draggable check
  const draggable = await page.locator('[draggable="true"]').count();
  notes.push(`Draggable elements: ${draggable}`);
  
  if (draggable === 0) {
    // Check for alternative drag implementations (react-dnd, etc.)
    const dndItems = await page.locator('[data-rbd-drag-handle-draggable-id], [data-rbd-draggable-id], [class*="drag"], [class*="sortable"]').count();
    notes.push(`Alternative drag elements: ${dndItems}`);
    if (dndItems === 0) {
      bugs.push({
        page: '/franchise/lineup-editor',
        severity: 'HIGH',
        issue: 'Lineup editor drag-and-drop appears non-functional — no draggable elements of any kind',
        expected: 'Batting order entries should be draggable to reorder',
        actual: 'Zero draggable=true or data-dnd attributes found'
      });
    }
  }
  
  // Check save button
  const saveBtn = await page.locator('button:has-text("Save")').count();
  notes.push(`Save button present: ${saveBtn > 0}`);
  
  // Click pitching tab
  const pitchTab = await page.locator('button, [role="tab"]').filter({ hasText: /pitch|rotation|bullpen/i }).first();
  if (await pitchTab.count() > 0) {
    await pitchTab.click();
    await page.waitForTimeout(500);
    await ss('09_lineup_pitching_tab');
    const pitchText = await bodyText();
    notes.push(`Pitching tab text (300 chars): ${pitchText.substring(0, 300)}`);
  } else {
    notes.push('No pitching tab found in lineup editor');
    bugs.push({
      page: '/franchise/lineup-editor',
      severity: 'MEDIUM',
      issue: 'No pitching/rotation tab in lineup editor',
      expected: 'Tabs for Batting Order and Pitching Rotation/Bullpen',
      actual: `Available buttons: ${lineupBtns.join(', ')}`
    });
  }

  // ── 5. Roster Page ──────────────────────────────────────────
  notes.push('\n=== PHASE 5: Roster Page ===');
  await goto('/franchise/roster', 2000);
  await ss('10_roster');
  const rosterText = await bodyText();
  notes.push(`Roster text (500 chars): ${rosterText.substring(0, 500)}`);
  notes.push(`Roster has positions: ${/SP|RP|C\b|1B|2B|3B|SS|LF|CF|RF|OF|DH/i.test(rosterText)}`);
  notes.push(`Roster shows stats: ${/\.[\d]{3}|ERA|\d\.\d{2}/i.test(rosterText)}`);
  
  const rosterBtns = await allButtonTexts();
  notes.push(`Roster buttons: ${rosterBtns.join(' | ')}`);
  
  // Look for Trade and Release
  const tradeBtns = await page.locator('button').filter({ hasText: /trade/i }).count();
  const releaseBtns = await page.locator('button').filter({ hasText: /release/i }).count();
  notes.push(`Trade buttons: ${tradeBtns}, Release buttons: ${releaseBtns}`);
  
  if (tradeBtns === 0 && releaseBtns === 0) {
    bugs.push({
      page: '/franchise/roster',
      severity: 'MEDIUM',
      issue: 'Roster page has no Trade or Release buttons for individual players',
      expected: 'Each player row should have Trade and Release action buttons',
      actual: `No trade or release buttons found. Buttons: ${rosterBtns.slice(0,10).join(', ')}`
    });
  }

  // ── 6. News ─────────────────────────────────────────────────
  notes.push('\n=== PHASE 6: News Page ===');
  await goto('/franchise/news', 2000);
  await ss('11_news');
  const newsText = await bodyText();
  notes.push(`News text (600 chars): ${newsText.substring(0, 600)}`);
  notes.push(`News has articles: ${/transaction|injury|signing|trade|update/i.test(newsText)}`);
  
  const newsItemCount = await page.locator('article, [class*="news-item"], [class*="bulletin"], li').count();
  notes.push(`News list items: ${newsItemCount}`);
  
  if (newsText.trim().length < 300 || newsText.includes('No news') || newsText.includes('no news')) {
    bugs.push({
      page: '/franchise/news',
      severity: 'MEDIUM',
      issue: 'League News/Bulletin page is sparse or empty after simming',
      expected: 'Populated news feed with transactions, injuries, scores',
      actual: `Page content: ${newsText.trim().substring(0, 300)}`
    });
  }

  // ── 7. Standings ────────────────────────────────────────────
  notes.push('\n=== PHASE 7: Standings ===');
  await goto('/franchise/standings', 2000);
  await ss('12_standings');
  const standText = await bodyText();
  notes.push(`Standings text (600 chars): ${standText.substring(0, 600)}`);
  notes.push(`Has W-L: ${/\d+-\d+|\d+\s+\d+/.test(standText)}`);
  notes.push(`Has division headers: ${/AL East|NL East|AL West|NL West|AL Central|NL Central/i.test(standText)}`);
  notes.push(`Has GB: ${/GB|games back/i.test(standText)}`);
  notes.push(`Has PCT: ${/PCT|\.[\d]{3}/i.test(standText)}`);
  
  // Try clicking AL/NL tabs
  const leagueTabs = await page.locator('button, [role="tab"]').filter({ hasText: /AL|NL|American|National/i }).all();
  notes.push(`League tabs: ${leagueTabs.length}`);
  for (const tab of leagueTabs.slice(0, 3)) {
    const t = await tab.innerText();
    await tab.click();
    await page.waitForTimeout(400);
    notes.push(`Clicked tab: ${t.trim()}`);
  }
  await ss('12b_standings_tabs');

  // ── 8. League Leaders ───────────────────────────────────────
  notes.push('\n=== PHASE 8: League Leaders ===');
  await goto('/franchise/leaders', 2000);
  await ss('13_leaders_batting');
  const leadersText = await bodyText();
  notes.push(`Leaders text (600 chars): ${leadersText.substring(0, 600)}`);
  notes.push(`Has batting stats: ${/AVG|\.[\d]{3}|OBP|SLG|HR\b|RBI/i.test(leadersText)}`);
  
  const leaderBtns = await allButtonTexts();
  notes.push(`Leaders buttons: ${leaderBtns.join(' | ')}`);
  
  // Click pitching tab
  const pitchingTabL = await page.locator('button, [role="tab"]').filter({ hasText: /pitch/i }).first();
  if (await pitchingTabL.count() > 0) {
    await pitchingTabL.click();
    await page.waitForTimeout(800);
    await ss('14_leaders_pitching');
    const pitchLeadersText = await bodyText();
    notes.push(`Pitching leaders text (400 chars): ${pitchLeadersText.substring(0, 400)}`);
    notes.push(`Has ERA/W/K: ${/ERA|WHIP|K\/9|\d+\.\d{2}/i.test(pitchLeadersText)}`);
  } else {
    bugs.push({
      page: '/franchise/leaders',
      severity: 'HIGH',
      issue: 'No Pitching tab on League Leaders page',
      expected: 'Batting and Pitching tabs with respective stat leaders',
      actual: `Buttons available: ${leaderBtns.join(', ')}`
    });
  }

  // ── 9. Hot/Cold ─────────────────────────────────────────────
  notes.push('\n=== PHASE 9: Hot/Cold ===');
  await goto('/franchise/hot-cold', 2000);
  await ss('15_hot_cold');
  const hcText = await bodyText();
  notes.push(`Hot/Cold text (600 chars): ${hcText.substring(0, 600)}`);
  notes.push(`Has hot: ${/hot/i.test(hcText)}`);
  notes.push(`Has cold: ${/cold/i.test(hcText)}`);
  notes.push(`Has player names: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(hcText)}`);
  
  const hcBtns = await allButtonTexts();
  notes.push(`Hot/Cold buttons: ${hcBtns.join(' | ')}`);
  
  if (hcText.trim().length < 400) {
    bugs.push({
      page: '/franchise/hot-cold',
      severity: 'LOW',
      issue: 'Hot/Cold page very sparse — may not populate without sim data',
      expected: 'Player heat maps based on recent game performance',
      actual: `Page content (${hcText.trim().length} chars): ${hcText.trim().substring(0, 200)}`
    });
  }

  // ── 10. Free Agency ─────────────────────────────────────────
  notes.push('\n=== PHASE 10: Free Agency ===');
  await goto('/franchise/free-agency', 2000);
  await ss('16_free_agency');
  const faText = await bodyText();
  notes.push(`Free Agency text (600 chars): ${faText.substring(0, 600)}`);
  notes.push(`Has players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(faText)}`);
  notes.push(`Has salary/contract info: ${/\$[\d,]+|\d+M|salary|contract/i.test(faText)}`);
  notes.push(`Has position labels: ${/SP|RP|C\b|1B|2B|3B|SS|OF|DH/i.test(faText)}`);
  notes.push(`Has sign button: ${/sign/i.test(faText)}`);
  notes.push(`Has budget remaining: ${/budget|remaining|cap/i.test(faText)}`);
  
  const faBtns = await allButtonTexts();
  notes.push(`FA buttons: ${faBtns.join(' | ')}`);
  
  // Try to click expand on first player
  const expandable = await page.locator('[class*="expand"], button').filter({ hasText: /details|more|expand|view/i }).first();
  if (await expandable.count() > 0) {
    await expandable.click();
    await page.waitForTimeout(500);
    await ss('16b_fa_expanded');
  }
  
  // Try sign button
  const signBtnFA = await page.locator('button').filter({ hasText: /^sign$/i }).first();
  if (await signBtnFA.count() > 0) {
    await signBtnFA.click();
    await page.waitForTimeout(1000);
    await ss('16c_fa_sign_modal');
    const signModalText = await bodyText();
    notes.push(`Sign modal/result text: ${signModalText.substring(0, 300)}`);
    // Escape any modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  
  if (!faText.includes('$') && !faText.toLowerCase().includes('salary')) {
    bugs.push({
      page: '/franchise/free-agency',
      severity: 'MEDIUM',
      issue: 'Free Agency page shows players without salary/contract details',
      expected: 'Each free agent should show asking salary and contract length',
      actual: 'No salary amounts visible; no budget tracking shown'
    });
  }

  // ── 11. Waivers ─────────────────────────────────────────────
  notes.push('\n=== PHASE 11: Waivers ===');
  await goto('/franchise/waivers', 2000);
  await ss('17_waivers');
  const waiText = await bodyText();
  notes.push(`Waivers text (500 chars): ${waiText.substring(0, 500)}`);
  notes.push(`Has claim: ${/claim/i.test(waiText)}`);
  notes.push(`Has players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(waiText)}`);
  
  const waiBtns = await allButtonTexts();
  notes.push(`Waivers buttons: ${waiBtns.join(' | ')}`);
  
  if (!waiText.toLowerCase().includes('claim') && !waiText.toLowerCase().includes('waiver')) {
    bugs.push({
      page: '/franchise/waivers',
      severity: 'MEDIUM',
      issue: 'Waiver Wire page has no claim mechanism or is empty',
      expected: 'List of players on waivers with Claim buttons',
      actual: `Page: ${waiText.trim().substring(0, 300)}`
    });
  }

  // ── 12. Injuries ────────────────────────────────────────────
  notes.push('\n=== PHASE 12: Injuries ===');
  await goto('/franchise/injuries', 2000);
  await ss('18_injuries');
  const injText = await bodyText();
  notes.push(`Injuries text (500 chars): ${injText.substring(0, 500)}`);
  notes.push(`Has IL: ${/IL|injured list|DL/i.test(injText)}`);
  notes.push(`Has activate/place: ${/activate|place on/i.test(injText)}`);
  
  const injBtns = await allButtonTexts();
  notes.push(`Injury buttons: ${injBtns.join(' | ')}`);

  // ── 13. Trade Center ────────────────────────────────────────
  notes.push('\n=== PHASE 13: Trade Center ===');
  await goto('/franchise/trade', 2000);
  await ss('19_trade');
  const tradeText = await bodyText();
  notes.push(`Trade text (600 chars): ${tradeText.substring(0, 600)}`);
  notes.push(`Has team picker: ${/select team|pick team|trade partner/i.test(tradeText)}`);
  notes.push(`Has propose: ${/propose|send offer/i.test(tradeText)}`);
  notes.push(`Has player list: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(tradeText)}`);
  
  const tradeBtnsAll = await allButtonTexts();
  notes.push(`Trade buttons: ${tradeBtnsAll.join(' | ')}`);
  
  // Try selecting a team from dropdown
  const teamDropdown = await page.locator('select').first();
  if (await teamDropdown.count() > 0) {
    const options = await page.locator('select option').count();
    notes.push(`Trade team select options: ${options}`);
    if (options > 1) {
      await teamDropdown.selectOption({ index: 1 });
      await page.waitForTimeout(800);
      await ss('19b_trade_team_selected');
      const tradeAfterSelect = await bodyText();
      notes.push(`Trade after team select (400 chars): ${tradeAfterSelect.substring(0, 400)}`);
    }
  }

  // ── 14. Finances ────────────────────────────────────────────
  notes.push('\n=== PHASE 14: Finances ===');
  await goto('/franchise/finances', 2000);
  await ss('20_finances');
  const finText = await bodyText();
  notes.push(`Finances text (700 chars): ${finText.substring(0, 700)}`);
  notes.push(`Has budget: ${/budget/i.test(finText)}`);
  notes.push(`Has payroll: ${/payroll/i.test(finText)}`);
  notes.push(`Has revenue: ${/revenue|income/i.test(finText)}`);
  notes.push(`Has dollar sign: ${/\$[\d,]+/.test(finText)}`);
  
  if (!finText.includes('$') || finText.trim().length < 300) {
    bugs.push({
      page: '/franchise/finances',
      severity: 'HIGH',
      issue: 'Finances page lacks financial data — no dollar amounts or budget details',
      expected: 'Payroll totals, budget sliders, revenue/expenses breakdown',
      actual: `Content: ${finText.trim().substring(0, 400)}`
    });
  }

  // ── 15. Minor Leagues ───────────────────────────────────────
  notes.push('\n=== PHASE 15: Minor Leagues ===');
  await goto('/franchise/minors', 2000);
  await ss('21_minors');
  const minText = await bodyText();
  notes.push(`Minors text (700 chars): ${minText.substring(0, 700)}`);
  notes.push(`Has AAA: ${/AAA/.test(minText)}`);
  notes.push(`Has AA: ${/\bAA\b/.test(minText)}`);
  notes.push(`Has level system: ${/Triple-A|Double-A|Single-A|Class A/i.test(minText)}`);
  notes.push(`Has prospects: ${/prospect|potential|grade/i.test(minText)}`);
  
  if (!(/AAA|AA|Triple-A|Double-A|minor/i.test(minText))) {
    bugs.push({
      page: '/franchise/minors',
      severity: 'HIGH',
      issue: 'Minor League page shows no multi-level farm system',
      expected: 'AAA/AA/A affiliates with prospect lists, stats, grades',
      actual: `Content (${minText.trim().length} chars): ${minText.trim().substring(0, 400)}`
    });
  }
  
  const minBtns = await allButtonTexts();
  notes.push(`Minors buttons: ${minBtns.join(' | ')}`);

  // ── 16. Scouting ────────────────────────────────────────────
  notes.push('\n=== PHASE 16: Scouting ===');
  await goto('/franchise/scouting', 2000);
  await ss('22_scouting');
  const scoutText = await bodyText();
  notes.push(`Scouting text (600 chars): ${scoutText.substring(0, 600)}`);
  notes.push(`Has grades (A-F): ${/\b[A-F][+-]?\s*grade|grade.*[A-F]|\bA\b|\bB\b|\bC\b|\bD\b|\bF\b/i.test(scoutText)}`);
  notes.push(`Has tool grades: ${/speed|power|contact|fielding|arm/i.test(scoutText)}`);
  notes.push(`Has players: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(scoutText)}`);
  
  const scoutBtns = await allButtonTexts();
  notes.push(`Scouting buttons: ${scoutBtns.join(' | ')}`);

  // ── 17. Training ────────────────────────────────────────────
  notes.push('\n=== PHASE 17: Training Center ===');
  await goto('/franchise/training', 2000);
  await ss('23_training');
  const trainText = await bodyText();
  notes.push(`Training text (600 chars): ${trainText.substring(0, 600)}`);
  notes.push(`Has attributes: ${/speed|power|contact|fielding|arm|stamina/i.test(trainText)}`);
  notes.push(`Has intensity: ${/intensity|focus|program/i.test(trainText)}`);
  
  const trainBtns = await allButtonTexts();
  notes.push(`Training buttons: ${trainBtns.join(' | ')}`);
  
  // Try clicking a training button
  const trainActionBtns = await page.locator('button').filter({ hasText: /train|assign|focus|improve/i }).all();
  notes.push(`Training action buttons: ${trainActionBtns.length}`);
  if (trainActionBtns.length > 0) {
    await trainActionBtns[0].click();
    await page.waitForTimeout(500);
    await ss('23b_training_clicked');
    const trainAfterClick = await bodyText();
    notes.push(`Training after click (300 chars): ${trainAfterClick.substring(0, 300)}`);
  }

  // ── 18. Draft ───────────────────────────────────────────────
  notes.push('\n=== PHASE 18: Draft ===');
  await goto('/franchise/draft', 2000);
  await ss('24_draft');
  const draftText = await bodyText();
  notes.push(`Draft text (600 chars): ${draftText.substring(0, 600)}`);
  notes.push(`Has picks: ${/pick|round|draft/i.test(draftText)}`);
  notes.push(`Has prospects: ${/[A-Z][a-z]+ [A-Z][a-z]+/.test(draftText)}`);
  notes.push(`Is offseason-only note: ${/offseason|not available|season in progress/i.test(draftText)}`);

  // ── 19. Career Mode ─────────────────────────────────────────
  notes.push('\n=== PHASE 19: Career Mode ===');
  await goto('/career', 2000);
  await ss('25_career');
  const careerText = await bodyText();
  notes.push(`Career text (600 chars): ${careerText.substring(0, 600)}`);
  notes.push(`Has player: ${/career|player|season/i.test(careerText)}`);
  notes.push(`Is create screen: ${/create|new player|choose/i.test(careerText)}`);
  
  const careerBtns = await allButtonTexts();
  notes.push(`Career buttons: ${careerBtns.join(' | ')}`);

  // ── 20. Payroll ─────────────────────────────────────────────
  notes.push('\n=== PHASE 20: Payroll ===');
  await goto('/franchise/payroll', 2000);
  await ss('26_payroll');
  const payText = await bodyText();
  notes.push(`Payroll text (500 chars): ${payText.substring(0, 500)}`);
  notes.push(`Has salary: ${/salary|\$[\d,]+|\d+M/i.test(payText)}`);
  
  if (payText.trim().length < 300 || !payText.includes('$')) {
    bugs.push({
      page: '/franchise/payroll',
      severity: 'HIGH',
      issue: 'Payroll page shows no salary data',
      expected: 'Player-by-player salary breakdown, total payroll, budget remaining',
      actual: `Content (${payText.trim().length} chars): ${payText.trim().substring(0, 300)}`
    });
  }

  // ── 21. Game Log ────────────────────────────────────────────
  notes.push('\n=== PHASE 21: Game Log ===');
  await goto('/franchise/game-log', 2000);
  await ss('27_game_log');
  const gameLogText = await bodyText();
  notes.push(`Game log text (500 chars): ${gameLogText.substring(0, 500)}`);
  notes.push(`Has game results: ${/\d+-\d+|W\s|L\s/.test(gameLogText)}`);
  notes.push(`Content length: ${gameLogText.trim().length}`);
  
  if (gameLogText.trim().length < 300) {
    bugs.push({
      page: '/franchise/game-log',
      severity: 'MEDIUM',
      issue: 'Game Log appears empty after simming — no past game results shown',
      expected: 'List of completed games with scores, opponents, W/L result',
      actual: `Content (${gameLogText.trim().length} chars): ${gameLogText.trim().substring(0, 200)}`
    });
  }

  // ── 22. Team Stats redirect ──────────────────────────────────
  notes.push('\n=== PHASE 22: Team Stats ===');
  await goto('/franchise/team-stats', 1500);
  const tsUrl = page.url();
  await ss('28_team_stats');
  const tsText = await bodyText();
  notes.push(`Team stats URL after redirect: ${tsUrl}`);
  notes.push(`Team stats content (500 chars): ${tsText.substring(0, 500)}`);
  
  if (tsUrl.includes('unknown')) {
    bugs.push({
      page: '/franchise/team-stats',
      severity: 'HIGH',
      issue: 'Team Stats redirect uses "unknown" as team ID — franchise state not loaded before redirect',
      expected: 'Redirect to /franchise/team-stats/<actual-team-id>',
      actual: `URL: ${tsUrl}`
    });
  }

  // ── 23. Schedule detailed feature check ─────────────────────
  notes.push('\n=== PHASE 23: Schedule Feature Check ===');
  await goto('/franchise/schedule', 2000);
  await ss('29_schedule_full');
  const schedFull = await bodyText();
  notes.push(`Schedule full text (800 chars): ${schedFull.substring(0, 800)}`);
  notes.push(`Has progress bar: ${/progress|games played|season progress/i.test(schedFull)}`);
  notes.push(`Has next game: ${/next game|upcoming|vs\./i.test(schedFull)}`);
  notes.push(`Has sim all: ${/sim all|advance all|end season/i.test(schedFull)}`);
  
  // Look for any clickable game entry
  const gameLinks = await page.locator('a[href*="box-score"], [class*="game"]').count();
  notes.push(`Clickable game links: ${gameLinks}`);

  // ── 24. Franchise History ────────────────────────────────────
  notes.push('\n=== PHASE 24: Franchise History ===');
  await goto('/franchise/history', 1500);
  await ss('30_franchise_history');
  const histText = await bodyText();
  notes.push(`History text (500 chars): ${histText.substring(0, 500)}`);
  notes.push(`History content length: ${histText.trim().length}`);

  // ── 25. Awards ──────────────────────────────────────────────
  notes.push('\n=== PHASE 25: Awards ===');
  await goto('/franchise/awards', 1500);
  await ss('31_awards');
  const awardsText = await bodyText();
  notes.push(`Awards text (500 chars): ${awardsText.substring(0, 500)}`);
  notes.push(`Has award names: ${/MVP|Cy Young|Rookie|Gold Glove|Silver Slugger/i.test(awardsText)}`);

  // ── 26. All-Star ────────────────────────────────────────────
  notes.push('\n=== PHASE 26: All-Star ===');
  await goto('/franchise/all-star', 1500);
  await ss('32_all_star');
  const allStarText = await bodyText();
  notes.push(`All-Star text (500 chars): ${allStarText.substring(0, 500)}`);

  // ── 27. Records ─────────────────────────────────────────────
  notes.push('\n=== PHASE 27: Records ===');
  await goto('/franchise/records', 1500);
  await ss('33_records');
  const recText = await bodyText();
  notes.push(`Records text (500 chars): ${recText.substring(0, 500)}`);

  // ── 28. Trade Proposals ─────────────────────────────────────
  notes.push('\n=== PHASE 28: Trade Proposals ===');
  await goto('/franchise/trade-proposals', 1500);
  await ss('34_trade_proposals');
  const tpText = await bodyText();
  notes.push(`Trade proposals text (500 chars): ${tpText.substring(0, 500)}`);
  notes.push(`Has proposals: ${/proposal|offer|pending/i.test(tpText)}`);

  // ── 29. Development Hub ──────────────────────────────────────
  notes.push('\n=== PHASE 29: Development Hub ===');
  await goto('/franchise/development', 1500);
  await ss('35_development_hub');
  const devText = await bodyText();
  notes.push(`Dev hub text (500 chars): ${devText.substring(0, 500)}`);

  // ── 30. Console Errors Summary ──────────────────────────────
  notes.push('\n=== PHASE 30: Console Errors ===');
  notes.push(`Total console errors: ${consoleErrors.length}`);
  notes.push(`Total page errors: ${pageErrors.length}`);
  consoleErrors.slice(0, 15).forEach((e, i) => {
    notes.push(`  Console Error ${i+1}: ${e.substring(0, 200)}`);
  });
  pageErrors.slice(0, 5).forEach((e, i) => {
    notes.push(`  Page Error ${i+1}: ${e.substring(0, 200)}`);
  });

  // ── FINAL SUMMARY ───────────────────────────────────────────
  notes.push('\n=== FINAL BUG SUMMARY ===');
  notes.push(`Total bugs found: ${bugs.length}`);
  bugs.forEach((b, i) => {
    notes.push(`BUG ${i+1} [${b.severity}] ${b.page}: ${b.issue}`);
    notes.push(`  Expected: ${b.expected}`);
    notes.push(`  Actual: ${b.actual?.substring(0, 200)}`);
  });

  await browser.close();
  writeFileSync('/tmp/cb_audit2_notes.txt', notes.join('\n'));
  writeFileSync('/tmp/cb_audit2_bugs.json', JSON.stringify(bugs, null, 2));
  console.log(notes.join('\n'));
}

main().catch(err => {
  console.error('Audit failed:', err);
  if (browser) browser.close().catch(() => {});
  process.exit(1);
});
