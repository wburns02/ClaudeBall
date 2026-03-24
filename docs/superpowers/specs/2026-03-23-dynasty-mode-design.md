# Claude Ball — Multi-Season Dynasty Mode Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Modes:** Classic Dynasty + Living Dynasty

---

## 1. Overview

Claude Ball's Dynasty Mode is a deeply customizable multi-season baseball life simulator with two distinct experiences built on a shared Entity-Component-System (ECS) architecture:

- **Classic Dynasty** — Start as GM. Traditional franchise management with AI-driven personality systems, living offseason, and full financial depth. No life sim.
- **Living Dynasty** — Start as a player. Full RPG career arc from drafted rookie through retirement and into the front office. AI conversations, texts, phone calls, personal finances, family, reputation — the complete life sim.

Both modes share the same world simulation. Classic activates a subset of systems; Living activates all of them.

### Design Principles

- **The world doesn't wait.** NPCs make decisions, free agents sign, trades happen whether or not the player engages. Urgency is real.
- **Everything compounds.** Relationships, reputation, finances, and decisions accumulate across 20+ seasons. Year 1 choices echo in Year 15.
- **Your dynasty, your rules.** Every setting is customizable per dynasty. Presets are starting points, not mandates. Mid-dynasty changes are allowed with a warning.
- **AI conversations are unique.** A massive pre-generated library handles 80% of interactions. Live Claude API calls handle the pivotal 20%. No conversation repeats.

---

## 2. Architecture: Entity-Component-System

### Why ECS

The dynasty involves dozens of interacting systems (personality, relationships, finances, reputation, career progression, life events, conversations). Direct coupling between these systems would create unmaintainable spaghetti. ECS provides:

- **Independent systems** that each do one thing and can be tested in isolation
- **Event-driven communication** so no system knows about the others
- **Mode toggling** — Classic vs Living is just which systems are active
- **Expansion-ready** — Tier 2/3 features drop in as new components + systems without refactoring

### Entities

Entities are unique IDs with attached components. Three categories:

**People:** Players, Coaches, Owner, Agents, Media personalities, Family members (Living), Friends (Living), Your Avatar
**Organizations:** Teams, Leagues, Minor League Affiliates
**Assets:** Contracts, Investments (Living), Properties (Living), Endorsements (Living)

### Components (Data Modules)

Each component is a typed data object that attaches to an entity.

**Both Modes:**
| Component | Description |
|-----------|-------------|
| `Personality` | 10 traits on 20-80 scale (Work Ethic, Ego, Loyalty, Charisma, Baseball IQ, Composure, Leadership, Aggression, Coachability, Integrity) |
| `Relationships` | Map of entity→entity bonds with affinity (-100 to +100), history array, and dynamic tags (mentor, rival, friend, tense, romantic) |
| `TeamFinances` | Revenue streams, expenses, budget, luxury tax status, stadium economics |
| `Reputation` | Three independent meters: Clubhouse Rep, Media Rep, Fan Rep (-100 to +100 each) |
| `Career` | Current role, career history, skills, achievements, awards |
| `Skills` | 20-80 tool grades: hit, power, speed, arm, field (hitters); fastball, breaking, changeup, command (pitchers). Current + potential ratings. |

**Living Dynasty Only:**
| Component | Description |
|-----------|-------------|
| `PersonalFinances` | Bank account, income sources, expenses, investments, lifestyle tier, net worth |
| `Family` | Spouse/partner, children, parents, family happiness, family events |
| `MentalHealth` | Confidence meter, stress level, burnout risk, sports psychologist relationship |
| `LifeEvents` | Queue of pending life events, active storylines, branching decisions |
| `Investments` | Portfolio of real estate, businesses, stocks, startup bets with performance tracking |

### Systems (Engines)

Each system operates on entities that have the relevant components. Systems do not call each other — they communicate through the Event Bus.

**Both Modes:**
| System | Responsibility |
|--------|---------------|
| `CoreSimSystem` | Game simulation, at-bats, pitching, fielding, baserunning (existing engine) |
| `SeasonSystem` | Schedule, standings, playoffs, phase transitions |
| `PersonalitySystem` | Generate traits for new entities, personality evolution over time |
| `RelationshipSystem` | Update affinity based on events, manage relationship dynamics, chemistry calculation |
| `FinanceSystem` | Team budgets, revenue, expenses, salary cap/luxury tax, market economics |
| `ConversationSystem` | Select and personalize conversations from library, manage live API calls |
| `ReputationSystem` | Update three rep meters based on events, manage visibility (gauge not raw number) |
| `ContractSystem` | Negotiations, arbitration, extensions, free agency market dynamics |
| `DraftSystem` | Amateur draft, Rule 5, international signings |
| `DevelopmentSystem` | Player aging, prospect development, coaching impact, training effects |
| `ScoutingSystem` | Prospect evaluation with fog-of-war, scout personality bias |
| `TradeSystem` | AI trade logic, trade calls, deadline dynamics |
| `OffseasonSystem` | Hot Stove timeline, inbox events, phase orchestration |

**Living Dynasty Only:**
| System | Responsibility |
|--------|---------------|
| `CareerProgressionSystem` | Role transitions (Player→Scout→Coach→GM→Owner), skill-based ladder skipping, opportunity generation |
| `LifeEventSystem` | Generate and resolve life events based on current state, branching storylines |
| `PersonalFinanceSystem` | Income, expenses, investments, financial advisor, bankruptcy risk |
| `NotificationSystem` | Deliver conversations as texts, phone calls, group chats, press conferences |

