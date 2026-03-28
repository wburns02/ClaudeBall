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

## 12. Career Longevity + Comeback System

### Playing Into Your 40s

A player who invests in their body from age 15 can play into their late 40s:

**Longevity factors (compound over career):**
| Factor | Effect | How |
|--------|--------|-----|
| Yoga/flexibility (annual) | +1 career year per 3 seasons | Reduces age-related decline curve |
| Nutrition plan (annual) | +1 career year per 2 seasons | Body composition stays optimal |
| Sports science (annual) | +1 career year per 3 seasons | Biomechanics optimized |
| No major injuries | +3-5 career years | Clean medical record |
| Position switch to DH/1B | +2-3 career years | Less wear on body |
| Reinvent game (power→contact) | +2-3 career years | Adapt to aging body |
| Work ethic trait (70+) | Passive longevity bonus | Consistent maintenance habits |

**Maximum career:** A player who does EVERYTHING right since HS could play to age 46-47 (Nolan Ryan territory). Average career ends at 34-36. Players who abuse their bodies (overtraining, partying, ignoring rehab) flame out by 30.

### The Comeback Arc

Career-threatening injury doesn't mean career over. The comeback path:

1. **Injury occurs** — surgery + standard rehab (6-18 months depending on severity)
2. **Current ratings DROP** — speed -10 to -20, relevant tools decline
3. **Potential stays** — the ceiling doesn't lower (unless catastrophic)
4. **Rehab decisions** — affects recovery speed and completeness:
   - Standard rehab only (slow, conservative, safe)
   - Standard + enhancement therapy (faster, see below)
   - Rush back (fast but high re-injury risk)
5. **Prove yourself** — play internationally or independent league
   - Dominican Winter League
   - Mexican League
   - Atlantic League (independent)
   - KBO/NPB stint
6. **Get noticed** — good stats → AAA invite → September callup
7. **The Return** — changed player, less tools, more wisdom. Standing ovation.

The narrative journal writes:
> "They said Will Burns would never play again after the torn ACL in 2034. Two years later, after a stint in the Dominican Winter League and 47 games in AAA Memphis, he walked into the Austin Thunderhawks clubhouse for the second time. The ovation lasted three minutes."

### The Enhancement Spectrum

Recovery and performance enhancement exists on a spectrum from completely legal to career-ending. **Money is the biggest factor** — especially pre-MLB.

#### Tier 1: Fully Legal (Available Everywhere)
| Treatment | Cost | Effect | Access |
|-----------|------|--------|--------|
| Creatine + protein | $50/month | +1-2 power/stamina | Anyone |
| Over-the-counter supplements | $100/month | +1 recovery speed | Anyone |
| Ice bath / compression | $0-200 | Injury prevention | Most facilities |
| Physical therapy (standard) | $150/session | Standard rehab | Insurance covers for pros |

#### Tier 2: Legal But Expensive (Money-Gated)
| Treatment | Cost | Effect | Access |
|-----------|------|--------|--------|
| PRP injections (platelet-rich plasma) | $500-2,000 | +3-4 healing speed, joint preservation | US clinics, cash pay |
| BPC-157 peptide therapy | $300-800/month | +3-5 healing, tendon repair | US peptide clinics |
| TB-500 peptide therapy | $200-600/month | +2-4 tissue repair, inflammation | US peptide clinics |
| Stem cell injections | $5,000-15,000 | +5-8 healing, potential ceiling preservation | US regenerative clinics |
| Hyperbaric oxygen therapy | $200/session | +2 recovery speed | Specialty facilities |
| Cryotherapy chambers | $50-100/session | +1 recovery, inflammation | Sports facilities |
| Personal biomechanics lab | $2,000-5,000/year | Injury prevention, efficiency | Elite facilities |

**The money gate:** A kid in A-ball making $2,000/month CAN'T AFFORD stem cells ($15K). He gets ice and ibuprofen. A major leaguer making $5M/year flies to a regenerative clinic without thinking. **Wealth = access to recovery = longer career.**

