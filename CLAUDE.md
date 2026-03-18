# Claude Ball — Baseball Simulator

## Tech Stack
- React 19 + TypeScript 5.9 + Vite 7 + Tailwind 4
- Zustand 5 (state), Pixi.js 8 (diamond - Sprint 2), Recharts 3 (charts)
- Fonts: Oswald (display), Inter (body), IBM Plex Mono (stats)

## Architecture
- `src/engine/` — Pure TypeScript simulation (zero React deps, Web Worker ready)
- `src/engine/core/` — PitchEngine → ContactEngine → FieldingEngine → BaserunningEngine → AtBatResolver → GameEngine
- `src/engine/ai/` — ManagerAI, LineupBuilder
- `src/engine/stats/` — StatAccumulator for aggregate analysis
- `src/engine/data/` — Ballparks, sample teams
- Seedable Mulberry32 PRNG everywhere for deterministic replays

## Design System
- Dark navy (#0a0f1a) + gold (#d4a843) + cream (#e8e0d4)
- Retro scoreboard aesthetic inspired by Baseball Pro '98 / Tony La Russa 2
- Components: Panel, Button, StatsTable, LineScore, BoxScoreTable, PlayByPlay

## Calibration Targets (100-game aggregate)
| Stat | Target | Typical |
|------|--------|---------|
| BA | .230-.270 | ~.265 |
| K% | 18-26% | ~25% |
| BB% | 6-10% | ~9% |
| HR% | 2-4% | ~3% |
| R/G | 3.5-5.5 | ~4.0 |
| ERA | 3.50-5.00 | ~4.0 |

## Sprint Status
- Sprint 1: Engine + Test Harness ✅
- Sprint 2-8: Planned (see master architecture plan)

## Commands
```bash
npm run dev    # Dev server
npm run build  # Production build (tsc + vite)
```