**Note:** `VoiceSystem` is a **UI-layer service**, not an ECS system. It subscribes to `ConversationTriggered` events from the Event Bus and handles audio rendering. It lives in `src/dynasty/ui/VoiceService.ts`, not in `src/dynasty/systems/`. This keeps presentation concerns out of the simulation layer.

### Event Bus

Central pub/sub system. When something happens, an event fires and any interested system reacts.

Example — `PlayerTraded` event:
- `RelationshipSystem`: Adjusts bonds (traded player resents GM, new teammates are neutral)
- `FinanceSystem`: Processes salary transfer between teams
- `ReputationSystem`: Updates media/fan perception based on player popularity
- `LifeEventSystem`: Triggers family stress (relocation), investment complications (selling house)
- `NotificationSystem`: Sends text from agent, queues call from new manager
- `ConversationSystem`: Queues farewell conversation with old teammates, welcome from new clubhouse

No system knows about the others. The event bus is the only coupling point.

**Core Event Types:**
`GameCompleted`, `SeasonPhaseChanged`, `PlayerTraded`, `PlayerSigned`, `PlayerReleased`, `PlayerRetired`, `PlayerInjured`, `ContractOffered`, `ContractSigned`, `DraftPickMade`, `AwardWon`, `OwnerMeeting`, `ManagerFired`, `GMHired`, `GMFired`, `FinancialEvent`, `LifeEvent`, `ReputationShift`, `RelationshipChanged`, `ConversationTriggered`, `CareerTransition`

### Phase Runner

Orchestrates the timeline. Each phase activates relevant systems and generates phase-appropriate events.

```
Spring Training → Regular Season → Trade Deadline → Playoffs → World Series
    → Season Review → Awards → Offseason (Hot Stove timeline) → [repeat]
```

Living Dynasty interleaves life events between baseball phases. Off-season months have personal life beats (Thanksgiving, Christmas, vacation, training decisions).

### Time Model

| Phase | Tick Unit | Player Controls |
|-------|-----------|-----------------|
| Spring Training | 1 game day | Sim day, sim to opening day |
| Regular Season | 1 game day (1-2 games) | Sim day, sim series, sim week, sim to date, sim to next event |
| Trade Deadline | 1 hour (final day), 1 day (deadline week) | Sim to next event, sim to deadline |
| Playoffs | 1 game | Sim game, sim series, sim to World Series |
| Offseason | 1 calendar week | Sim week, sim to next event, sim to month, sim to Spring Training |

**System evaluation frequency:**
- `CoreSimSystem`: Every game tick (during live play or sim)
- `SeasonSystem`: Every game day tick
- `RelationshipSystem`, `ReputationSystem`: Every game day (batch small events, process immediately for major events like trades)
- `FinanceSystem`: Weekly during season, weekly during offseason
- `ConversationSystem`: On-demand (triggered by events, not ticked)
- `LifeEventSystem` (Living): Weekly during offseason, daily during season (low probability per tick)
- `PersonalFinanceSystem` (Living): Monthly (investment returns, expense cycles)
- `CareerProgressionSystem` (Living): On career transition events only

---

## 3. Franchise Creation & Customization

### Setup Wizard

**Step 1 — Mode Selection:** Classic Dynasty or Living Dynasty

**Step 2 — Character Creation (Living only):**
- Name, appearance (for avatar/portrait)
- Background: College Star, Late-Round Pick, Undrafted Free Agent, International Signee
- Personality archetype (pick 3): These are player-friendly labels that map to the 10 underlying Personality component traits:

| Archetype (Player Picks) | Trait Effects |
|--------------------------|---------------|
| Grinder | Work Ethic 70+, Coachability 65+ |
| Natural Leader | Leadership 75+, Charisma 60+ |
| Big Ego | Ego 75+, Composure 50- |
| Clutch Gene | Composure 75+, Integrity 60+ |
| Baseball Nerd | Baseball IQ 80+, Charisma 40- |
| Fan Favorite | Charisma 70+, Loyalty 65+ |
| Risk Taker | Aggression 70+, Integrity 45- |
| Loyal Soldier | Loyalty 80+, Ego 35- |
| Hothead | Aggression 80+, Composure 35- |
| Smooth Operator | Charisma 75+, Coachability 50+ |

Remaining traits not set by archetypes are randomized within a moderate range (40-60). This gives each character a distinct personality shaped by the player's choices while maintaining the full 10-trait system under the hood.
- Traits shape every AI conversation and NPC reaction for the entire career

**Step 3 — League Configuration** with presets (Casual / Realistic / Hardcore / Sandbox):

| Setting | Casual | Realistic | Hardcore | Sandbox |
|---------|--------|-----------|----------|---------|
| Season length | 56 | 162 | 162 | Custom |
| Teams | 16 | 30 | 30 | 8-32 |
| Salary system | No cap | Luxury tax | Hard cap + floor | Off |
| Injuries | Rare | Normal | Brutal | Off |
| Prospect bust rate | 15% | 35% | 50% | 0% |
| Trade AI | Pushover | Realistic | Shark | Fair |
| Aging curves | Slow | Normal | Harsh | Off |
| Owner patience | Infinite | Moderate | Win now | Infinite |
| Fire risk | Off | On | Aggressive | Off |

**Every preset is a starting point.** Selecting a preset fills all values, then the user can override any individual setting. Changing one value switches the preset label to "Custom." No settings are locked, ever.

**Step 4 — Team Selection** (Classic: pick your team) or **Draft/Sign** (Living: get drafted or sign as UDFA based on background choice)

### Full Settings Reference

