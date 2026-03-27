# Owner Mode + Scandal System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Owner Mode (buy/run a team with 3 ownership styles and multi-hat system) and the Scandal/Drama System (Wildcard trait, 4 scandal tiers, nuclear chain, cover-ups).

**Architecture:** Extend existing ECS components (Personality gets Wildcard, new OwnershipComponent) and systems (ScandalSystem, extend CareerProgression/LifeEvent/Reputation/Prestige). New Owner Dashboard UI page. Scandal chain uses existing life event + conversation infrastructure.

**Tech Stack:** TypeScript 5.9, Vitest, React 19, existing ECS + EventBus

**Spec:** `docs/superpowers/specs/2026-03-27-owner-mode-design.md`

---

## File Structure

```
src/dynasty/
  components/
    Ownership.ts              — NEW: team owned, style, hats, franchise value
  systems/
    ScandalSystem.ts          — NEW: Wildcard checks, scandal generation, consequences
    ScandalSystem.test.ts     — NEW: tests for all 4 tiers + chain
  tests/
    owner-mode.test.ts        — NEW: ownership acquisition, styles, multi-hat, team sales

src/pages/dynasty/
  DynastyOwnerPage.tsx        — NEW: org chart, financials, hat selector, scandal monitor

Modify:
  src/dynasty/components/Personality.ts     — add wildcard trait
  src/dynasty/systems/CareerProgressionSystem.ts — ownership acquisition + team-for-sale logic
  src/dynasty/systems/LifeEventSystem.ts    — scandal chain events
  src/dynasty/systems/PrestigeEngine.ts     — ownership achievements, scandal impact
  src/dynasty/bridge/DynastyBridge.ts       — register ScandalSystem
  src/dynasty/ecs/types.ts                  — new event types
  src/App.tsx                               — owner route
  src/components/layout/FranchiseSidebar.tsx — owner link
```

---

### Task 1: Add Wildcard trait + OwnershipComponent

**Files:**
- Modify: `src/dynasty/components/Personality.ts`
- Create: `src/dynasty/components/Ownership.ts`

- [ ] **Step 1: Add wildcard to PersonalityComponent**

In `src/dynasty/components/Personality.ts`, add `wildcard` field:

```typescript
export interface PersonalityComponent extends Component {
  type: 'Personality';
  // ... existing 10 traits ...
  wildcard: number;  // 20-80, hidden until first incident
}
```

Update `personalityFromMental` and `randomPersonality` to generate wildcard:
```typescript
// In personalityFromMental:
wildcard: Math.max(20, Math.min(80, Math.round(100 - ratingTo2080(mental.composure) + (randomTrait(rng) - 50) * 0.3))),

// In randomPersonality:
wildcard: randomTrait(rng),
```

- [ ] **Step 2: Create OwnershipComponent**

Create `src/dynasty/components/Ownership.ts`:

```typescript
import type { Component, EntityId } from '../ecs/types.ts';

export type OwnershipStyle = 'hands_off' | 'active' | 'maniac';
export type OwnerHat = 'owner' | 'gm' | 'manager';

export interface StaffMember {
  entityId: EntityId;
  name: string;
  role: 'gm' | 'manager' | 'coach_hitting' | 'coach_pitching' | 'coach_bench' | 'scout';
  competence: number;  // 1-100
  salary: number;      // thousands
  personality: string;  // archetype tag
}

export interface OwnershipComponent extends Component {
  type: 'Ownership';
  teamId: string;
  purchasePrice: number;     // thousands
  franchiseValue: number;    // thousands (fluctuates)
  style: OwnershipStyle;
  hats: OwnerHat[];          // which roles owner is personally filling
  staff: StaffMember[];
  revenue: {
    tickets: number;
    tv: number;
    merch: number;
    naming: number;
    postseason: number;
  };
  expenses: {
    payroll: number;
    staffSalaries: number;
    facilities: number;
    scouting: number;
    marketing: number;
  };
  yearsOwned: number;
  scandalBudget: number;     // annual investment in "culture" to reduce wildcard
}

export function createOwnership(teamId: string, price: number): OwnershipComponent {
  return {
    type: 'Ownership',
    teamId,
    purchasePrice: price,
    franchiseValue: price,
    style: 'active',
    hats: ['owner'],
    staff: [],
    revenue: { tickets: 80000, tv: 100000, merch: 30000, naming: 10000, postseason: 0 },
    expenses: { payroll: 0, staffSalaries: 8000, facilities: 5000, scouting: 3000, marketing: 2000 },
    yearsOwned: 0,
    scandalBudget: 0,
  };
}

export function getHatSavings(hats: OwnerHat[]): number {
  let savings = 0;
  if (hats.includes('gm')) savings += 4000;     // $4M
  if (hats.includes('manager')) savings += 2000; // $2M
  return savings;
}

export function getHatRepPenalty(hats: OwnerHat[]): { media: number; fan: number } {
  if (hats.includes('manager') && hats.includes('gm')) {
    return { media: -30, fan: -25 };
  }
  if (hats.includes('gm')) {
    return { media: -15, fan: -10 };
  }
  return { media: 0, fan: 0 };
}
```

