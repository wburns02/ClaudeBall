/**
 * Playwright test for ClaudeBall Lineup Editor
 * Tests all 9 features specified in the task
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5179';
const SCREENSHOT_DIR = '/tmp/lineup-test-screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

let screenshotIndex = 0;
async function shot(page, name) {
  const path = join(SCREENSHOT_DIR, `${String(screenshotIndex++).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  [screenshot] ${path}`);
  return path;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const results = {};

  try {
    // ─── SETUP: load app root, wait for React to mount ─────────────────
    console.log('\n=== SETUP: Loading app ===');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Wait for the loading spinner to disappear (app uses lazy loading)
    await page.waitForSelector('h1, button:has-text("New Franchise"), button:has-text("Exhibition Game")', { timeout: 15000 });
    await page.waitForTimeout(500);
    console.log('  App loaded. URL:', page.url());
    await shot(page, 'app-loaded');

    // ─── Navigate to /franchise/new ─────────────────────────────────────
    console.log('\n=== SETUP: Navigating to /franchise/new ===');
    await page.goto(`${BASE_URL}/franchise/new`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Wait for the franchise selection page to render
    await page.waitForSelector('text=New Franchise', { timeout: 10000 });
    await page.waitForTimeout(500);
    console.log('  On /franchise/new. URL:', page.url());
    await shot(page, 'franchise-new-page');

    // Find team buttons — they are inside division Panels and show "City Name"
    // The page structure has league/division headers followed by team buttons
    // Team buttons contain city + name text inside a <p class="text-sm font-medium...">
    const teamNameLocator = page.locator('p.text-sm.font-medium');
    const teamNameCount = await teamNameLocator.count();
    console.log(`  Team name <p> elements found: ${teamNameCount}`);

    if (teamNameCount === 0) {
      // Fallback: look for any buttons in division panels
      const allBtns = await page.locator('button').allTextContents();
      console.log('  All buttons:', allBtns.slice(0, 15));
      throw new Error('No team name elements found — page may not have loaded correctly');
    }

    // Click the first team's parent button
    const firstTeamBtn = page.locator('button:has(p.text-sm.font-medium)').first();
    const firstTeamName = await firstTeamBtn.locator('p.text-sm.font-medium').textContent();
    console.log(`  Selecting team: ${firstTeamName?.trim()}`);
    await firstTeamBtn.click();
    await page.waitForTimeout(400);
    await shot(page, 'team-selected');

    // Verify checkmark appeared
    const checkmark = await page.locator('span.text-gold.text-xs.font-bold:has-text("✓")').first().isVisible().catch(() => false);
    console.log(`  Checkmark visible: ${checkmark}`);

    // Click "Start Season"
    const startBtn = page.locator('button:has-text("Start Season")');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    const startBtnEnabled = await startBtn.isEnabled();
    console.log(`  Start Season button enabled: ${startBtnEnabled}`);
    await startBtn.click();

    // Wait for navigation to /franchise dashboard
    await page.waitForURL(`${BASE_URL}/franchise`, { timeout: 15000 });
    await page.waitForSelector('text=Dashboard, text=Roster, text=Standings', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    console.log('  Franchise started. URL:', page.url());
    await shot(page, 'franchise-dashboard');

    // ─── Navigate to Lineup Editor ─────────────────────────────────────
    console.log('\n=== Navigating to Lineup Editor ===');
    await page.goto(`${BASE_URL}/franchise/lineup-editor`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    // Wait for the page to show either the lineup editor or the "Back to Menu" fallback
    await page.waitForSelector('h1, button:has-text("Back to Menu"), button:has-text("Auto-Fill")', { timeout: 8000 }).catch(() => {});
    await shot(page, 'lineup-editor-loaded');

    const pageText = await page.textContent('body');
    console.log('  Page body snippet:', pageText.replace(/\s+/g,' ').slice(0, 300));

    // ─── TEST 1: Page loads ─────────────────────────────────────────────
    console.log('\n=== TEST 1: Page loads ===');
    const hasBattingOrderTab = await page.locator('button').filter({ hasText: /Batting Order/ }).first().isVisible().catch(() => false);
    const hasPitchingStaffTab = await page.locator('button').filter({ hasText: /Pitching Staff/ }).first().isVisible().catch(() => false);
    const hasLineupEditorH1 = await page.locator('h1').filter({ hasText: /Lineup Editor/i }).first().isVisible().catch(() => false);
    const slots = page.locator('[role="button"]');
    const slotCount = await slots.count();

    console.log(`  hasBattingOrderTab=${hasBattingOrderTab}, hasPitchingStaffTab=${hasPitchingStaffTab}, hasH1=${hasLineupEditorH1}, slots=${slotCount}`);

    results['1_page_loads'] = {
      pass: hasBattingOrderTab && hasPitchingStaffTab && slotCount >= 9,
      note: `battingTab=${hasBattingOrderTab}, pitchingTab=${hasPitchingStaffTab}, h1=${hasLineupEditorH1}, slots=${slotCount}`
    };
    console.log('  Result:', results['1_page_loads']);

    // ─── TEST 2: Auto-Fill AI (batting) ────────────────────────────────
    console.log('\n=== TEST 2: Auto-Fill AI (batting) ===');
    const autoFillBtn = page.locator('button:has-text("Auto-Fill (AI)")').first();
    const autoFillVisible = await autoFillBtn.isVisible().catch(() => false);
    console.log('  Auto-Fill button visible:', autoFillVisible);

    if (autoFillVisible) {
      // Capture slot texts BEFORE
      const slotsBefore = await slots.allTextContents();
      const emptyBefore = slotsBefore.filter(t => /empty/i.test(t)).length;
      console.log(`  Empty slots before: ${emptyBefore}`);

      await autoFillBtn.click();
      await page.waitForTimeout(1800);
      await shot(page, 'after-autofill-batting');

      const slotsAfter = await slots.allTextContents();
      const emptyAfter = slotsAfter.filter(t => /empty/i.test(t)).length;
      // Count slots that contain at least one name-like string (not "Empty", not just numbers)
      const filledAfter = slotsAfter.filter(t =>
        t.length > 20 && !/^[\s\d]+$/.test(t) && !/empty/i.test(t) && !/drop/i.test(t)
      ).length;
      console.log(`  Filled slots after: ${filledAfter}, empty after: ${emptyAfter}`);
      console.log('  Slot 0 sample:', slotsAfter[0]?.replace(/\s+/g,' ').trim().slice(0, 100));

      results['2_autofill_ai'] = {
        pass: filledAfter >= 9 || emptyAfter === 0,
        note: `filledAfter=${filledAfter}, emptyAfter=${emptyAfter}`
      };
    } else {
      results['2_autofill_ai'] = { pass: false, note: 'Auto-Fill button not visible' };
    }
    console.log('  Result:', results['2_autofill_ai']);

    // ─── TEST 3: Stats strips ───────────────────────────────────────────
    console.log('\n=== TEST 3: Stats strips ===');
    const html = await page.content();
    const hasCON = html.includes('CON ');
    const hasPWR = html.includes('PWR ');
    const hasEYE = html.includes('EYE ');
    const hasBA  = /BA\s+\.\d{3}/.test(html) || html.includes('BA ');
    const hasHR  = html.includes('HR ');
    const hasRBI = html.includes('RBI ');
    console.log(`  CON=${hasCON} PWR=${hasPWR} EYE=${hasEYE} | BA=${hasBA} HR=${hasHR} RBI=${hasRBI}`);

    results['3_stats_strips'] = {
      pass: (hasCON && hasPWR) || (hasBA && hasHR),
      note: `CON=${hasCON} PWR=${hasPWR} EYE=${hasEYE} | BA=${hasBA} HR=${hasHR} RBI=${hasRBI}`
    };
    console.log('  Result:', results['3_stats_strips']);

    // ─── TEST 4: Form dots ──────────────────────────────────────────────
    console.log('\n=== TEST 4: Form dots ===');
    // FormDot renders as: <span class="inline-block w-2 h-2 rounded-full shrink-0 ..." title="Form: neutral">
    const formDotsByTitle = await page.locator('span[title^="Form:"]').count();
    const formDotsByClass = await page.locator('span.rounded-full.shrink-0').count();
    const hasFormInHtml = html.includes('Form: ') || html.includes('title="Form:');
    console.log(`  By title^="Form:": ${formDotsByTitle}, by class rounded-full shrink-0: ${formDotsByClass}, inHtml=${hasFormInHtml}`);

    results['4_form_dots'] = {
      pass: formDotsByTitle > 0 || formDotsByClass > 0 || hasFormInHtml,
      note: `byTitle=${formDotsByTitle}, byClass=${formDotsByClass}, inHtml=${hasFormInHtml}`
    };
    console.log('  Result:', results['4_form_dots']);

    // ─── TEST 5: Click-to-swap ──────────────────────────────────────────
    console.log('\n=== TEST 5: Click-to-swap ===');
    const allSlots = page.locator('[role="button"]');
    const slotTotal = await allSlots.count();
    console.log(`  role=button count: ${slotTotal}`);

    if (slotTotal >= 3) {
      const before0 = await allSlots.nth(0).textContent();
      const before2 = await allSlots.nth(2).textContent();
      console.log('  Slot 0 before:', before0?.replace(/\s+/g,' ').trim().slice(0, 60));
      console.log('  Slot 2 before:', before2?.replace(/\s+/g,' ').trim().slice(0, 60));

      // Click slot 0 (1st batting spot) to select
      await allSlots.nth(0).click();
      await page.waitForTimeout(400);
      await shot(page, 'slot0-selected');

      const selectedIndicator = await page.locator('text=← selected').count();
      console.log(`  "← selected" indicators after click: ${selectedIndicator}`);

      // Click slot 2 (3rd batting spot) to swap
      await allSlots.nth(2).click();
      await page.waitForTimeout(500);
      await shot(page, 'after-swap');

      const after0 = await allSlots.nth(0).textContent();
      const after2 = await allSlots.nth(2).textContent();
      console.log('  Slot 0 after:', after0?.replace(/\s+/g,' ').trim().slice(0, 60));
      console.log('  Slot 2 after:', after2?.replace(/\s+/g,' ').trim().slice(0, 60));

      const swapped = after0 !== before0 && after2 !== before2;
      results['5_click_to_swap'] = {
        pass: swapped,
        note: `selectedIndicator=${selectedIndicator}, swapped=${swapped}`
      };
    } else {
      results['5_click_to_swap'] = { pass: false, note: `Only ${slotTotal} role=button slots` };
    }
    console.log('  Result:', results['5_click_to_swap']);

    // ─── TEST 6: Drag hint tooltip ──────────────────────────────────────
    console.log('\n=== TEST 6: Drag hint tooltip ===');
    const draggables = page.locator('[draggable="true"]');
    const draggableCount = await draggables.count();
    console.log(`  [draggable=true] count: ${draggableCount}`);

    if (draggableCount > 0) {
      const el = draggables.first();
      const box = await el.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        // Simulate HTML5 drag: dispatchEvent dragstart
        await page.evaluate(([x, y]) => {
          const el = document.elementFromPoint(x, y);
          if (el) {
            const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true });
            el.dispatchEvent(ev);
          }
        }, [cx, cy]);
        await page.waitForTimeout(300);
        await shot(page, 'drag-tooltip');

        const tooltipHtml = await page.content();
        const tooltipVisible = tooltipHtml.includes('Drop on a slot to place');
        console.log(`  "Drop on a slot to place" in HTML: ${tooltipVisible}`);

        const tooltipLocator = page.locator('text=Drop on a slot to place');
        const tooltipLocatorVisible = await tooltipLocator.first().isVisible().catch(() => false);
        console.log(`  Tooltip locator visible: ${tooltipLocatorVisible}`);

        results['6_drag_hint'] = {
          pass: tooltipVisible || tooltipLocatorVisible,
          note: `inHtml=${tooltipVisible}, locatorVisible=${tooltipLocatorVisible}`
        };

        // Release drag
        await page.evaluate(([x, y]) => {
          const el = document.elementFromPoint(x, y);
          if (el) {
            const ev = new DragEvent('dragend', { bubbles: true, cancelable: true });
            el.dispatchEvent(ev);
          }
        }, [cx, cy]);
      } else {
        results['6_drag_hint'] = { pass: false, note: 'No bounding box' };
      }
    } else {
      results['6_drag_hint'] = { pass: false, note: 'No draggable elements on batting tab' };
    }
    console.log('  Result:', results['6_drag_hint']);

    // ─── TEST 7: Pitching tab ───────────────────────────────────────────
    console.log('\n=== TEST 7: Pitching tab ===');
    const pitchTab = page.locator('button').filter({ hasText: /Pitching Staff/ }).first();
    const pitchTabVis = await pitchTab.isVisible().catch(() => false);
    console.log(`  Pitching Staff tab visible: ${pitchTabVis}`);

    if (pitchTabVis) {
      await pitchTab.click();
      await page.waitForTimeout(500);
      await shot(page, 'pitching-tab');

      // Auto-fill rotation
      const pitchAutoFill = page.locator('button:has-text("Auto-Fill (AI)")').first();
      if (await pitchAutoFill.isVisible().catch(() => false)) {
        await pitchAutoFill.click();
        await page.waitForTimeout(1500);
        await shot(page, 'pitching-autofill-done');
      }

      const pitchHtml = await page.content();
      const sp1Visible = await page.locator('text=SP1').first().isVisible().catch(() => false);
      const sp5Visible = await page.locator('text=SP5').first().isVisible().catch(() => false);
      const aceVisible = await page.locator('text=ACE').first().isVisible().catch(() => false);
      const hasSpLabels = pitchHtml.includes('SP1') && pitchHtml.includes('SP5');

      console.log(`  SP1=${sp1Visible}, SP5=${sp5Visible}, ACE=${aceVisible}, hasSpLabels=${hasSpLabels}`);

      // Count how many rotation slots have pitchers
      const rotSlots = page.locator('[role="button"]');
      const rotSlotTexts = await rotSlots.allTextContents();
      const filledPitcherSlots = rotSlotTexts.filter(t => t.length > 20 && !/empty/i.test(t)).length;
      console.log(`  Filled pitcher slots: ${filledPitcherSlots}`);
      console.log('  Slot 0 sample:', rotSlotTexts[0]?.replace(/\s+/g,' ').trim().slice(0, 80));

      results['7_pitching_tab'] = {
        pass: sp1Visible && sp5Visible,
        note: `SP1=${sp1Visible}, SP5=${sp5Visible}, ACE=${aceVisible}, filledSlots=${filledPitcherSlots}`
      };
    } else {
      results['7_pitching_tab'] = { pass: false, note: 'Pitching Staff tab not visible' };
    }
    console.log('  Result:', results['7_pitching_tab']);

    // ─── TEST 8: Form dots on pitchers ─────────────────────────────────
    console.log('\n=== TEST 8: Form dots on pitchers ===');
    const pitcherDotsByTitle = await page.locator('span[title^="Form:"]').count();
    const pitcherDotsByClass = await page.locator('span.rounded-full.shrink-0').count();
    const pitchHtml2 = await page.content();
    const pitchHasForm = pitchHtml2.includes('Form: ');
    console.log(`  byTitle=${pitcherDotsByTitle}, byClass=${pitcherDotsByClass}, hasForm=${pitchHasForm}`);
    await shot(page, 'pitching-final');

    results['8_pitcher_form_dots'] = {
      pass: pitcherDotsByTitle > 0 || pitcherDotsByClass > 0 || pitchHasForm,
      note: `byTitle=${pitcherDotsByTitle}, byClass=${pitcherDotsByClass}, hasForm=${pitchHasForm}`
    };
    console.log('  Result:', results['8_pitcher_form_dots']);

    // ─── TEST 9: Console errors ─────────────────────────────────────────
    console.log('\n=== TEST 9: Console errors ===');
    console.log('  Errors:', consoleErrors);
    results['9_console_errors'] = {
      pass: consoleErrors.length === 0,
      note: consoleErrors.length === 0
        ? 'No console errors'
        : `${consoleErrors.length} error(s): ${consoleErrors.slice(0,3).join('; ')}`
    };
    console.log('  Result:', results['9_console_errors']);

  } catch (err) {
    console.error('\nTest threw exception:', err.message);
    await shot(page, 'exception-state').catch(() => {});
  } finally {
    await browser.close();
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log('\n\n========= RESULTS SUMMARY =========');
  let passed = 0, failed = 0;
  for (const [test, result] of Object.entries(results)) {
    const status = result.pass ? 'PASS' : 'FAIL';
    if (result.pass) passed++; else failed++;
    console.log(`  ${status}  ${test}: ${result.note}`);
  }
  console.log(`\n  Total: ${passed} PASS, ${failed} FAIL`);
  console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
  writeFileSync('/tmp/lineup-test-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