Decision event for a minor leaguer with a torn UCL:
> "Dr. Martinez in Miami does stem cell + PRP for $12,000. Your insurance won't cover it. Your signing bonus is gone. Mom could maybe borrow against the house..."
> - Borrow the money (family financial stress, but faster/better recovery)
> - Standard surgery only (Tommy John, 12-18 month rehab, traditional path)
> - Ask the team to pay (they might say no, or they might invest in you)

#### Tier 3: Legal Gray Area (Not Banned... Yet)
| Treatment | Cost | Effect | Risk |
|-----------|------|--------|------|
| HGH for recovery (with medical need) | $1,000-3,000/month | +5-8 healing, +2 power, muscle preservation | Needs TUE from MLB, scrutiny |
| Offshore stem cell clinics (DR, Panama, Mexico) | $3,000-10,000 | +5-10 healing, potential ceiling restoration | Not FDA approved, media exposure risk |
| Gene therapy (experimental) | $20,000-50,000 | Unknown/massive potential | Completely unregulated, could be banned retroactively |
| Peptide stacking (multiple compounds) | $1,000-3,000/month | +5-8 recovery + performance | Legal today, might not be tomorrow |

**The drama:** You fly to a clinic in Panama City for stem cell therapy on your shoulder. It works miraculously — your arm feels 25 again. Two years later, MLB announces they're investigating "offshore medical tourism by active players." You're on a list.

Decision chain:
> Step 1: Your agent mentions a clinic in Panama. "Completely legal. Players go all the time."
> Step 2: You fly there. Treatment works. Arm feels incredible.
> Step 3: ESPN reports MLB is investigating offshore clinics.
> Step 4: Your name appears in leaked documents.
> Choice: Come forward proactively (media rep hit, but integrity preserved) OR deny everything (50/50 it blows over or explodes)

#### Tier 4: Banned Substances
| Substance | Effect | Penalty | Legacy Impact |
|-----------|--------|---------|--------------|
| Anabolic steroids | +10-15 power/speed, recovery halved | 80-game suspension (1st), 162 (2nd), lifetime (3rd) | HOF denied, asterisk on records |
| Testosterone | +8-12 power, energy, recovery | Same as steroids | Same |
| EPO (blood doping) | +10 stamina, endurance | 80-game suspension | Reputation destroyed |
| Amphetamines | +5 focus, reaction time | 80-game suspension | Minor stigma (historically common) |

**Pre-MLB PED decisions are different:**
- High school: teammate offers "supplements" before a showcase. Do you take them?
- College: culture of pill-sharing in the locker room. Adderall before games.
- Minors: desperate to get called up. A teammate who made the jump says "this is what I did."

Each decision at each stage has different consequences:
- HS: no testing → no suspension risk, but habit forms
- College: NCAA testing → potential suspension and scholarship loss
- Minors: MLB testing begins → real career risk
- MLB: full testing program → 80-game suspension, public shame

**The PED temptation scales with desperation:**
- Healthy star player: low temptation (why risk it?)
- Aging player losing a step: moderate temptation
- Player returning from injury, career on the line: HIGH temptation
- Minor leaguer who's been in AAA for 4 years, watching younger guys pass him: HIGHEST temptation

---

## 13. Success Criteria (Updated)

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
16. Players who invest in their bodies can play into their late 40s
17. Comeback arc works: injury → rehab → international ball → minors → MLB return
18. Enhancement spectrum creates real moral dilemmas gated by money and desperation
19. PED temptation scales with career stage and personal circumstances
20. The same injury at different wealth levels has completely different recovery paths

---

## 14. The Politics System

Merit isn't always enough. The real world has gatekeepers, favorites, and bullshit.

### How Politics Manifest

**Youth baseball (12-18):**
- Travel ball coach plays favorites — the kid whose dad is an assistant coach gets more reps
- All-star team selection: politics over performance. The coach's buddy's kid makes the team over you.
- Showcase invitations sometimes go to connected families, not the best players
- Decision: accept it quietly (composure +, but simmering resentment) or call it out (media attention, burned bridges, respect from some, enemies from others)

**College:**
- Recruiting: some coaches recruit based on relationships with HS coaches, not just talent
- Playing time: transfer portal politics, freshman vs. senior dynamics
- Summer league assignments: connected players get Cape Cod, you get Northwoods

