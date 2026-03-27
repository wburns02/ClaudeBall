# Dynasty Career Wiring + Prestige Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all disconnected dynasty systems into the game, connect character creation to player entities, build career transition UI, and create a prestige/legacy engine.

**Architecture:** 4 missing systems get registered in DynastyBridge. Character creation attributes get applied to the user's drafted player entity via EntityFactory. New CareerTransitionPage shows post-retirement opportunities. PrestigeEngine scores career achievements into a legacy rating.

**Tech Stack:** TypeScript 5.9, React 19, Vitest, existing ECS

---

## Task 1: Wire 4 missing systems into DynastyBridge

**Files:**
- Modify: `src/dynasty/bridge/DynastyBridge.ts` — register CareerProgressionSystem, LifeEventSystem, FinanceSystem, PersonalFinanceSystem

## Task 2: Connect character creation attributes to player entity

**Files:**
- Modify: `src/dynasty/bridge/FranchiseIntegration.ts` — read character data from localStorage, apply to user's player entity
- Modify: `src/dynasty/bridge/EntityFactory.ts` — accept attribute overrides

## Task 3: Build PrestigeEngine

**Files:**
- Create: `src/dynasty/systems/PrestigeEngine.ts` — legacy scoring from career stats, awards, relationships, reputation
- Create: `src/dynasty/systems/PrestigeEngine.test.ts`

## Task 4: Build CareerTransitionPage

**Files:**
- Create: `src/pages/dynasty/DynastyCareerTransitionPage.tsx` — shows opportunities after retirement
- Modify: `src/App.tsx` — add route
- Modify: `src/components/layout/FranchiseSidebar.tsx` — add link

## Task 5: Build PrestigePage (Legacy Dashboard)

**Files:**
- Create: `src/pages/dynasty/DynastyPrestigePage.tsx` — shows career legacy score, milestones, HOF projection
- Modify: `src/App.tsx` — add route
- Modify: `src/components/layout/FranchiseSidebar.tsx` — add link

## Task 6: Integration test — full career lifecycle

**Files:**
- Modify: `src/dynasty/systems/career-life.test.ts` — add tests for wired systems
