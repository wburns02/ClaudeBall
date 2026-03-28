# Deep E2E Bug Hunt & Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Playwright MCP browser tools to visually inspect every page in Claude Ball, find REAL data/rendering/interaction bugs, fix each one, and verify the fix with screenshots — repeating until the game runs flawlessly.

**Architecture:** Each task targets a specific area of the app. The agent navigates to pages using Playwright MCP tools, takes screenshots, inspects the accessibility tree for data correctness, clicks buttons to test interactions, then reads source code and fixes any bugs found. After fixing, the agent re-navigates to verify the fix visually. This is NOT automated Playwright test scripts — this is hands-on interactive debugging using the browser.

**Tech Stack:** Playwright MCP browser tools (browser_navigate, browser_snapshot, browser_take_screenshot, browser_click, browser_wait_for, browser_resize, browser_console_messages), React 19, TypeScript, Zustand stores

---

## Critical Context

### Dev Server
- Must be running on `http://localhost:5173` before any task
- Start with: `npm run dev` (from `/home/will/ClaudeBall/`)
- Verify with: `curl -s http://localhost:5173 | grep 'Claude Ball'`

### Existing Franchise State
- Team: Austin Thunderhawks, Season 2028 (Year 3), Day 180 of 183
- Record: 99-62 (.615), 1st in American East
- 40-man roster, 3 seasons of accumulated data
- Stats stored in IndexedDB via `claudeball-stats` key (Zustand persist)

