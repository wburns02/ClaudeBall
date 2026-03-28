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

## 6. Time Management (Evolves With Age)

The schedule system GROWS UP with the player:

| Stage | Time System | Why |
|-------|-----------|-----|
| Little League (12-14) | **Key moments only** — events pop up every few weeks | You're a kid. Stuff just happens. |
| High School (15-18) | **Seasonal blocks** — pick 2-3 focuses per season | Starting to make real choices. |
| College/Minors (18-25) | **Weekly planner** — allocate time to activities | The professional grind. Every hour matters. |
| MLB+ (25+) | **Seasonal blocks** — offseason planning + organic events | Established. Offseason is the decision point. |

### Daily Decision Examples (all compound over years)

| Choice | Impact |
|--------|--------|
| Extra wiffle ball reps | Contact +1, Work Ethic +1 |
| Play video games | Eye +0.5 (hand-eye!), Work Ethic -1 |
| Hang with friends | Charisma +1, Clubhouse Rep +1, no physical dev |
| Study | Baseball IQ +1, education backup, no physical dev |
| Weight room | Power +1, Injury Risk +0.5 |
| Yoga/stretch | Potential +0.5, Injury Risk -1 |

### Overtraining & Burnout (Triple Penalty)

**Burnout meter:** Hidden fatigue builds when you always pick training.
- Threshold hit → injury or development stall
- Forces variety — can't just grind reps forever

**Diminishing returns:** Same activity repeated gives less each time.
- 1st session: +2. 2nd: +1.5. 3rd: +1. 4th: +0.5.
- Variety is mathematically optimal

**Relationship decay:** Overtraining = never spending time with people.
- Family relationship drops if you skip family time for years
- Friendships decay without maintenance
- A lonely burned-out prodigy: 80 contact, 20 charisma, no friends
- Can trigger depression event → spiral → early retirement

---

## 7. Family System

### Generation Flow

1. **Pick family archetype** (sets the tone):
   - Baseball Family (dad played minors, brother in college ball)
   - Blue Collar (hard-working, modest income, grounded values)
   - Military (discipline, moves every 2 years, different schools/teams)
   - Single Parent (financial pressure, deep emotional bond, chip on shoulder)
   - Immigrant (language barriers, cultural pride, sending money home)
   - Wealthy (all access, private coaches, but less hunger)
   - Broken Home (divorce, custody battles, instability fuels drive)

2. **Customize key members** — Dad and Mom generated from archetype with tweakable personality (supportive/tiger/absent), career, relationship with you.

3. **Rest generates randomly** — Siblings, grandparents, extended family fill in. Each gets a **story hook**:
   - Older brother who flamed out in AA (pressure to succeed where he failed)
   - Little sister who idolizes you (motivation, her drawings on your locker)
   - Grandpa who played in the Negro Leagues/Dominican Winter League (wisdom, legacy)
   - Uncle who's a high school coach (connection, training access)
   - Cousin who's in trouble (financial drain? or motivation?)

### Family as NPCs

Each family member has:
- Name, age, personality traits
- Relationship affinity with you (-100 to +100)
- Story hook (one defining characteristic that generates events)
- Career/life that progresses in parallel (siblings grow up, parents age)

### Key Family Moments

- Mom working double shifts to pay for travel ball → you feel the pressure
- Dad and you play catch in the backyard → relationship + training
- Parents argue about your future → divorce risk event
- Signing bonus moment: hand your parents a check → emotional peak
- Years later: buy your mom a house → prestige milestone

---

## 8. Geography System

Where you grow up affects EVERYTHING:

| Region | Baseball Culture | Development | Scouts | Weather | Special |
|--------|-----------------|------------|--------|---------|---------|
| Southern California | Elite travel ball, year-round | +development speed | High scout exposure | Year-round training | Expensive, competitive |
| Texas | Football-first culture, HS baseball strong | Balanced | Good exposure | Hot summers | Two-sport pressure |
| Florida | Baseball factories, showcases HQ | +development | Max scout exposure | Year-round | Showcase culture |
| Dominican Republic | Informal training, buscones, academies | Raw tools develop fast | International scouts | Year-round | Poverty → hunger, broomstick training |
| Japan | Structured, discipline-heavy | +control, +fundamentals | NPB scouts, later MLB | Seasonal | Culture of respect, slower path to MLB |
| Puerto Rico | Proud baseball tradition | Balanced | Good exposure | Year-round | Bilingual advantage |
| Northeast | Short seasons, tough conditions | Slower development | Lower exposure | 6-month season | +Mental toughness |
| Midwest | Small-town baseball, less competition | Slower but steady | Low exposure | 6-month season | Under-the-radar, chip on shoulder |
| Venezuela | Academy system, passionate culture | Raw tools | International scouts | Year-round | Economic instability events |

**Gameplay impact:**
- Warm weather: year-round training = +15% development speed
- Cold weather: 6-month season = -10% development but +5 mental toughness
- Big city: more scouts = earlier draft attention
- Small town: less competition = inflated stats but less exposure
- International: different path entirely (academies, international signing period, visa events)