All settings are adjustable per dynasty, including mid-dynasty via Settings page (with competitive balance warning).

**League Structure:** Teams (8-32), leagues (1-2), divisions per league (1-4), teams per division (3-8), season length (56-162), playoff format (4/8/10/12/16-team), DH rule (AL only/Universal/None), expanded rosters (26/28-man), September callups, 40-man roster requirement.

**Financial:** Salary system (no cap/luxury tax/soft cap/hard cap+floor), luxury tax threshold ($150M-$300M), repeater penalty (1x-3x), revenue sharing (off/light/realistic/heavy), market size variation (equal/mild/realistic/extreme), stadium revenue model (simple/detailed), owner personality generation (random/curated/custom).

**Player Development:** Aging curve speed (slow/normal/harsh/custom), peak age range (slider), prospect bust rate (10%-60%), development randomness (low/medium/high), scouting accuracy (perfect/realistic fog/deep fog), international pipeline (off/simple/full), injury frequency (rare/normal/brutal), career-ending injuries (on/off).

**Simulation:** Trade AI difficulty (pushover/fair/realistic/shark), AI trade frequency (quiet/active/hyperactive), free agent demand (cold/normal/hot), arbitration (auto/simplified/full hearing), Rule 5 draft (off/auto/interactive), waiver rules (simple/full), roster limit enforcement (relaxed/strict).

**RPG Settings (Living only):** Personal finance complexity (simple/full), relationship depth (light/deep), life event frequency (rare/normal/chaotic), family sim (off/simple/full), voice calls (off/browser TTS/ElevenLabs), API conversation budget ($0/$1mo/$5mo/unlimited), notification style (inbox only/inbox+texts/full).

---

## 4. The Hot Stove Offseason

The offseason plays out as a living timeline from October through March. The primary interface is the **Inbox** — events arrive chronologically, the world moves whether or not the player engages.

### Timeline

| Month | Key Events |
|-------|------------|
| October | World Series → Season Review → Awards Ceremony → Player Opt-outs |
| November | GM Meetings → Non-tender deadline → Qualifying Offers → Rule 5 Draft |
| December | Winter Meetings → Free agency heats up → Major signings → Trade peak |
| January | Arbitration filings → Remaining FA signings → International signings |
| February | Arbitration hearings → Spring Training invites → Final roster moves |
| March | Spring Training games → Opening Day roster cuts → Season begins |

### Inbox Events

The inbox is the central offseason interface. Events arrive as actionable items:

- **Actionable:** "Agent for Marcus Webb wants to discuss extension" → triggers AI conversation
- **Informational:** "BREAKING: Yankees sign top FA reliever, 4yr/$72M" → world context
- **Decision required:** "Ownership wants to meet about next year's direction" → owner conversation
- **Personal (Living):** "Your wife is asking about vacation plans" → family happiness

### World Doesn't Wait

If the player sims through December without engaging free agents, the best ones sign elsewhere. If a trade call from a rival GM is ignored, they make the deal with someone else. The `OffseasonSystem` runs AI decisions on a timeline — every sim-day, AI teams evaluate and execute moves.

### AI Handles What You Skip

The assistant GM and coaching staff make decisions for anything the player doesn't touch. But they have their own personality biases:
- Conservative assistant GM won't make bold trades
- Aggressive pitching coach might overwork young arms
- Penny-pincher scout skips expensive international signings

This creates consequences for delegation — it's not just auto-resolve, it's delegated to an NPC with opinions.

### Classic vs Living

Classic mode: Inbox shows GM-relevant events only.
Living mode: Personal life events interleaved — agent calling about endorsements, family events, off-season training decisions, investment opportunities. The months between October and March are when the life sim is most active.

---

## 5. Personality & Relationship System

### Personality Traits

Every person entity has a `Personality` component with 10 traits on a 20-80 scouting scale:

| Trait | Affects |
|-------|---------|
| Work Ethic | Development speed, training gains, off-season improvement, career longevity |
| Ego | Contract demands, reaction to benchings, media behavior, trade request likelihood |
| Loyalty | Team-friendly deal willingness, trade request threshold, post-career returns |
| Charisma | Clubhouse influence, media handling, endorsement value, broadcasting career viability |
| Baseball IQ | On-field decisions, coachability, post-career front office aptitude, scouting accuracy |
| Composure | Clutch performance, pressure handling, slump recovery speed, interview quality |
| Leadership | Mentoring effectiveness, clubhouse chemistry contribution, manager/coach viability |
| Aggression | Beanball reactions, baserunning risk-taking, confrontation tendency, negotiation style |
| Coachability | How much coaching staff can accelerate development, willingness to change approach |
| Integrity | PED temptation resistance, scandal avoidance, fan trust, legal risk |

NPC personalities drive their behavior. An owner with high Ego + low Patience = win-now pressure. A coach with high Baseball IQ + low Charisma = great strategy, players don't respect him.

Personality traits are mostly stable but can shift slightly based on major life events (+/- 5 points over a career, never dramatic swings).

### Relationships

Every entity-to-entity relationship has:
- **Affinity** (-100 to +100): How much they like/trust you
- **History**: Array of significant interactions that shaped the bond (with timestamps)
- **Dynamic tags**: `mentor`, `rival`, `friend`, `tense`, `romantic`, `professional`, `adversarial`

Relationships compound across seasons. A catcher you mentored as a rookie remembers you 10 years later when he's a manager and you're a GM. A pitcher you traded away holds a grudge and lights you up every time he faces your team.

### Chemistry Engine

