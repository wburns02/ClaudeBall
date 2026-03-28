# Claude Ball — Full Career Stages + CK2-Style Events Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Depends on:** Dynasty Mode (complete), Living Dynasty (complete)

---

## 1. Overview

The ultimate baseball RPG: start at age 12 in Little League and play through every stage of a baseball life — travel ball, high school, college, minors, MLB, retirement, front office, ownership. 40+ year career arc.

**Core Loop (CK2-inspired):** Time sims in the background → Big Game Moment (playable at-bat/pitch) → Life Decision Event (branching choice with consequences) → Relationships shift, attributes develop, story emerges → Repeat.

**Every stage: SIM or PLAY.** Skip any stage in seconds, or live every moment.

### Design Principles

- **Big moments matter.** You don't play every game. You play the MOMENTS — the showcase at-bat, the championship game, the MLB debut. Everything else sims.
- **Decisions shape everything.** Every choice cascades. Choosing college over the draft changes your entire trajectory. Choosing football over baseball closes one door and opens another.
- **Time is the game.** Seasons pass quickly. Years compress. The DECISIONS between seasons are more important than the games within them.
- **Stories emerge.** You don't follow a script. The combination of your choices, your attributes, your relationships, and randomness creates a unique narrative every playthrough.

---

## 2. Career Stages

### Stage 1: Little League (Ages 12-14, 3 years)

**Gameplay:** Mostly event-driven. 2-3 events per year + 1 Big Game Moment per year.

**Events:**
- Travel ball tryout (make the team? Your skill determines odds)
- AAU tournament (play the championship at-bat)
- Discover your talent: event reveals your natural position based on attributes
- Two-sport opportunity: football/basketball coach wants you too
- Family dynamics: parent pushing you hard vs. letting you have fun
- First rivalry: another kid on a rival team — relationship forms
- Coach mentorship: good coach boosts development, bad coach stunts it

**Big Game Moments:**
- Little League World Series regional (if you're good enough)
- AAU championship game — one at-bat or one pitch that determines the outcome
- All-Star game selection

**Development:** Attributes grow rapidly (young = high growth rate). Potential is discovered, not set — you start with hidden potential that reveals over time.

**Sim option:** "Sim to High School" — 10 seconds, attributes develop based on work ethic + randomness.

---

### Stage 2: High School (Ages 15-18, 4 years)

**Gameplay:** 4-6 events per year + 2-3 Big Game Moments per year. This is where it gets real.

**Events:**
- Varsity tryout (freshman year — do you make it?)
- Showcase invitations (Perfect Game, East Coast Pro, Area Code Games)
- College recruiting letters (based on your stats + reputation)
- Two-sport decision: football coach offers starting QB spot. Family pressure.
  - AI conversation with family: "Football pays more" vs "You're a baseball player"
- Prom / social life events (affects personality traits)
- Academic decisions: study for SATs (college backup) vs extra batting practice
- PED temptation: older player offers "supplements" — first moral test
- Injury risk events: playing through pain or sitting out
- Rivalry intensifies: face your Little League rival in district championship
- Scout attention: MLB scouts start showing up to your games junior year

**Big Game Moments:**
- State championship game (if your team qualifies)
- Perfect Game showcase: 3 at-bats in front of 50 MLB scouts
- Senior night: emotional moment, relationship events with parents/coaches
- Rivalry game: face your nemesis — packed stands, scouts watching

**The Big Decision (end of senior year):**
- **Enter the MLB Draft** — go pro immediately, start earning
  - If drafted high: signing bonus, minor league assignment
  - If drafted low or undrafted: tough decision, less money
- **Go to College** — 3-4 more years of development
  - Choose school: baseball powerhouse (better coaching) vs academic school (education fallback)
  - College adds 3-4 years but significantly develops current ratings toward potential
- **Play football** — leaves baseball entirely (game over for baseball, different career path)

**Sim option:** "Sim to Draft Decision" — sims all 4 years, presents the draft/college choice.

---

### Stage 3: College (Ages 18-22, optional 3-4 years)

**Gameplay:** 3-5 events per year + 2-3 Big Game Moments per year.

**Events:**
- Freshman adjustment: homesickness, new teammates, tougher competition
- College World Series run (if your team is good)
- Summer league (Cape Cod, etc.) — additional development + scout exposure
- Relationship events: roommate becomes lifelong friend or rival
- Academic requirements: maintain GPA or lose eligibility
- Draft eligible after junior year — leave early or stay for senior year?
- NIL deals (modern era): endorsement money while in college
- Coach relationship: affects development rate and playing time

**Big Game Moments:**
- College World Series game (play the key at-bat)
- Cape Cod League All-Star game
- Regional tournament elimination game
- Rivalry game vs. crosstown school

**Development:** Current ratings develop faster toward potential in college (better coaching, better competition). But potential doesn't grow as much — you're refining, not expanding.

**Sim option:** "Sim to Draft" — sims college years, enters draft.

---

### Stage 4: Minor Leagues (Ages 18-25, 1-6 years)

**Gameplay:** 2-4 events per year + 1-2 Big Game Moments per year. The grind.

**Events:**
- Bus rides: 12-hour trips, cramped hotels, $25/day meal money
- Callup anticipation: "Is today the day?"
- Teammate gets called up before you — jealousy or motivation?
- Coaching assignment: hitting coach works on your swing (attribute changes)
- Off-field training choices (the Training Impact system kicks in here)
- Financial stress: minor league pay is brutal
- Relationship with manager: affects playing time, position, opportunity
- Trade rumors: your organization might move you

**Big Game Moments:**
- First game at each level (A, AA, AAA)
- Futures Game / All-Star Futures Game
- The Call: YOU'RE GOING TO THE BIG LEAGUES (the biggest moment in the game)
- Must-win game for playoff spot

**The Call:**
This is the emotional peak of the early career. AI-generated conversation:
> Manager pulls you aside: "Pack your bags, kid. You're going to [CITY]."
> Phone call to parents: "Mom... I made it."
> Teammates congratulate you. Some are happy. Some are jealous.

**Development:** Current ratings grind toward potential. Training choices matter. Coaching quality matters. The gap between current and potential closes.

**Sim option:** "Sim to MLB" — sims until you're called up (or released if you're not good enough).