- [ ] **Step 3: Commit and push**

```bash
git add src/dynasty/components/Personality.ts src/dynasty/components/Ownership.ts
git commit -m "feat(dynasty): add Wildcard trait + OwnershipComponent"
git push
```

---

### Task 2: ScandalSystem

**Files:**
- Create: `src/dynasty/systems/ScandalSystem.ts`
- Create: `src/dynasty/systems/ScandalSystem.test.ts`
- Modify: `src/dynasty/ecs/types.ts` — add ScandalOccurred event

- [ ] **Step 1: Add new event types**

In `src/dynasty/ecs/types.ts`, add:

```typescript
export interface ScandalOccurredEvent extends DynastyEvent {
  type: 'ScandalOccurred';
  data: { entityId: EntityId; tier: 'minor' | 'moderate' | 'severe' | 'nuclear'; scandalType: string; description: string; suspension: number };
}

export interface TeamForSaleEvent extends DynastyEvent {
  type: 'TeamForSale';
  data: { teamId: string; reason: string; askingPrice: number };
}

export interface TeamPurchasedEvent extends DynastyEvent {
  type: 'TeamPurchased';
  data: { buyerId: EntityId; teamId: string; price: number };
}
```

Add to DynastyEventMap.

- [ ] **Step 2: Write ScandalSystem tests**

Create `src/dynasty/systems/ScandalSystem.test.ts` with tests for:
- No scandal when Wildcard < 50
- Minor scandal when Wildcard 50-60
- Moderate scandal when Wildcard 60-70
- Severe scandal when Wildcard 70-80
- Nuclear scandal ONLY via chain (never random)
- Wildcard reduction from scandalBudget investment
- Cover-up option only available when Integrity < 40

- [ ] **Step 3: Implement ScandalSystem**

Create `src/dynasty/systems/ScandalSystem.ts`:

Core logic:
- `checkForScandals()`: iterate entities with Wildcard > 50, roll for incidents
- `generateScandal(entityId, tier)`: create scandal event with type, description, suspension
- `resolveScandal(entityId, action)`: apply consequences based on owner/GM response
- `advanceNuclearChain(entityId, choice)`: progress through 5-step chain
- `investInCulture(teamEntityIds, budget)`: reduce Wildcard across roster

- [ ] **Step 4: Run tests, commit, push**

---

### Task 3: Extend CareerProgressionSystem for Ownership

**Files:**
- Modify: `src/dynasty/systems/CareerProgressionSystem.ts`
- Create: `src/dynasty/tests/owner-mode.test.ts`

- [ ] **Step 1: Add team-for-sale generation**

Add method `checkForTeamSales()` that runs each offseason:
- Check NPC owner patience, finances, age
- Roll for story events (health, family dispute)
- Guarantee one sale per 5 seasons
- Emit `TeamForSale` event

- [ ] **Step 2: Add ownership acquisition**

Modify `generatePostRetirementOpportunities()`:
- Check if any team is for sale
- Check if entity net worth ≥ $500M
- Generate "owner" opportunity with specific team + price

- [ ] **Step 3: Write owner-mode tests**

Test:
- No owner opportunity when no team for sale
- No owner opportunity when net worth < $500M
- Owner opportunity appears when both conditions met
- Team-for-sale triggers after 3 losing seasons
- Guaranteed sale within 5 seasons