Team chemistry is calculated from the relationship web between all rostered players + coaching staff:
- Sum of mutual affinity scores, weighted by Leadership trait
- Bonus for high-Leadership + high-Loyalty clusters
- Penalty for feuding players (affinity < -50), especially if both are starters
- Coach-player relationship quality affects individual development and team morale

Chemistry output: a team-level modifier (-10 to +10) applied to clutch situations, comeback probability, and late-game performance.

---

## 6. AI Conversation System

### Three Layers

**Layer 1 — Pre-Generated Library (80% of conversations):**

Generated offline by Opus/Sonnet before the game ships. ~3,000-5,000 conversation templates organized by:
- **Situation**: contract negotiation, trade call, owner meeting, press conference, clubhouse confrontation, family dinner, agent check-in, mentor moment, media interview, etc.
- **Personality archetype combinations**: high-ego player + patient GM, aggressive agent + penny-pincher owner, etc.
- **Emotional state**: happy, frustrated, desperate, confident, angry, anxious
- **Stakes level**: routine, moderate, career-defining

Each template is a dialogue tree with branching paths and multiple outcomes. At runtime, the system performs variable substitution — real names, stats, contract figures, relationship history, recent events are injected into the template.

Stored as JSON in the app bundle. No API needed.

**Template Format:**

```json
{
  "id": "contract-negotiation-highego-agent-001",
  "situation": "contract_negotiation",
  "archetypes": {
    "npc": ["high_ego", "veteran"],
    "player": ["any"]
  },
  "emotionalState": ["confident", "aggressive"],
  "stakes": "high",
  "nodes": [
    {
      "id": "open",
      "speaker": "npc",
      "text": "Look, {{playerName}}, we both know {{npcPlayerName}} put up {{statLine}} last year. He's not taking a penny under {{askingPrice}}.",
      "next": ["respond_firm", "respond_friendly", "respond_walkaway"]
    },
    {
      "id": "respond_firm",
      "speaker": "player",
      "text": "Those numbers are solid, but {{teamCity}} has budget constraints. We're offering {{offerAmount}} over {{offerYears}} years.",
      "effects": { "affinity": -5, "respect": +3 },
      "next": ["counter_high"]
    }
  ],
  "outcomes": {
    "deal_made": { "event": "ContractSigned", "affinity_delta": +10 },
    "walked_away": { "event": "NegotiationFailed", "affinity_delta": -15 }
  }
}
```

- **Variable substitution:** Mustache-style `{{variableName}}`. Variables resolved at runtime from entity components and game state.
- **Indexing:** Templates indexed by `(situation, archetypes, emotionalState, stakes)` tuple. Runtime lookup: filter by situation, score by archetype match + emotional state match, pick top-scoring template not used in last 5 conversations with this NPC.
- **Typical tree size:** 5-15 nodes per template, 2-4 branches per node. Deep conversations (owner meetings, trade calls) can go to 20+ nodes.
- **Delivery:** Bundled in `public/conversations/` directory as category-grouped JSON files (e.g., `contracts.json`, `owner.json`, `media.json`). Lazy-loaded by category on first access. Total bundle: ~30-50MB across all categories.
- **Generation pipeline:** Scripted batch process using Claude API. Input: situation description + personality constraints + example dialogue style. Output: JSON templates validated against schema. One-time generation at launch, expandable for Tier 2/3.

**Layer 2 — Live API (20% of conversations):**

Pivotal moments hit the Anthropic API (using the existing Railway env var `ANTHROPIC_API_KEY` from the React CRM):
- Getting hired or fired
- Draft night war room tension
- Blockbuster trade negotiations with real back-and-forth
- Owner showdown when you're on the hot seat
- World Series press conference
- Career milestone conversations (retirement, Hall of Fame)
- Any conversation the player explicitly requests to "go deeper" on

API context payload includes:
```json
{
  "character": {
    "name": "Jim Dalton",
    "role": "owner",
    "personality": { "ego": 75, "patience": 30, "loyalty": 45 },
    "emotionalState": "frustrated"
  },
  "relationship": {
    "affinity": -12,
    "history": ["hired you 3 years ago", "missed playoffs twice", "approved budget increase that didn't pan out"]
  },
  "situation": {
    "type": "owner_meeting",
    "context": "Team is 58-72, 4th in division",
    "agenda": "Considering firing you"
  },
  "playerPersonality": { "charisma": 70, "baseballIQ": 85, "composure": 60 }
}
```

Model routing:
- Haiku: Routine live conversations (~$0.001 each)
- Sonnet: High-stakes conversations (~$0.01 each)
- Estimated cost per full season: $0.50-$2.00 depending on engagement

**Layer 3 — Notification Delivery (Living Dynasty only):**

| Channel | Use Case | Implementation |
|---------|----------|----------------|
| In-game inbox | All conversations, always available | React component |
| Text messages | Agent updates, family, friends, quick pings | Chat bubble UI with typing indicator animation |
| Phone calls | Owner summons, big trade calls, agent negotiations | Voice via `VoiceProvider` interface |
| Press conferences | Post-game, trade announcements, season preview | Podium UI with reporter question queue |
| Group chats | Coaching staff thread, player group chat | Multi-person chat thread UI |

### Voice System

```
ConversationSystem generates dialogue text
    → VoiceProvider interface
        → BrowserTTSProvider (Web Speech API) — default at launch
        → ElevenLabsProvider — premium option (config swap, no code change)
        → OffProvider — text only
    → Settings toggle: Voice Provider dropdown
```

Each character gets a persistent voice profile (pitch, rate, accent parameters) so the owner always sounds like the owner across every conversation.