### Known Bug Found During Recon
**CRITICAL: League Leaders shows cumulative multi-season stats instead of current-season stats.**
- Ricky Callahan shows 1286 PA in 162 games (impossible for one season — it's 3 seasons accumulated)
- Root cause: `statsStore.getBattingLeaders()` returns from `get().playerStats` which accumulates across all seasons
- Same bug likely affects: Pitching Leaders, WAR Dashboard, Player Career Stats, Awards page, any page using `playerStats` directly
- Fix location: `src/stores/statsStore.ts:367-375` and/or the consuming pages need to filter by current season

### Stats Architecture (important for understanding the bug)
- `statsStore.playerStats` — `Record<playerId, PlayerSeasonStats>` — cumulative across ALL seasons
- `statsStore.currentSeason` — the current season number
- `playerStats[id].gameLog` — array of per-game entries, each with a `season` field
- The store does NOT have a per-season breakdown; it accumulates forever
- Pages that show "this season" stats need to either compute from gameLog or the store needs per-season partitioning

---

## File Structure

| File | Purpose |
|------|---------|
| `src/stores/statsStore.ts` | **MODIFY** — Add current-season stat computation from gameLog |
| `src/pages/LeagueLeadersPage.tsx` | **MODIFY** — Use season-filtered stats |
| `src/pages/WarDashboardPage.tsx` | **MODIFY** — Use season-filtered stats |
| `src/pages/AwardsPage.tsx` | **MODIFY** — Use season-filtered stats |
| `src/pages/HotColdPage.tsx` | **MODIFY** — Verify uses recent data, not cumulative |
| Various pages | **INSPECT & FIX** — Any page showing inflated/wrong stats |

---

### Task 1: Fix the Stats Accumulation Bug (Critical)

The League Leaders, WAR Dashboard, and Awards pages show multi-season cumulative stats as if they're single-season. This is the highest-priority bug.

**Files:**
- Modify: `src/stores/statsStore.ts`
- Modify: `src/pages/LeagueLeadersPage.tsx`

- [ ] **Step 1: Read the statsStore to understand the data model**

Read `src/stores/statsStore.ts` fully. Understand:
- How `playerStats` accumulates (look at `recordGameStats` or similar)
- Whether `gameLog` entries have a `season` field
- Whether there's already a per-season filtering mechanism

- [ ] **Step 2: Read LeagueLeadersPage to understand how it consumes stats**

Read `src/pages/LeagueLeadersPage.tsx`. Check:
- Does it call `getBattingLeaders()` directly?
- Does it pass season filters?
- What stats does it display (PA, H, HR, RBI, AVG, etc.)?

- [ ] **Step 3: Add a current-season stat getter to statsStore**

If `gameLog` entries have season info, add a function like:
```typescript
getCurrentSeasonStats: (playerId: string) => BattingStats
```
that filters `gameLog` to current season only and recomputes batting/pitching stats.

OR if the store already has per-season data, expose it properly.

- [ ] **Step 4: Update LeagueLeadersPage to use current-season stats**

Change the leaders page to use season-filtered stats instead of cumulative.

- [ ] **Step 5: Verify the fix with Playwright MCP**

Navigate to `http://localhost:5173/franchise/leaders`, take a screenshot, verify:
- Top batter PA is ≤ 720 (reasonable for one season: ~4.4 PA/game × 162 games)
- Hit totals are ≤ 220 (MLB record is 262)
- The data looks like a real single-season leaderboard

- [ ] **Step 6: Check WAR Dashboard and Awards for the same bug**

Navigate to `/franchise/war` and `/franchise/awards`. If they show inflated stats, apply the same fix.

- [ ] **Step 7: Commit**

```bash
git add src/stores/statsStore.ts src/pages/LeagueLeadersPage.tsx [other fixed files]
git commit -m "fix: league leaders now shows current-season stats instead of multi-season cumulative"
```

---

### Task 2: Visual Audit — Dashboard & Core Pages

Use Playwright MCP to navigate to each page, take screenshots, and verify data renders correctly.

- [ ] **Step 1: Check Dashboard**

Navigate to `http://localhost:5173/franchise`. Verify:
- Record matches standings (99-62)
- Division standings table populated
- Recent results show game scores
- "Upcoming" shows next game
- No achievement toast blocking content permanently

- [ ] **Step 2: Check Standings**

Navigate to `/franchise/standings`. Verify:
- All 6 divisions populated (5 teams each = 30 total)
- W+L for each team ≈ 161-162 (Day 180 of 183)
- GB calculation is correct (1st place shows "—")
- Magic numbers make sense
- Playoff probabilities add up (division winners ≈ 99%)

- [ ] **Step 3: Check Roster**

Navigate to `/franchise/roster`. Verify:
- 40 players displayed (or correct roster size)
- OVR ratings are 20-99 range (not 0 or NaN)
- Salary column shows dollar amounts (not undefined)
- Action buttons (Trade, AAA, Release, Extend) are present
- Click a player row — verify detail/stats popup works

- [ ] **Step 4: Check Game Log**

Navigate to `/franchise/game-log`. Verify:
- Games listed with scores
- Win/Loss indicators correct
- Box score links work (click one)

- [ ] **Step 5: Fix any bugs found, re-verify with screenshots**

- [ ] **Step 6: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve dashboard and core page rendering issues"
```

---

### Task 3: Visual Audit — Stats & Analytics Pages

- [ ] **Step 1: Check Team Analytics**

Navigate to `/franchise/team-analytics`. Verify:
- Charts render (not empty divs)
- Stats are populated (not all zeros)
- Tabs switch correctly

- [ ] **Step 2: Check WAR Dashboard**

Navigate to `/franchise/war`. Verify WAR values are reasonable (0-10 range for position players).

- [ ] **Step 3: Check Hot & Cold**

Navigate to `/franchise/hot-cold`. Verify:
- Players listed with recent performance
- Hot/cold indicators show variation (not all identical)

- [ ] **Step 4: Check Projections**

Navigate to `/franchise/projections`. Verify projected stats are reasonable.

- [ ] **Step 5: Check Power Rankings**

Navigate to `/franchise/power-rankings`. Verify all 30 teams ranked.

- [ ] **Step 6: Fix any bugs found, re-verify**

- [ ] **Step 7: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve stats and analytics page issues"
```

---

### Task 4: Visual Audit — GM & Trade Pages

- [ ] **Step 1: Check Trade page**

Navigate to `/franchise/trade`. Verify:
- Player list loads
- Can select a player to trade
- Trade interface shows value/rating

- [ ] **Step 2: Check Trade Machine**

Navigate to `/franchise/trade-machine`. Verify:
- Team dropdowns populated
- Can add players to each side
- Trade value calculation shows numbers (not NaN)

- [ ] **Step 3: Check Free Agency**

Navigate to `/franchise/free-agency`. Verify:
- Free agents listed (if in-season, may show "available after season")
- Player ratings visible

- [ ] **Step 4: Check Finances & Payroll**

Navigate to `/franchise/finances` and `/franchise/payroll`. Verify:
- Salary numbers displayed (not $0 or $NaN)
- Budget breakdown visible
- Payroll table shows all contracted players

- [ ] **Step 5: Check Scouting**

Navigate to `/franchise/scouting`. Verify scouting reports render.

- [ ] **Step 6: Fix any bugs found, re-verify**

- [ ] **Step 7: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve GM and trade page issues"
```

---

### Task 5: Visual Audit — Season & History Pages

- [ ] **Step 1: Check Season Story**

Navigate to `/franchise/season-story`. Verify narrative text exists (not empty).

- [ ] **Step 2: Check Season Timeline**

Navigate to `/franchise/timeline`. Verify events listed chronologically.

- [ ] **Step 3: Check Highlights**

Navigate to `/franchise/highlights`. Verify highlight entries exist.

- [ ] **Step 4: Check Franchise History**

Navigate to `/franchise/history`. Verify past seasons listed.

- [ ] **Step 5: Check Hall of Records**

Navigate to `/franchise/hall-of-records`. Verify records populated.

- [ ] **Step 6: Check Awards**

Navigate to `/franchise/awards`. Verify award candidates listed with stats.

- [ ] **Step 7: Fix any bugs found, re-verify**

- [ ] **Step 8: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve season and history page issues"
```

---

### Task 6: Mobile Responsiveness Audit

- [ ] **Step 1: Resize to mobile (375px width)**

Use `browser_resize` to set viewport to 375×812.

- [ ] **Step 2: Check Dashboard at mobile**

Navigate to `/franchise`. Verify:
- Content doesn't overflow horizontally
- Text is readable
- Buttons are tappable (not too small)
- Sidebar collapses or becomes hamburger menu

- [ ] **Step 3: Check Roster at mobile**

Navigate to `/franchise/roster`. Verify table is scrollable or responsive.

- [ ] **Step 4: Check Standings at mobile**

Navigate to `/franchise/standings`. Verify table doesn't break layout.

- [ ] **Step 5: Check 3 more key pages at mobile**

Leaders, Game Log, Trade Machine.

- [ ] **Step 6: Resize back to desktop (1280×800)**

- [ ] **Step 7: Fix any mobile-specific bugs, re-verify**

- [ ] **Step 8: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve mobile responsiveness issues"
```

---

### Task 7: Dynasty Mode Pages Audit

- [ ] **Step 1: Check Dynasty Inbox**

Navigate to `/dynasty/inbox`. Verify messages/notifications render.

- [ ] **Step 2: Check Conversations**

Navigate to `/dynasty/conversation`. Verify conversation UI renders.

- [ ] **Step 3: Check Life Events**

Navigate to `/dynasty/life-events`. Verify events display.

- [ ] **Step 4: Check Career Transition**

Navigate to `/dynasty/career-transition`. Verify transition options show.

- [ ] **Step 5: Check Legacy & Prestige**

Navigate to `/dynasty/prestige`. Verify prestige score and tiers display.

- [ ] **Step 6: Check Owner's Suite**

Navigate to `/dynasty/owner`. Verify org chart, financials, hat system render.

- [ ] **Step 7: Fix any bugs found, re-verify**

- [ ] **Step 8: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve dynasty page rendering issues"
```

---

### Task 8: Game Flow Test — Sim, Playoffs, Offseason

Test the complete game loop: finish the season, go through playoffs, enter offseason.

- [ ] **Step 1: Finish the current season**

Navigate to `/franchise`. Click "Finish Season" (or "Sim 30 Days" repeatedly). Dismiss all overlays using DOM clicks.

- [ ] **Step 2: Enter Playoffs**

Verify "Go to Playoffs" button appears. Click it. Verify playoff bracket renders.

- [ ] **Step 3: Sim through each playoff round**

Click through Wild Card → Division → Championship → World Series. Verify:
- Each round loads
- Matchups display correctly
- Results populate after sim

- [ ] **Step 4: Enter Offseason**

After playoffs end, verify offseason interface loads. Check:
- Free agency available
- Draft available
- Offseason hub renders

- [ ] **Step 5: Fix any bugs found during the flow**

- [ ] **Step 6: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve game flow issues (playoffs, offseason transitions)"
```

---

### Task 9: Console Error Sweep

- [ ] **Step 1: Navigate to 10 key pages and check console**

After each navigation, use `browser_console_messages` to check for errors. Pages:
`/franchise`, `/franchise/roster`, `/franchise/standings`, `/franchise/leaders`,
`/franchise/trade`, `/franchise/war`, `/franchise/awards`, `/franchise/schedule`,
`/dynasty/inbox`, `/dynasty/prestige`

- [ ] **Step 2: Categorize errors**

- React warnings (minor — log but don't fix unless causing visual issues)
- Uncaught exceptions (critical — fix immediately)
- Failed network requests (major — investigate)
- Deprecation warnings (cosmetic — ignore)

- [ ] **Step 3: Fix all critical/major console errors**

- [ ] **Step 4: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve console errors across key pages"
```

---

### Task 10: Final Verification Pass & Push

- [ ] **Step 1: Run unit tests**

```bash
npm test
```
Expected: All 308+ tests pass.

- [ ] **Step 2: Run TypeScript build check**

```bash
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```
Expected: Clean build.

- [ ] **Step 4: Quick visual re-check of 5 key pages**

Navigate to: Dashboard, Roster, Leaders, Standings, Dynasty Prestige. Take screenshots. Verify no regressions.

- [ ] **Step 5: Push to GitHub**

```bash
git push origin main
```

---

## Execution Notes

**Each task should use Playwright MCP browser tools** (browser_navigate, browser_snapshot, browser_take_screenshot, browser_click, browser_wait_for, browser_resize, browser_console_messages) to interact with the running app. This is NOT writing Playwright test scripts — it's live interactive inspection.

**When you find a bug:**
1. Document it (page, what's wrong, screenshot)
2. Read the relevant source file
3. Fix the root cause
4. Re-navigate and verify the fix visually
5. Take an "after" screenshot

**Task 1 (stats accumulation bug) is the highest priority** — it affects multiple pages and is a data correctness issue, not just cosmetic.

**The dev server must be running** for ALL tasks. If it's not on port 5173, start it with `npm run dev` from `/home/will/ClaudeBall/`.