**Minor leagues:**
- Organizational favorites: first-round picks get more chances than late-rounders
- You're better than the guy above you on the depth chart, but he cost $3M to sign
- Manager's relationship with you determines playing time (coach personality matters)
- The "prospect vs. suspect" label: once you're labeled "organizational depth," it's nearly impossible to shed

**MLB:**
- All-Star voting: popularity contest. Big market players get votes over small market guys with better stats.
- Award voting: media bias toward certain cities, narratives, and players they like
- Front office politics: GM has "his guys" — players he drafted/traded for get longer leashes
- CBA politics: union rep decisions, labor disputes

**National team / international:**
- Selection based on club affiliation, not merit
- Coaches pick players they know from their own programs
- Financial barriers to tryout camps (travel, housing, time off work)
- Decision: burn money you don't have for a CHANCE at selection, or accept that the system is rigged

### The Bullshit Moment

An event that captures the feeling of being objectively better but passed over:

> **TRYOUT RESULTS**
> You performed in the top 5% of all players at the Western Regional Trial.
> Sprint time: 2nd fastest. Hitting: 3rd overall. Fielding: top rated.
>
> **You were not selected.**
>
> The 4 players selected were all from the Denver program.
> The head coach is a former Denver coach.
>
> Choice:
> - Accept it and move on (composure +5, resentment building)
> - Confront the coach publicly ("This is bullshit") — media covers it, reputation +10 with fans, -30 with establishment
> - Channel it into fuel (work ethic +5, motivation event triggers)
> - Give up on this path (depression risk, but opens different door)

### Connections System

Every NPC has a **connections web**. Coaches hire people they know. GMs draft players their scouts recommend. Scouts recommend players from programs they have relationships with.

You can BUILD connections:
- Attend camps run by specific coaches
- Build relationships with scouts who visit your games
- Network at showcases and events
- Your family's connections open doors (baseball family archetype advantage)

Or you can LACK connections:
- Small town, no travel ball = no scout relationships
- Immigrant family with no baseball network in the US
- Transferred schools = lost all local connections

The politics system means TALENT ALONE isn't always enough. You need talent + timing + connections + a little luck. Just like real life.

---

## 15. The Identity Crisis System

When sports end — whether by choice, injury, or age — your character doesn't just lose stats. They lose who they ARE.

### The Void

When a player retires or is forced out:

**Phase 1: The Void (0-6 months)**
- UI literally changes: colors desaturate, fewer events pop up
- No Big Game Moments. No crowd noise. No adrenaline.
- Daily choices become mundane: "What do you do today?" → Watch TV / Go to the gym / Stare at your phone / Call an old teammate
- Morale drops weekly. Composure tested.
- Family notices: "You're different since you stopped playing."

**Phase 2: The Search (6-18 months)**
- Random discovery events start appearing based on personality:
  - High Baseball IQ: "A local high school asked if you'd help coach..."
  - High Charisma: "A TV station asked if you'd do color commentary..."
  - High Work Ethic: "You've been going to the gym religiously. A trainer asks if you want to get certified..."
  - High Aggression: "You picked up boxing/MMA. It scratches the competitive itch."
  - Low everything: "You've been drinking more. Your wife is worried."

**Phase 3: The New Identity (18+ months)**
- If you find something: mood recovers, new career path opens, UI brightens
- If you DON'T find something: depression deepens, substance abuse risk, relationship strain, potential divorce event
- The game doesn't force a happy ending. Some players never find their second act.

### The Second Sport Discovery

Like finding rugby after football — the game should allow discovering a new competitive outlet:

- Coaching youth baseball → feels meaningful, uses your knowledge
- Beer league softball → scratches the itch, low stakes, fun with friends
- Competitive fishing/golf/boxing → new challenge, different identity
- Business venture → channel competitive energy into building something
- Broadcasting → stay connected to the game without playing

Each option has its own mini-progression. Coaching leads to the front office pipeline. Broadcasting leads to media career. Business leads to the owner path.

### The Comeback Decision

At ANY point during the identity crisis, if your body is recovered enough:

> "You've been throwing in the backyard. Your arm feels... good. Better than it should."
>
> Choice:
> - Pursue a comeback (enters the comeback arc: international → indie → minors → MLB)
> - It's just nostalgia. Stay retired. (Safe, but the dream dies)
> - Play semi-pro/beer league (casual competitive outlet, no pressure)

The comeback path is THE most dramatic storyline in the game. The narrative journal writes:

> "For three years after the injury, Will Burns was lost. He coached little league on Saturdays and pretended to be okay. Then one morning in January, he threw 50 pitches in the backyard and realized his arm didn't hurt. For the first time in three years, he smiled."

### The Ugly Ending

Not every story has a happy ending. The game should allow:

- Player who never finds a second act → spirals into depression, substance abuse
- Player who can't stop chasing the comeback → embarrassing failed attempts, burns through savings
- Player who refuses to accept reality → takes bad contracts, gets DFA'd repeatedly, media mocks him
- Player whose body is done but mind won't accept it → the saddest story

These aren't punishments. They're REAL. And the narrative journal captures them honestly:

> "Will Burns spent four years trying to come back. Each time, the arm gave out a little sooner. At 43, sitting alone in an independent league clubhouse in Lancaster, Pennsylvania, he finally accepted what everyone else already knew. The game was over. This time for real."

---

## 16. The Daily Grind Engine (Post-Baseball Gameplay)

The game doesn't end when baseball ends. It EVOLVES. Your daily schedule becomes the gameplay.

### The Week Planner

At 35+, whether retired from MLB or grinding a comeback, you build your week:

| Time Slot | Options | Energy Cost | What It Builds |
|-----------|---------|------------|---------------|
| 4:30-5:30 AM | Early rise + meditation / Sleep in | -1 energy, +1 discipline / +1 recovery | Mental toughness, work ethic rep |
| 5:30-7:00 AM | Workout / Yoga / Run / BJJ | -2 to -3 energy | Physical maintenance, sport skills |
| 7:00-5:00 PM | Day job (multiple options) | Time, -2 energy | Income, career progression, work relationships |
| 5:00-7:00 PM | Sport practice / Family time / Networking | -2 energy | Competition, bonds, connections |
| 7:00-9:00 PM | Second workout / Family / Rest / Study | -1 to -2 energy | Double-day bonus OR relationship maintenance |
| 9:00-10:00 PM | Wind down | — | Recovery prep |

**Energy system:** You have 10 energy per day. Each activity costs energy. Two-a-days cost 5-6 total. Three-a-days cost 7-8 — doable, but you're running on fumes the next day. Sleep recovers 8 energy. Bad sleep (stress, overtraining) recovers only 5-6.

**The trade-off is ALWAYS time:** Train more → less family time → wife gets upset. Work overtime → more money → less training → body deteriorates. Skip work to train → income drops → financial stress → marriage strain.

**Two-a-days and three-a-days:**
- Day 1: Morning workout + evening rugby practice = two-a-day. Energy cost 5.
- Day 2: Morning run + afternoon jiu-jitsu + evening sprint work = three-a-day. Energy cost 8. Tomorrow you're wrecked.
- Sustaining this for weeks: Work Ethic must be 65+. Discipline personality trait matters. Body maintenance (yoga, nutrition) prevents breakdown.
- The game rewards the grind — but only if you've built the foundation to sustain it.

### Day Jobs

Your career doesn't stop. What you do 9-to-5 matters:

| Job | Income | Energy Cost | Perks | Requirements |
|-----|--------|------------|-------|-------------|
| Youth baseball coach | Low ($40K) | Low | Mentor relationships, stays in the game | Baseball IQ 50+ |
| High school coach | Medium ($55K) | Medium | Prospect discovery, community rep | Leadership 55+, connections |
| Scout (part-time) | Medium ($60K) | Low-Medium | Uses scouting intelligence, travel | Baseball IQ 60+, org connection |
| Broadcaster (local) | Medium ($70K) | Medium | Media rep, stays visible | Charisma 60+ |
| Broadcaster (national) | High ($150K+) | High | Fame, endorsements, media empire | Charisma 70+, MLB career required |
| Business owner | Variable | High | Wealth building, independence | Financial literacy, capital |
| Personal trainer | Medium ($50K) | Medium | Stays fit, helps others, flexible schedule | Fitness knowledge |
| Front office (assistant) | Medium ($80K) | High | GM pipeline, insider knowledge | Baseball IQ 65+, connections |
| Real estate | Variable | Medium | Wealth building | Capital, charisma |
| "Figuring it out" | None | Low | Free time to train, but no income | Savings only |