### Error Handling & Fallback

- **Timeout:** If API call exceeds 8 seconds, abort and substitute a pre-generated template tagged for the same situation. User sees no interruption.
- **Network failure:** Immediate fallback to pre-generated library. Toast notification: "Playing offline — conversations from library."
- **Rate limiting:** Queue conversations, process when rate limit resets. Non-blocking — game continues with library templates.
- **Malformed response:** Discard, fall back to template. Log for debugging.
- **Graceful degradation:** The game is always playable at full quality with $0 API budget. Live API enhances but is never required.

### Cost Control

- Settings page shows estimated API usage per season
- User sets a monthly API budget cap
- When budget exhausted, system falls back to pre-generated library for all conversations
- $0 budget = fully offline, library-only mode (still great)

---

## 7. Career Progression (Living Dynasty)

### Phase 1 — Player Career (Ages 18-38+)

The player experiences baseball from the field:
- Clubhouse dynamics (mentors, rivals, cliques formed through the RelationshipSystem)
- Contract negotiations through your agent (agents have personalities — you pick yours)
- Trade rumors creating stress that affects performance
- All-Star selections, awards, personal milestones
- Off-season training choices shaping development trajectory
- Personal life alongside: dating, marriage, kids, investments, endorsements

### Extended Playing Careers

Players who invest in their bodies can play into their 40s:

| Factor | Effect |
|--------|--------|
| Off-season training choices | Yoga/flexibility extends career; heavy lifting builds power but wears joints |
| Work Ethic trait | High = consistent maintenance, slower decline curve |
| Injury history | Clean record extends longevity; repeated injuries accelerate decline |
| Position flexibility | DH/1B can play longer than SS/CF; position switch opportunities arise naturally |
| Willingness to adapt | High Coachability + Baseball IQ = can reinvent (power→contact, starter→reliever) |
| Sports medicine investment | Personal trainers, nutritionists, sleep coaches from PersonalFinanceSystem |
| PED temptation | Short-term boost, career/legacy risk via Integrity trait |

Peak archetype (high Work Ethic + Composure, invests in body, adapts game): can play to 44-46.
Bust archetype (low Work Ethic + high Ego, neglects body): flames out at 32.

### Phase 2 — Transition (1-3 years)

After retirement, opportunities arrive through the inbox based on profile:

| Path | Key Requirements | Typical Time to GM |
|------|-----------------|-------------------|
| Front Office Fast Track | High Baseball IQ, MBA courses, FO connections | 2-4 years |
| Coaching Route | High Leadership, coaching certs, player relationships | 4-7 years |
| Scouting Route | High Baseball IQ, minor league/international experience, languages | 3-6 years |
| Broadcasting | High Charisma, Media Savvy, broadcasting school | Lateral (can pivot later) |
| Business/Ownership | High net worth, business investments, community ties | 5-10 years to owner |

Paths are not menu selections — they're opportunities generated by the `CareerProgressionSystem` based on your skills, traits, relationships, and reputation. Multiple paths may be offered simultaneously.

**Skill-based ladder skipping:** A player with 80 Baseball IQ + 75 Charisma + MBA + strong ownership relationship could jump from retirement directly to GM. A legendary player with massive wealth could skip the entire front office track and buy a team. Requirements listed are typical, not mandatory gates.

### Phase 3 — Climbing the Ladder

Each role has its own gameplay loop:

**Scout:** Travel to assigned regions, evaluate prospects, file reports. Your personality creates scouting bias (aggressive scouts overhype tools, conservative ones underrate upside). Accuracy of your reports influences GM's draft decisions. Good results → promotion.