- [ ] **Step 4: Run tests, commit, push**

---

### Task 4: Extend LifeEventSystem with Scandal Chain

**Files:**
- Modify: `src/dynasty/systems/LifeEventSystem.ts`

- [ ] **Step 1: Add nuclear chain events**

Add 5 chain-step life events that only trigger for low-integrity + high-wildcard entities:

```typescript
// Step 1: The Invitation (Integrity < 35 AND Wildcard > 65)
// Step 2: The Introduction
// Step 3: The Offer (agent warns you)
// Step 4: The Trip (no phones)
// Step 5: Point of No Return (automatic — story breaks)
```

Each step: choosing "yes" advances the chain, "no" breaks it and boosts Integrity.

- [ ] **Step 2: Add cover-up option**

For moderate scandals, if player Integrity < 40:
- New life event: "Cover it up?"
- 60% success (scandal disappears), 40% leak (double punishment)

- [ ] **Step 3: Commit, push**

---

### Task 5: Extend PrestigeEngine + ReputationSystem

**Files:**
- Modify: `src/dynasty/systems/PrestigeEngine.ts`
- Modify: `src/dynasty/systems/ReputationSystem.ts`

- [ ] **Step 1: Add ownership to prestige scoring**

In PrestigeEngine:
- Owner role = 20 pts in career score (highest)
- World Series as owner-manager = +50 prestige
- Nuclear scandal = prestige → 0, milestones stripped
- "The Madman" milestone for WS as owner-manager

- [ ] **Step 2: Add multi-hat rep penalties to ReputationSystem**

Handle `HatChanged` events:
- Apply media/fan penalties based on hat configuration
- Winning streak recovery logic

- [ ] **Step 3: Commit, push**

---

### Task 6: Wire ScandalSystem into DynastyBridge

**Files:**
- Modify: `src/dynasty/bridge/DynastyBridge.ts`

- [ ] **Step 1: Register ScandalSystem**

Import and instantiate ScandalSystem, add to runner.

- [ ] **Step 2: Commit, push**

---

### Task 7: Owner Dashboard UI

**Files:**
- Create: `src/pages/dynasty/DynastyOwnerPage.tsx`
- Modify: `src/App.tsx` — add route
- Modify: `src/components/layout/FranchiseSidebar.tsx` — add link

- [ ] **Step 1: Build DynastyOwnerPage**

Sections:
- **Org Chart**: visual hierarchy, hire/fire buttons, "I'll Do It Myself" button
- **Financials**: revenue/expenses table, P&L, franchise value
- **Hat Selector**: toggle Owner/+GM/+Manager with live penalty display
- **Scandal Monitor**: list of high-Wildcard players, active incidents, "Invest in Culture" button
- **League Landscape**: franchise values, teams for sale

- [ ] **Step 2: Add route + sidebar link**

Route: `/dynasty/owner`
Sidebar: "Owner's Suite" in DYNASTY section

- [ ] **Step 3: Commit, push, deploy**

```bash
git push && railway up
```

---

### Task 8: Integration Test — Full Owner + Scandal Lifecycle

**Files:**
- Add to: `src/dynasty/tests/dynasty-stress.test.ts`

New scenarios:
- **Scenario 11: The Owner-Manager** — Buy team, wear all hats, verify rep penalty, win WS, verify "Madman" achievement
- **Scenario 12: The Nuclear Scandal** — Create low-integrity entity, walk through all 5 chain steps, verify lifetime ban + prestige reset
- **Scenario 13: The Cover-Up** — Moderate scandal + cover-up attempt, verify 60/40 outcomes
- **Scenario 14: Team For Sale** — Sim 5 seasons, verify at least one sale generated

- [ ] **Step 1: Write and run all tests**
- [ ] **Step 2: Commit, push, deploy**

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Wildcard + Ownership components | 2 | — |
| 2 | ScandalSystem | 2 new | 7+ |
| 3 | Ownership acquisition | 1 mod + 1 new | 5+ |
| 4 | Scandal chain events | 1 mod | — |
| 5 | Prestige + Rep extensions | 2 mod | — |
| 6 | Wire into DynastyBridge | 1 mod | — |
| 7 | Owner Dashboard UI | 3 | — |
| 8 | Integration tests | 1 mod | 4 |