The day job interacts with EVERYTHING:
- Coach discovers a prospect → scouting intelligence event
- Broadcaster interviews your old rival → relationship event
- Business fails → financial crisis → affects training budget
- Front office job → inside track to GM role

### Holding a Job + Competing

The ultimate achievement: maintain a career AND compete at a high level.

A 42-year-old who wakes up at 4:30 AM, works a full day, trains twice, and still outperforms college kids on the rugby pitch — that's not just a stat line. That's a CHARACTER who's been built through 30 years of decisions.

The game tracks this with a **Life Balance Score:**
- Physical: Are you training enough to compete?
- Professional: Are you meeting job responsibilities?
- Relationships: Are you present for the people who matter?
- Mental: Are you sleeping enough, managing stress?

All four need to stay above 40% or consequences cascade. The GRIND is maintaining all four simultaneously. Most people let one or two slide. The ones who keep all four high? They're the legends.

---

## 17. The Second Career Competition System

After baseball, competitive fire doesn't die. It finds a new outlet.

### Available Sports (unlocked based on geography, personality, age)

| Sport | Key Attributes | Progression | Big Game Moments |
|-------|---------------|-------------|-----------------|
| **Rugby** | Speed, Power, Toughness | Club → competitive → national pathway | Championship match, national trial |
| **Softball** | Contact, Power | Beer league → competitive → senior tournaments | Tournament championship, HR derby |
| **Boxing/MMA** | Power, Speed, Composure | Gym → amateur bouts → competitive circuit | First fight, title bout |
| **Golf** | Eye, Composure | Casual → club championship → senior tour | Club championship, qualifying tournament |
| **Jiu-jitsu** | Flexibility, IQ, Composure | White → blue → purple → brown → black belt | Belt promotion, tournament |
| **Marathon/Triathlon** | Stamina, Work Ethic | Training → local races → qualifying events | Race day, qualifying attempt |
| **CrossFit** | Power, Stamina, Speed | Box → local comp → regionals → masters | Competition day |

### Attribute Transfer

Baseball skills partially translate:
- Speed → rugby wings, track events
- Power → rugby forward, boxing, softball
- Hand-eye → golf, softball, boxing
- Composure → any high-pressure competition
- Work ethic → EVERYTHING
- Flexibility (from yoga) → jiu-jitsu, longevity

But you start at the BOTTOM in the new sport. The humility is real:

> **FIRST DAY EVENT: Jiu-Jitsu**
> "You walked into the gym in your new white belt. A 22-year-old purple belt submitted you in 30 seconds. Then did it again. And again.
>
> For the first time in 20 years, you were the worst person in the room.
>
> And somehow... it felt amazing."
>
> Choice:
> - "I love this. I'm coming back tomorrow." (New sport unlocked, commitment +)
> - "This isn't for me." (Try something else)
> - "I'm going to get good at this." (Obsession risk — overtraining possible)

### Mini-Progression Per Sport

Each sport has:
- Skill ratings (separate from baseball, start low)
- Ranking/belt system with milestones
- NPC relationships (training partners, coaches, rivals)
- Big Game Moments (tournament finals, belt tests, championship matches)
- Decision events (push through injury? Enter a higher division? Travel for competition?)

The progression creates NEW stories layered on top of the baseball story. Your jiu-jitsu coach doesn't care about your MVP awards. Your rugby teammates know you as "the old guy who's weirdly fast."

### Competing Against Younger Athletes

At 40+, you're not the most athletic person anymore. But you're the smartest.

The game models this:
- Physical tools decline (speed, power slow down)
- Mental tools INCREASE (composure, IQ, leadership compound)
- Experience creates shortcuts: you read the play before it happens
- Your body can sustain the grind IF you've invested (yoga, nutrition, sports science)

The joy of scoring a try against a 22-year-old who's faster than you — because you read his angle and cut back — that's a Big Game Moment that triggers a life event:

> "The college kid had 3 steps on you. Everyone saw it. But you read the angle, planted your foot, and somehow got there first. The try went to the old man. Your teammates mobbed you. The college kids just stared.
>
> Your phone buzzed after the game. Your daughter texted: 'Mom showed me the video. You're insane. 😂💪'"

---

## 18. Relationships Are The Game

By year 30+, the reason you keep playing isn't stats or competition. It's PEOPLE.

### The Phone

Your phone is the relationship hub. Throughout every day, messages arrive from NPCs you've known across your life:

**Types of messages:**
- **Check-ins:** "How you doing, man? Haven't talked in a while." (Relationship maintenance)
- **News:** "Did you see Danny got the coaching job at State?" (World is alive)
- **Advice:** "My son wants to quit travel ball. What should I tell him?" (You're the mentor now)
- **Invitations:** "Reunion game this Saturday — the old travel ball team. You in?" (Event trigger)
- **Crisis:** "I need to talk. Things aren't good at home." (Deep relationship moment)
- **Celebration:** "I GOT THE JOB! Thanks for the recommendation." (Your influence matters)
- **From your kids:** "Dad, I made the varsity team!!" (Generational payoff)

Each message is a choice: respond or ignore. Respond = relationship maintained. Ignore = slow decay. But you can't respond to everyone — there are only so many hours.

### The Generational Payoff

Your KIDS inherit your world:
- Son wants to play baseball → do you push him (tiger parent) or let him find his way?
- Daughter makes varsity softball → do you coach her team or just be a supportive dad?
- Nephew gets drafted → he calls you for advice. Your relationship with your brother determines whether he listens.
- Your kid's travel ball coach is terrible → do you intervene (politics!) or let it play out?

**The ultimate moment:** Your child gets drafted. The narrative journal writes:

> "With the 47th pick in the 2058 MLB Draft, the Nashville Sounds select... Maria Burns, shortstop, University of Texas. In the living room in Austin, Will Burns watched his daughter's name appear on the TV screen and felt something he hadn't felt since his own draft day 36 years ago. She turned to him with tears in her eyes. 'We did it, Dad.' He couldn't speak."

### The Mentor Tree

Everyone you've helped remembers:
- The rookie you mentored at 28 is now a manager. He names you as his biggest influence.
- The prospect Danny told you about? You scouted him. He credits you in his Hall of Fame speech.
- Your jiu-jitsu white belts are now purple belts. They call you "coach."
- The high school kid you coached is now in the minors. He texts you after every game.

Each mentoring relationship compounds your **legacy score** in the prestige engine. You don't need championships for a great legacy — you need IMPACT.

### The Legacy Web

By your 50s, your life is a web of hundreds of relationships across decades:

- **Family:** Parents (aging), siblings, spouse, kids (growing up), nieces/nephews, grandkids
- **Baseball:** Former teammates (scattered across baseball), front office contacts, scouts, coaches
- **Second sport:** Rugby/BJJ/golf mates, coaches, training partners, rivals turned friends
- **Community:** People in your city who know you as a local legend
- **Protégés:** Every person whose career you influenced

The narrative journal at age 52:

> "At 52, Will Burns was no longer the fastest guy on the rugby pitch. But he was the most respected. The college kids called him 'Unc' and asked about the MLB days between drills. On Tuesday nights he taught jiu-jitsu to beginners — mostly parents from his daughter's school. On weekends he scouted for the Thunderhawks, the team he'd played for and would one day own. His phone rang constantly. Danny Reeves about another prospect. His mom reminding him to eat. His wife asking if he'd be home for dinner. His daughter FaceTiming from college to show him her dorm. At 52, Will Burns had never been busier. And never been happier."

---

## 19. Passing The Torch (CK2 Succession)

The capstone feature. When your character's story ends — or whenever you choose — you can **become someone your character shaped.** The world continues. The legacy transfers. The story evolves.

### How It Works

At any point after your character reaches age 30+ (or after retirement/identity crisis), a new option appears:

> **PASS THE TORCH**
> "Your story doesn't have to end. But it can change perspective."
> Choose someone whose life you've influenced to continue the story through their eyes.

### Who You Can Become

**Tier 1: Blood (your children)**
- Your daughter who followed you into baseball
- Your son who chose a different sport
- Your nephew who you mentored from afar
- Prerequisite: relationship affinity 50+ with the child, they must be age 14+
- **Advantage:** Deepest connection. Your original character becomes a parent NPC who calls before big games, gives advice, shows up to watch. The family bond is the core storyline.

**Tier 2: Protégés (players you developed)**
- The prospect you discovered and mentored
- The minor leaguer you coached in high school
- The international kid whose family you convinced to choose baseball
- Prerequisite: mentor relationship established, invested 3+ seasons of mentoring
- **Advantage:** You shaped their skills. Their development reflects YOUR coaching choices. But they have their own personality — they might rebel against your methods.

**Tier 3: Coaching Tree (coaches/staff you trained)**
- Your assistant coach who learned your system
- The scout you hired and trained
- The GM you groomed as your successor
- Prerequisite: professional relationship, worked together 2+ seasons
- **Advantage:** They inherit your organizational philosophy. Start at a higher career stage (skip player career, start as coach/scout/GM).

**Tier 4: The Stranger (wildcard)**
- A random 12-year-old in your city who idolizes you
- A kid from the Dominican who saw your highlight reel on YouTube
- Someone with NO connection to you — fresh start in the same world
- Prerequisite: none
- **Advantage:** Completely different perspective. Your original character exists as a legend in the world — posters, references, records to chase.

### The Transition

When you pass the torch:

1. **Choose your successor** from available candidates
2. **Final chapter writes:** The narrative journal closes your character's story with a final entry.
   > "Will Burns stepped away from the game at 54. Not because his body gave out or his mind wandered — but because he saw something in Maria's eyes that he recognized. The same fire. The same hunger. It was her turn now."

3. **Perspective shifts:** You now control the successor. New character creation screen shows their current attributes, relationships, and stage.

4. **Your original character becomes an NPC:**
   - They call you. They text you. They show up to your games.
   - Their personality drives their NPC behavior (tiger parent? supportive mentor? absent legend?)
   - They age. They might get sick. They will eventually die. That's a life event for your new character.
   - "Your father passed away at 78. The funeral was attended by 400 people. Former teammates, coaches, players he'd mentored, and the entire city of Austin."

5. **The world remembers everything:**
   - Records your original character set still exist
   - NPCs reference your original character: "Your dad was the toughest player I ever saw."
   - The franchise your original character built/owned continues
   - Rivalries transform: your dad's rival might become YOUR mentor, or your enemy

### Multiple Successions

You can pass the torch MORE THAN ONCE. A three-generation dynasty:

**Generation 1: Will Burns (2014-2054)**
- Little League → MLB → Owner
- 40-year career arc, bought the Thunderhawks
- Passed the torch to his daughter Maria at age 54

**Generation 2: Maria Burns (2040-2075)**
- Grew up watching dad play, made varsity softball, switched to baseball
- Drafted by a rival team — played AGAINST her dad's Thunderhawks
- Won a World Series, retired, became a broadcaster
- Passed the torch to the kid she mentored in a youth program

**Generation 3: Diego Ramirez (2060-2095)**
- Kid from the same neighborhood in San Pedro where Will grew up
- Maria discovered him on a trip to the Dominican
- Grew up hearing stories about "the Burns family"
- Broke Will's career HR record. The narrative journal writes:
  > "When Diego Ramirez hit home run number 537, surpassing Will Burns' franchise record, the camera cut to the luxury box. Maria Burns was on her feet, screaming. Next to her, in a wheelchair, 82-year-old Will Burns smiled and tipped his cap."

### The Narrative Through Generations

The autobiography doesn't restart — it CONTINUES. Volume 2. Volume 3. The family saga spans decades:

**"The Burns Legacy: A Baseball Family"**
- Volume 1: Will Burns (2014-2054) — From bottle caps in San Pedro to owning the Thunderhawks
- Volume 2: Maria Burns (2040-2075) — The daughter who surpassed her father
- Volume 3: Diego Ramirez (2060-2095) — The kid from the old neighborhood who broke every record

By the time you've played three generations, you have a 100-year baseball saga. Every NPC, every relationship, every decision — connected across time.

### Death and Legacy

Your previous characters WILL eventually die. This is a life event for your current character:

> **YOUR FATHER HAS PASSED**
> Will Burns, 78, passed away peacefully at home in Austin, surrounded by family.
>
> The baseball world mourns. The Thunderhawks will wear a #27 patch for the season.
> The Hall of Fame released a statement. Every team observed a moment of silence.
>
> At the memorial service, Danny Reeves spoke: "I've known Will since we were 13 years old, hitting baseballs in a parking lot. He was the best friend I ever had."
>
> Your mother spoke last: "He always said the game gave him everything. But the truth is, the game was lucky to have him."

That moment — playing as Maria, receiving the news that your father (your FIRST character) has died — that's the most powerful moment a video game has ever created. Because YOU lived his life. YOU made his choices. YOU built his relationships. And now he's gone, and the world you built together continues without him.

---

## 20. Success Criteria (Final)

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
16. Players who invest in their bodies can play into their late 40s
17. Comeback arc works: injury → rehab → international ball → minors → MLB return
18. Enhancement spectrum creates real moral dilemmas gated by money and desperation
19. PED temptation scales with career stage and personal circumstances
20. The same injury at different wealth levels has completely different recovery paths
21. Politics system: being passed over despite merit triggers real emotional events
22. Connections matter: talent alone isn't always enough
23. Identity crisis after retirement is a real, felt experience — not just a menu
24. The void phase visually changes the game (desaturated, quiet, empty)
25. Not every story has a happy ending — the game allows ugly, honest conclusions
26. Post-baseball daily grind is playable: build your week, manage energy, maintain all four pillars
27. Second sport competition has its own progression, NPCs, and Big Game Moments
28. Relationships are the primary reason to keep playing past year 20
29. The phone system makes NPCs feel alive — they text, call, and need you
30. Your children can follow in your footsteps — generational payoff
31. The mentor tree tracks everyone you've influenced across your career
32. A 42-year-old outperforming college kids is a playable, celebratable moment
33. Pass the torch: become your child, protégé, or coaching tree successor
34. Original character becomes an NPC who calls, texts, watches your games
35. Multiple successions create a multi-generational family saga
36. Previous characters age and eventually die — the most powerful moment in gaming
37. The narrative journal spans volumes across generations
38. A 100-year baseball family dynasty is achievable through successive play

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
16. Players who invest in their bodies can play into their late 40s
17. Comeback arc works: injury → rehab → international ball → minors → MLB return
18. Enhancement spectrum creates real moral dilemmas gated by money and desperation
19. PED temptation scales with career stage and personal circumstances
20. The same injury at different wealth levels has completely different recovery paths
21. Politics system: being passed over despite merit triggers real emotional events
22. Connections matter: talent alone isn't always enough
23. Identity crisis after retirement is a real, felt experience — not just a menu
24. The void phase visually changes the game (desaturated, quiet, empty)
25. Not every story has a happy ending — the game allows ugly, honest conclusions
26. Post-baseball daily grind is playable: build your week, manage energy, maintain all four pillars
27. Second sport competition has its own progression, NPCs, and Big Game Moments
28. Relationships are the primary reason to keep playing past year 20
29. The phone system makes NPCs feel alive — they text, call, and need you
30. Your children can follow in your footsteps — generational payoff
31. The mentor tree tracks everyone you've influenced across your career
32. A 42-year-old outperforming college kids is a playable, celebratable moment

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
16. Players who invest in their bodies can play into their late 40s
17. Comeback arc works: injury → rehab → international ball → minors → MLB return
18. Enhancement spectrum creates real moral dilemmas gated by money and desperation
19. PED temptation scales with career stage and personal circumstances
20. The same injury at different wealth levels has completely different recovery paths
21. Politics system: being passed over despite merit triggers real emotional events
22. Connections matter: talent alone isn't always enough
23. Identity crisis after retirement is a real, felt experience — not just a menu
24. The void phase visually changes the game (desaturated, quiet, empty)
25. Not every story has a happy ending — the game allows ugly, honest conclusions
14. The narrative journal produces a unique, readable biography
15. Overtraining has real consequences (burnout, relationship decay, injury)