---

### Stage 5: MLB Career (Ages 21-40+, existing gameplay)

This is the current Living Dynasty mode — fully built. All existing systems apply:
- Season sim with playable live games
- Hot Stove offseason
- AI conversations, life events, scandal system
- Contract negotiations, trades, free agency
- Reputation, relationships, prestige
- Training Impact affecting potential

---

### Stage 6: Post-Career (Ages 35-50+, existing gameplay)

Career progression pipeline: Scout → Coach → Manager → GM → President → Owner
- Already built with the CareerProgressionSystem
- Owner Mode with scandal system
- Prestige/Legacy engine tracks the full 40+ year story

---

## 3. The Big Game Moment System

The core of the CK2-style experience. You don't play full games — you play MOMENTS.

**Structure:**
1. Season sims in the background (stats generated)
2. A "Big Game Moment" triggers based on importance
3. You're placed into a specific situation: "Bottom of the 9th, 2 outs, runner on third. State championship on the line."
4. You play 1-3 at-bats (or 1-3 batters as pitcher)
5. The outcome affects your story, relationships, scout grades, and reputation

**Moment types:**
- **Championship at-bat:** Win or lose the big game
- **Showcase performance:** Scouts watching, every swing matters for draft position
- **Rivalry confrontation:** Face your nemesis — personal stakes
- **MLB debut:** Your first big league at-bat — nerves, crowd, cameras
- **Walkoff opportunity:** Bottom 9th, tie game, you're up
- **Must-win pitch:** Bases loaded, 3-2 count, season on the line

**After each moment:** Event popup with consequences:
- Won the championship → reputation boost, teammate bonds strengthen, scout grades up
- Struck out in the showcase → scout interest drops, confidence dips, but resilience builds
- Hit a walkoff → career-defining moment, endorsement offers, media frenzy

---

## 4. The Decision Event System (CK2-style)

Between Big Game Moments, life decisions arrive as event popups.

**Format:**
```
[ICON] [TITLE]
[Description of situation]

[Choice A] → [Visible consequences]
[Choice B] → [Visible consequences]
[Choice C] → [Hidden consequences — "???" for dramatic choices]
```

**Example events by stage:**

**Little League:**
- "Travel Ball Tryout" — Make the competitive team (+development) or stay rec league (+fun, +family time)
- "The Bully" — Bigger kid picks on you. Stand up (aggression +, respect +) or walk away (composure +)

**High School:**
- "College Scout at the Game" — Swing for power (risky, high reward if HR) or play it safe (bunt, move runner)
- "Party Invite" — Go to the party (social +, risk of scandal) or stay home and train (work ethic +)
- "Football Offer" — Starting QB vs. baseball. Family conversation. Multi-step decision chain.

**College:**
- "Summer League or Go Home" — Cape Cod (development ++) or go home (family +, rest +)
- "Leave Early for Draft?" — Junior year, projected 2nd round. Stay or go?
- "Professor Needs Your Paper" — Study (GPA safe, education backup) or skip for extra BP

**Minor Leagues:**
- "Bus Broke Down" — Team bonding moment or everyone's miserable (personality event)
- "Your Agent Calls" — Trade rumors. Do you demand a trade or stay loyal?
- "Teammate's Struggling" — Help him (mentor +, leadership +) or focus on yourself

---

## 5. Technical Architecture

### New Components
- `CareerStageComponent`: current stage, years in stage, key milestones
- Extend `CareerComponent`: add detailed stage history with events/outcomes

### New Systems
- `BigGameMomentSystem`: generates moments based on season sim results
- `CareerStageSystem`: manages stage transitions, development rates per stage
- Extend `LifeEventSystem`: stage-specific event pools

### New UI
- `CareerStageTimeline`: visual timeline showing all stages with key moments highlighted
- `BigGameMomentPage`: the playable moment (reuses existing LiveGamePage mechanics but for a single at-bat/pitch situation)
- `DecisionEventModal`: CK2-style popup with choices and consequences

### Sim System
Each stage has a `simStage()` function:
- Generates stats based on attributes + randomness
- Triggers 0-3 Big Game Moments (skippable if simming)
- Generates 2-6 Decision Events (auto-resolved if simming based on personality)
- Develops attributes toward potential
- Returns stage summary with key stats and story beats

---

## 6. Success Criteria

1. Player can start at age 12 and play to owner (40+ year arc)
2. Every stage is skippable (sim in seconds) or playable
3. Big Game Moments feel impactful — the outcome matters
4. Decision events create genuine dilemmas with cascading consequences
5. A high school → college → MLB career feels different from high school → draft → minors
6. The same player played twice generates a different story each time
7. Personality traits formed in Little League affect decisions available in the MLB
8. Total playthrough time: 30 min (all sim) to 10+ hours (play everything)