---

## 9. Financial System (From Childhood)

Money is real from day one.

### Family Income Tiers

| Tier | Annual Income | Baseball Access | Story Tone |
|------|-------------|-----------------|-----------|
| Poverty (<$25K) | Can't afford travel ball, used equipment, walks to practice | Scrappy underdog, community rallies around you |
| Working Class ($25-60K) | Parents sacrifice for one travel team, basic gear | Grateful, pressure to justify family investment |
| Middle Class ($60-120K) | Travel ball covered, decent gear, summer camps | Normal path, balanced |
| Upper Middle ($120-250K) | Private coaches, elite travel teams, showcase circuit | All access, but "rich kid" stigma possible |
| Wealthy ($250K+) | Everything. Best coaches, best facilities, best exposure | No excuses — pressure to deliver on investment |

### Money Events by Stage

**Little League:** "Travel ball costs $3,000 this summer. Your family can't afford it."
- Choice: Skip it (miss development) / Mom picks up extra shifts (guilt + relationship) / Find a sponsor (community event)

**High School:** "Showcase fee is $500. Your gear is falling apart."
- Choice: Skip showcase (miss scout exposure) / Work a summer job (time away from training) / Coach finds scholarship

**Draft Day:** "First round pick. $2.5M signing bonus."
- What do you do with the money? Pay off parents' house / Invest wisely / Buy a car and go crazy / Split with family
- This choice sets the tone for your ENTIRE financial career

**The Check Moment:** AI-generated conversation. You call your mom:
> "Mom... I made it. I'm going to take care of us. All of us."
> She's crying. Your dad is quiet. Your little sister screams.

This is the emotional peak of the game.

---

## 10. Persistent NPC World (CK2 Core)

### Everyone Lives

ALL NPCs continue existing throughout the entire game. They have their own careers, families, and stories running in parallel.

**Your Little League team:**
- Most quit baseball by high school
- 2-3 play high school ball
- 1 maybe plays college
- 1 in 50 makes the minors
- You might face your childhood friend in the World Series 20 years later

**Tracking:**
- Each NPC has: current age, current role (playing/coaching/retired/non-baseball), career stats, relationship with you
- NPCs text you, call you, show up at events
- "Hey, it's Danny Reeves. We played travel ball when we were 13. I'm coaching HS now. I've got a kid you need to see."

**Rival arcs span decades:**
- Age 12: kid beats you in Little League championship
- Age 16: you face him in state semifinals — you win
- Age 22: he's drafted by the same organization, different level
- Age 28: he's a journeyman reliever — you face him in the playoffs
- Age 35: he's retired, becomes a scout, recommends a prospect to you
- Age 45: you hire him as a coach on your staff

**The world remembers everything.**

---

## 11. Narrative Journal ("My Story")

### Auto-Generated Biography

As you play, the game writes your story in prose. A "My Story" page accumulates chapters:

**Chapter 1: The Beginning**
> "Will Burns grew up in San Pedro de Macorís, the youngest of three brothers. His grandfather Tomás played in the Dominican Winter League in the 1960s and taught Will to hit with a broomstick and a bottle cap before he could read..."

**Chapter 5: The Decision**
> "The scout from the Austin Thunderhawks sat in the bleachers at Estadio Tetelo Vargas. Will went 3-for-4 with a home run that cleared the palm trees beyond right field. That night, his mother's phone rang..."

**Chapter 12: The Call**
> "At 7:42 AM on a Tuesday in July, the phone rang in a cramped AAA apartment in Memphis. 'Pack your bags, kid. You're going to Austin.' Will Burns sat on the edge of his bed and cried."

**Chapter 20: The Owner**
> "Forty years after hitting bottle caps with a broomstick in San Pedro, Will Burns signed the papers that made him the owner of the Austin Thunderhawks. In the front row of the press conference sat his mother, his brother Danny, and his Little League coach, Mr. Reyes. All three were crying."

### Features:
- Auto-generated after each major milestone
- Includes key decisions and their outcomes
- References NPCs by name with relationship context
- Shareable — export as text/PDF
- Every playthrough generates a completely different story

---

## 12. Success Criteria (Updated)

1. Player can start at age 12 and play to owner (40+ year arc)
2. Every stage is skippable (sim in seconds) or playable
3. Big Game Moments feel impactful — the outcome matters
4. Decision events create genuine dilemmas with cascading consequences
5. A high school → college → MLB career feels different from HS → draft → minors
6. The same player played twice generates a different story each time
7. Personality traits formed in Little League affect decisions available in the MLB
8. Total playthrough time: 30 min (all sim) to 10+ hours (play everything)
9. Family members are persistent NPCs with their own stories
10. Geography meaningfully affects development path and story
11. Financial decisions from childhood compound across the entire career
12. The signing bonus moment makes the player emotional
13. Childhood rivals and friends appear throughout the career
14. The narrative journal produces a unique, readable biography
15. Overtraining has real consequences (burnout, relationship decay, injury)