**Coach:** Manage player development assignments, set training programs, handle clubhouse issues. Your coaching style (tough love vs. player's coach) interacts with player personalities. Win a championship as bench coach → manager offers arrive.

**Manager:** Set lineups, make in-game decisions, handle media. Tactical style and personality shape team culture. Most direct path to GM.

**Assistant GM:** Handle trade calls, manage farm system, present analytics. The GM's personality shapes your experience. Learning the ropes with delegated responsibility.

**GM:** Full franchise control. Classic Dynasty gameplay with the enrichment of every relationship built on the way up. Former teammates are now managers, scouts, rival GMs.

**President of Baseball Ops:** Strategic oversight. Multiple GMs report to you. Ownership interface. Legacy-level decisions.

**Owner:** Endgame. Requires massive personal wealth accumulated through playing career + investments. Set organizational vision. Hire/fire GMs. Ultimate legacy mode.

**You can get stuck or skip levels.** A failed manager might never get a GM offer. A brilliant scout might get poached directly to assistant GM. Nothing is guaranteed.

**Classic Dynasty note:** Player skips all career progression (starts as GM). But NPCs still have full career arcs — your manager might retire and become a broadcaster, your star player might become a rival GM in 10 years.

---

## 8. Personal Finance & Life Sim (Living Dynasty)

### Income Sources

- Player salary (from contract negotiations)
- Endorsement deals (scale with Reputation meters — local → regional → national)
- Investment returns (quarterly from portfolio)
- Post-career salary (scout/coach/GM/broadcaster pay — much less than player salary)
- Business revenue (owned businesses with variable performance)

### Expenses

- Lifestyle tier: Modest / Comfortable / Lavish / Extravagant (affects happiness, burn rate, public perception)
- Housing (buy/rent in team's city, sell when traded — market fluctuates)
- Agent fees (4-10% based on agent quality/reputation)
- Family costs (scale with spouse expectations, number of kids)
- Training staff (personal trainer, nutritionist, sports psychologist — optional, extends career)
- Charity/foundation (tax benefits + reputation boost + legacy)
- Legal fees (scandal/DUI/lawsuit situations)

### Investments

- **Real estate**: Rental properties — steady income, illiquid, market-dependent
- **Business ventures**: Restaurant, gym, car wash, training facility — high risk/reward. Business partner has a personality via NPC entity.
- **Stock market**: Simplified portfolios — conservative/moderate/aggressive
- **Startup investments**: Fellow players' businesses, tech ventures — lottery tickets
- **Financial advisor**: NPC with personality. Good advisor grows wealth. Bad/greedy advisor pushes risky investments for commission. You can fire/hire advisors.

### The Stakes

A player earning $150M career earnings who lives Extravagant with bad investments and a messy divorce can end up broke. A modest earner ($20M career) who invests wisely and lives Comfortable retires wealthy with capital to buy a team.

Financial state feeds into: mood/MentalHealth, family happiness, post-career options, willingness to take low-paying front office jobs, ability to skip the ladder and purchase a franchise.

---

## 9. Reputation System

Three independent meters that can wildly diverge.

### Clubhouse Rep (-100 to +100)

**Built by:** Leadership moments, mentoring, standing up for teammates, handling adversity gracefully, showing up to optional workouts, selfless play
**Damaged by:** Ego explosions, throwing teammates under the bus publicly, trade demands, PED scandals, showing up late, selfish play
**Effects:** Team chemistry modifier, free agent attraction (as GM), coaching trust, mentoring effectiveness

### Media Rep (-100 to +100)

**Built by:** Good quotes, accessibility, composure under tough questions, creating compelling storylines
**Damaged by:** Ducking press, hostile interviews, scandals, contradictions, stonewalling
**Effects:** Narrative framing (media spins moves positively/negatively), endorsement quality, broadcasting viability, public pressure on ownership

### Fan Rep (-100 to +100)

**Built by:** Winning, clutch performances, community involvement, charity, social media engagement, loyalty to city
**Damaged by:** Losing, trade demands, holdouts, off-field scandals, dismissing fans, signing with rival
**Effects:** Attendance revenue (as GM), jersey sales, hometown discounts from FAs, ovations vs. boos, legacy narrative

### Interactions

Reputation meters create conflicting pressures. Trading a player with Fan Rep +80 but Clubhouse Rep -30 means fans revolt but teammates are relieved. Each meter generates different inbox events and AI conversation tones.

### Visibility

Players see a qualitative gauge (Beloved / Liked / Neutral / Disliked / Hated), not the raw number. Actual standing is revealed through AI conversations — reporter tone, fan mail vs. hate mail, whether teammates invite you to dinner.

### Decay & Compounding

One bad season doesn't destroy reputation. One good season doesn't save it. The trend over time matters. Slow trust-building and slow erosion create realistic dynamics.

---

## 10. Persistence & Save System

### Primary: IndexedDB

- Each dynasty save is self-contained: all entities, components, event history, conversation logs, relationship maps, financial records
- Auto-save after every significant action (end of day sim, completed conversation, roster move)
- Manual save slots (unlimited)

**Data size estimates (realistic):**
- Entity data per season: ~1,500 entities x ~2KB avg = ~3MB
- Relationship graph: sparse storage (only non-neutral relationships stored). ~5,000-10,000 active bonds per season x ~200 bytes = ~1-2MB
- Conversation logs: ~50-100 conversations/season x ~5KB avg = ~250-500KB
- Event log: ~2,000 events/season x ~100 bytes = ~200KB
- Stats/box scores: ~5MB per season (existing stat accumulator data)
- **Per-season total: ~10-20MB**
- **10-season dynasty: ~100-300MB** (Living Dynasty on high end, Classic on low end)

**Data retention policy:**
- **Hot data** (in memory): Current season entities, active relationships (affinity != 0), current phase state
- **Warm data** (lazy-loaded from IndexedDB): Previous seasons' stats, historical box scores, older conversation logs
- **Cold data** (compressed archives): Relationship history older than 3 seasons pruned to summaries (key events only, not tick-by-tick affinity changes). Event logs older than 5 seasons compressed to season summaries.
- **Conversation text**: Full text kept for 2 most recent seasons. Older conversations archived to outcome-only records (who said what decision, not the full dialogue).

IndexedDB limits: Chrome ~60% of disk, Firefox 50%, Safari 1GB per origin. A 20-season dynasty at ~400-600MB is feasible on all browsers with the retention policy active.

### Export/Import

- Full dynasty export as compressed JSON (`.claudeball` file extension)
- Import from file for device transfer, sharing, backup
- Conversation library ships as separate downloadable asset (~50-100MB)

### Optional Cloud Sync (Tier 2 Feature)

Cloud sync is **not in v1**. IndexedDB + export/import covers all persistence needs at launch.

When implemented (Tier 2), the approach will be a lightweight Cloudflare Worker + R2 object storage:
- Worker handles auth (simple API key or GitHub OAuth)
- R2 stores compressed `.claudeball` save files (same format as export)
- Endpoints: `POST /saves/upload`, `GET /saves/list`, `GET /saves/:id/download`
- Conflict resolution: last-write-wins with timestamp, manual pick option
- IndexedDB remains source of truth — cloud is backup only
- Works offline, syncs when connection returns

This avoids coupling Claude Ball to the CRM backend. The Worker is a standalone microservice specific to Claude Ball.

### Migration from Current System

- Existing Zustand `persist` localStorage saves get one-time migration to IndexedDB
- Old franchise saves imported into ECS format with sensible defaults (personality traits generated for existing players, relationships initialized to neutral)
- No save data lost

---

## 11. Expansion Tiers (Future — Architecturally Accounted For)

NOT in initial implementation. The ECS is designed so these drop in as new components + systems.

### Tier 2 — Depth (Post-Launch Expansion 1)

- **Assistant GM / front office staff (EXPANDED)**: v1 includes basic delegation with personality bias (conservative assistant GM won't make bold trades). Tier 2 adds: named NPCs with full career arcs, hiring/firing assistant GMs, competence ratings that affect delegation quality, front office org chart management.
- **Named scouts (EXPANDED)**: v1 includes scouting with accuracy fog. Tier 2 adds: individual named scout NPCs with distinct personalities (hype scout, conservative scout, international specialist), scout hiring/firing, scout accuracy that varies by individual, reports explicitly colored by scout personality.
- **Rival GM relationships**: Trust, grudges, trade history built over years. Affects willingness to deal.
- **Agent ecosystem**: Agents have reputations, client rosters, negotiation styles. Powerful agent = better contracts but higher fees.
- **Umpire personalities**: Generous/tight zones, ejection tendencies.

### Tier 3 — Life Sim (Post-Launch Expansion 2)

- **Family dynamics (EXPANDED)**: v1 includes basic family (spouse exists, kids cost money, family happiness as a single meter). Tier 3 adds: spouse with full personality traits, kids growing up and developing their own traits (one might enter the draft!), family events as interactive storylines (birthdays, graduations, emergencies), family members as full NPC entities with AI conversations.
- **Friends network**: College buddies, former teammates, non-baseball friends
- **Player personal lives**: Divorce, new baby, homesickness after trade, partying habits affecting performance
- **Romantic relationships**: Dating scene, relationship milestones, marriage dynamics
- **Community involvement**: City-specific events, charity galas, youth baseball camps
- **Housing market**: Neighborhoods, property values, home reflects lifestyle tier
- **Pet ownership**: Emotional support, social media popularity, travel complications

### Tier 2/3 Conversation Library

Each tier gets its own pre-generation pass (~2,000-3,000 templates per tier). The ConversationSystem's library loader accepts expansion packs — drop new JSON template bundles into the library directory.

---

## 12. Technical Integration

### Existing Code Preservation

The current game engine (`src/engine/core/`), diamond rendering, stats system, and UI components are untouched. The ECS is built alongside the existing system in a new directory structure.

### Engine Bridge Layer

The ECS does not replace existing engines — it wraps them. Bridge adapters translate between old and new:

**Phase 1 — Coexistence (v1 launch):**
| Existing Code | ECS Wrapper | Bridge Behavior |
|---------------|-------------|-----------------|
| `GameEngine` + `AtBatResolver` | `CoreSimSystem` | Calls `simulateGame()`, emits `GameCompleted` event with box score data |
| `SeasonEngine` + `ScheduleGenerator` + `StandingsTracker` | `SeasonSystem` | Wraps `advanceDay()`, emits `SeasonPhaseChanged` when phase transitions occur |
| `OffseasonEngine` | `OffseasonSystem` | Replaces the monolithic `advanceSeason()` with phased Hot Stove timeline |
| `ContractEngine` | `ContractSystem` | Wraps existing methods, adds event emission on sign/release/expire |
| `DraftEngine` | `DraftSystem` | Wraps `makePick()` / `generateDraftClass()`, emits `DraftPickMade` |
| `DevelopmentEngine` | `DevelopmentSystem` | Wraps `developPlayer()`, integrates personality traits as modifiers |
| `ScoutingEngine` | `ScoutingSystem` | Wraps existing scouting, adds scout personality bias layer |
| `TradeEngine` + `AITradeManager` | `TradeSystem` | Wraps `evaluateTrade()`, emits `PlayerTraded` events |
| `InjuryEngine` | Part of `SeasonSystem` | Wraps injury rolls, emits `PlayerInjured` events |
| `MoraleEngine` + `moraleStore` | `RelationshipSystem` | **Replaced.** Morale values migrate to Personality.composure + Relationships.affinity. `moraleStore` deprecated. Team chemistry calculated from relationship web instead of standalone morale values. |
| `CoachingStaff` + `coachingStore` | Part of `DevelopmentSystem` | Coaching impact folded into development calculations with personality interaction |

Stores that persist through Phase 1: `gameStore` (live game state), `statsStore` (aggregate stats), `historyStore` (franchise history), `settingsStore` (user preferences), `achievementStore`, `toastStore`, `playerModalStore`. These are UI-layer stores, not simulation state, and coexist indefinitely.

Stores deprecated in Phase 1: `franchiseStore` (responsibilities split across `FinanceSystem`, `ContractSystem`, `DraftSystem`, `OffseasonSystem`, `SeasonSystem`), `moraleStore` (replaced by `RelationshipSystem`), `gmStore` (replaced by ECS entity for player avatar), `careerStore` (replaced by `CareerProgressionSystem`), `inboxStore` (replaced by `NotificationSystem`), `scoutingStore` (replaced by `ScoutingSystem`), `coachingStore` (replaced by `DevelopmentSystem`), `goalsStore` (replaced by goals tracked on Career component).

**Phase 2 — Migration (post-launch):** Move remaining game state from Zustand stores into ECS entities. `gameStore` becomes a thin React-side view layer reading from `CoreSimSystem` output.

**Phase 3 — Completion:** Old stores are empty shells or deleted. All simulation state lives in the ECS. UI reads from ECS query results.

### Chemistry Engine Integration

The Chemistry Engine output (team-level modifier, -10 to +10) is injected into the existing `AtBatResolver` as a `clutchModifier` parameter. When resolving at-bats in clutch situations (RISP, late & close), the player's `clutch` rating is adjusted by the team chemistry modifier. This requires a single parameter addition to `AtBatResolver.resolve()`, not a rewrite.

### Skills Component Mapping

The ECS `Skills` component is a **thin wrapper** over the existing player rating system, not a replacement. Mapping:

| Skills Component (20-80 display) | Existing Engine Field | Conversion |
|----------------------------------|----------------------|------------|
| Hit (vs L) | `batting.contact_L` | Direct (already 0-100, display as 20-80 via `Math.round(val * 0.6 + 20)`) |
| Hit (vs R) | `batting.contact_R` | Direct |
| Power (vs L) | `batting.power_L` | Direct |
| Power (vs R) | `batting.power_R` | Direct |
| Eye | `batting.eye` | Direct |
| Speed | `batting.speed` | Direct |
| Arm | `fielding.arm_strength` | Direct (already exists in `FieldingRatings`) |
| Field | `fielding.range` | Direct (already exists in `FieldingRatings`) |
| Fastball | `pitching.stuff` | Direct |
| Breaking | `pitching.movement` | Direct |
| Changeup | Derived from `pitching.stuff * 0.5 + pitching.control * 0.5` | Synthetic until dedicated field added |
| Command | `pitching.control` | Direct |

The `Skills` component stores `current` and `potential` for each tool. `current` mirrors the engine rating. `potential` is generated at entity creation and caps development.

**MentalRatings overlap:** The existing `Player` type has a `MentalRatings` interface with `intelligence`, `work_ethic`, `durability`, `consistency`, `composure`, and `leadership`. The ECS `Personality` component wraps these similarly to how `Skills` wraps batting/pitching ratings. Mapping: `intelligence` → `Baseball IQ`, `work_ethic` → `Work Ethic`, `composure` → `Composure`, `leadership` → `Leadership`. `durability` and `consistency` remain on the engine `Player` type (they're simulation parameters, not personality traits). The `Personality` component reads from these fields and adds the additional traits (Ego, Loyalty, Charisma, Aggression, Coachability, Integrity) that don't exist in the current engine.

### Web Worker Strategy

The `SystemRunner` executes all ECS system ticks in a Web Worker to avoid blocking the UI during multi-game simulation. The existing engine is already noted as "Web Worker ready" in CLAUDE.md. The worker receives entity/component snapshots, runs system ticks, and posts back state deltas. React components subscribe to delta updates via a thin bridge layer.

For single-game live play, the worker is not needed — the existing `GameEngine` runs synchronously in the main thread as it does today.

### Directory Structure:

```
src/dynasty/
  ecs/
    EventBus.ts
    EntityManager.ts
    ComponentRegistry.ts
    SystemRunner.ts
  components/
    Personality.ts
    Relationships.ts
    TeamFinances.ts
    PersonalFinances.ts
    Reputation.ts
    Career.ts
    Skills.ts
    Family.ts
    MentalHealth.ts
    LifeEvents.ts
    Investments.ts
  systems/
    PersonalitySystem.ts
    RelationshipSystem.ts
    FinanceSystem.ts
    ConversationSystem.ts
    ReputationSystem.ts
    ContractSystem.ts
    DraftSystem.ts
    DevelopmentSystem.ts
    ScoutingSystem.ts
    TradeSystem.ts
    OffseasonSystem.ts
    CareerProgressionSystem.ts
    LifeEventSystem.ts
    PersonalFinanceSystem.ts
    NotificationSystem.ts
  conversations/
    library/          # Pre-generated JSON templates
    LiveConversation.ts
    TemplateEngine.ts
    VoiceProvider.ts
  persistence/
    IndexedDBStore.ts
    CloudSync.ts
    SaveMigration.ts
  phases/
    PhaseRunner.ts
    SpringTraining.ts
    RegularSeason.ts
    Playoffs.ts
    Offseason.ts
  ui/
    VoiceService.ts   # UI-layer service, NOT an ECS system
    # Dynasty-specific pages and components
```

### Migration Strategy

Existing stores (`franchiseStore.ts`, `careerStore.ts`, etc.) are preserved initially. New dynasty features are built in `src/dynasty/`. Over time, responsibilities migrate from old stores to ECS systems. The `franchiseStore` thins out as its logic moves to `FinanceSystem`, `ContractSystem`, `DraftSystem`, etc.

### API Integration

The Anthropic API key is sourced from the same environment variable used by the React CRM on Railway (`ANTHROPIC_API_KEY`). For local development, it reads from a `.env` file or browser localStorage setting.

The conversation API client is a standalone module that can be configured at runtime — no build-time dependency on the key existing.

---

## 13. Success Criteria

The dynasty mode is complete when:

1. **Classic Dynasty** is playable for 10+ seasons without bugs, save corruption, or state drift
2. **Living Dynasty** supports a full career arc: drafted → player career → transition → GM → owner
3. **AI conversations** feel genuinely unique across 50+ interactions in a single dynasty
4. **The world feels alive** — AI teams make realistic moves, the offseason has urgency, NPCs remember your history
5. **Customization** — every setting works independently, presets are just defaults, mid-dynasty changes function correctly
6. **Performance** — simming a full 162-game season completes in under 10 seconds, conversation library loads instantly, IndexedDB saves are sub-second
7. **Save integrity** — 20-season dynasty saves load correctly, cloud sync works, migration from old format succeeds
