# Childhood Genetics, Seasonal Sports & Story Arcs — Design Spec

**Date:** 2026-03-31
**Status:** Draft
**Depends on:** CK2 Core Loop (complete), Living Dynasty setup (complete)

---

## 1. Overview

Redesign the Living Dynasty childhood experience (ages 12-18) with four interlocking systems:

- **Genetics & Body**: Hidden potential ranges inherited from parents, height from family, weight dynamic with training
- **Seasonal Calendar**: Fall/Winter/Spring/Summer activity picks with real tradeoffs between sports
- **Story Arc Engine**: Multi-year connected storylines (10+ touchpoints/year) that weave through the calendar
- **Training & Development**: Activities push current ratings toward potential; specific sports widen potential ranges

The goal: every childhood playthrough generates a unique origin story with emergent narrative arcs, genuine decisions, and a body/skillset that feels EARNED, not allocated.

---

## 2. Genetics & Body System

### 2.1 Hidden Potential Ranges

At character creation, the game rolls a **genetic floor and ceiling** for each attribute. The player never sees raw numbers — only vague scouting descriptors that sharpen over time.

**How potential is generated:**

Each attribute gets a `[floor, ceiling]` range rolled from parents + family archetype:

```
Baseball Family:    contact [45-70], power [40-65], speed [35-60], fielding [50-75], arm [45-70], eye [50-75]
Blue Collar:        contact [35-60], power [45-70], speed [40-65], fielding [35-60], arm [40-65], eye [30-55]
Military:           contact [35-60], power [40-65], speed [45-70], fielding [45-70], arm [45-70], eye [35-60]
Single Parent:      contact [40-65], power [35-60], speed [45-70], fielding [35-60], arm [35-60], eye [40-65]
Immigrant:          contact [45-70], power [40-65], speed [50-75], fielding [40-65], arm [45-70], eye [35-60]
Wealthy:            contact [40-65], power [35-60], speed [35-60], fielding [40-65], arm [35-60], eye [45-70]
Broken Home:        contact [40-65], power [50-75], speed [40-65], fielding [30-55], arm [40-65], eye [35-60]
```

Within each range, the specific floor/ceiling is randomized:
- Floor = range_min + random(0, 10)
- Ceiling = range_max + random(0, 15) — the genetic lottery
- Ceiling always >= floor + 15 (minimum growth room)
- Ceiling capped at 99

**The genetic lottery:** A rare roll (5% chance per attribute) adds +10-20 to the ceiling. This creates the "generational talent" — a kid from a blue collar family who happens to have 90+ power ceiling. You won't know until they develop.

### 2.2 Potential Discovery

The player does NOT see their genetic ceiling. Instead, they see **scout descriptors** that get more precise with age and training:

| Age | Precision | Example |
|-----|-----------|---------|
| 12-13 | Very vague | "Shows promise" / "Needs work" / "Raw" |
| 14-15 | Vague ranges | "Average to above-average power" / "Could be a plus runner" |
| 16-17 | Narrowing | "Projects as 55-65 power" (20-tool scale) |
| 18+ | Clear | "Ceiling: 70 power" (if well-scouted) |

Training in an attribute reveals more of the ceiling. A kid who never trains power won't know if they have 50 or 80 ceiling until they try.

### 2.3 Height & Weight

**Height** — Determined at creation from family genetics:
- Base height from a family height gene (short/average/tall)
- Father's height is the primary input (if present), mother's secondary
- Random variance of +/- 2 inches
- Growth spurts happen at age 13-16 (events trigger, height jumps)
- Final adult height set by age 17-18
- Height affects position viability and attribute ceilings:

| Height | Speed Ceiling Mod | Power Ceiling Mod | Fielding Mod | Position Pressure |
|--------|-------------------|-------------------|--------------|-------------------|
| 5'6"-5'8" | +5 | -10 | +5 | 2B, SS, CF only realistic |
| 5'9"-5'11" | +0 | -5 | +0 | All positions viable |
| 6'0"-6'2" | -0 | +5 | -0 | SS gets harder, corner positions open |
| 6'3"-6'5" | -5 | +10 | -5 | 1B, RF, P heavily favored |

**Weight** — Dynamic, changes with training and life:
- Starting weight calculated from height + build
- Training effects: lifting → +weight, running/agility → -weight, balanced → stable
- Life events affect weight: injury layoff (+weight), growth spurt, summer of partying (+weight)
- Weight affects the speed/power curve:
  - Heavier = more power, less speed (diminishing returns)
  - Lighter = more speed, less power
  - Optimal BMI range for each position
- Weight is visible to the player (it's on your body, you know it)

### 2.4 How Training Expands Potential

This is the key mechanic: **your decisions WIDEN your genetic range**.

- Base genetic range might be power [40-65]
- Playing football for 2 years: power ceiling +5 → [40-70]
- Weight training focus: power ceiling +3 → [40-73]
- Neglecting power training: ceiling doesn't grow, stays at 65

Each activity/sport has specific potential-expansion effects (see Section 3). The genetic lottery sets the STARTING range, but smart training can push ceilings by +10 to +20 over a career. A kid with average genetics who trains perfectly can rival a genetic freak who wastes their talent.

---

## 3. Seasonal Calendar

### 3.1 Structure

Each year (ages 12-18) is divided into 4 seasons:

| Season | Months | Baseball? | Other Sports Available |
|--------|--------|-----------|----------------------|
| **Fall** | Sep-Nov | Fall ball / showcases | Football, Soccer, Cross-country |
| **Winter** | Dec-Feb | Indoor training only | Basketball, Wrestling, Swimming, Weight room |
| **Spring** | Mar-May | **Baseball season** | Track & Field (dual-sport possible) |
| **Summer** | Jun-Aug | Travel ball / showcases | Summer baseball, Camps, Jobs, Rest |

### 3.2 Activity Choices Per Season

Each season, the player picks ONE primary activity (some allow a secondary):

**Fall:**
- Fall baseball (showcases, development leagues) — +Contact, +Eye, +Scout exposure
- Football — +Speed, +Power potential, +Toughness, injury risk (15%), conflicts with fall baseball
- Soccer — +Speed, +Agility, +Stamina, low injury risk
- Cross-country — +Speed potential, +Stamina, +Mental toughness
- Rest / Hang with friends — +Relationships, +Mental health, no physical development

**Winter:**
- Indoor hitting/pitching — +Contact, +Eye (direct baseball development)
- Basketball — +Eye, +Agility, +Vertical, +Hand-eye coordination, minor injury risk
- Wrestling — +Power, +Composure, +Toughness, +Weight management
- Swimming — +Stamina, +Arm strength, +Flexibility, zero injury risk
- Weight room focus — +Power, +Durability, weight gain
- Rest — +Relationships, recovery from fall

**Spring:**
- Baseball (mandatory if on school team) — core development in all attributes
- Track & Field (dual-sport, reduced baseball reps) — +Speed potential if sprinter, +Arm if thrower
- Baseball-only focus — maximum baseball development, less diverse

**Summer:**
- Travel ball tournament circuit — +Development, +Scout exposure, -$2-5K, -Family time
- Summer camp (position-specific) — +Specific skill, +Scout exposure, -$1-3K
- Pick-up games / rec league — +Fun, +Relationships, less competitive development
- Summer job — +$Money, +Work ethic, -Training time
- Rest and recovery — +Mental health, -Development, prevents burnout

### 3.3 Stat Effects of Each Sport

Each sport provides both **current attribute boosts** (immediate) and **potential ceiling expansion** (permanent):

| Sport | Current Boost (per season) | Potential Expansion (per season) | Risks |
|-------|---------------------------|--------------------------------|-------|
| Football | Power +2, Speed +2 | Power ceiling +3, Speed ceiling +2 | 15% injury (shoulder, knee, concussion) |
| Basketball | Eye +2, Speed +1 | Eye ceiling +2, Agility +2 | 8% injury (ankle, knee) |
| Soccer | Speed +2, Stamina +1 | Speed ceiling +2, Stamina ceiling +1 | 5% injury (leg) |
| Cross-country | Speed +1, Stamina +2 | Speed ceiling +1, Mental toughness +3 | 3% overuse injury |
| Wrestling | Power +2, Composure +1 | Power ceiling +2, Composure ceiling +2 | 10% injury |
| Swimming | Stamina +2, Arm +1 | Stamina ceiling +2, Arm ceiling +1 | 1% injury (shoulder) |
| Track (sprint) | Speed +3 | Speed ceiling +3 | 5% hamstring |
| Track (throwing) | Arm +2, Power +1 | Arm ceiling +2, Power ceiling +1 | 3% shoulder |
| Weight room | Power +2 | Power ceiling +1, +Weight | 2% strain |
| Fall baseball | Contact +2, Eye +1 | General baseball +1 each | Standard baseball risk |
| Travel ball | All baseball +1 | Scout exposure +10, General +1 | Burnout risk |

### 3.4 Multi-Sport Pressure

Playing multiple sports creates **events and story arcs**:
- Football coach pressures you to go football-only ("You could play D1 football")
- Parents disagree about which sport to focus on
- Teammate jealousy ("Must be nice playing two sports while we're in fall ball")
- Injury in one sport affects the other
- College recruitment: multi-sport athletes get different attention
- The big decision: when do you go baseball-only? Some kids never do (Bo Jackson, Deion Sanders)

---

## 4. Story Arc Engine

### 4.1 Philosophy

One-off events are filler. **Story arcs** — multi-year connected storylines — are what make CK2 addictive. The arc engine generates interlocking storylines that weave through the calendar, creating 10+ meaningful touchpoints per year.

### 4.2 Arc Types

Each arc has: a **trigger** (what starts it), **beats** (2-8 events spread across months/years), a **resolution** (how it ends), and **consequences** (lasting effects on attributes, relationships, reputation).

**Core Arc Types (always active, 2-3 running simultaneously):**

1. **The Rivalry** — A rival appears (Little League opponent, travel ball competitor, same-position teammate). Beats: first encounter → rematch → escalation → confrontation → resolution (respect, hatred, or indifference). Spans 2-4 years. The rival can become a friend, a nemesis, or fade away based on choices.

2. **The Mentor** — An older player, coach, or family member takes interest. Beats: introduction → first lesson → challenge → mentor's crisis → student surpasses teacher. The mentor's personality affects what they teach (gruff coach = composure, patient uncle = baseball IQ). Losing a mentor (they move, get fired, pass away) is an emotional beat.

3. **Family Saga** — Generated from family archetype. Blue collar: money pressure, parent working overtime. Single parent: mom's new relationship, sibling rivalry. Broken home: custody drama, dad reappearing. Military: moving to a new city mid-season. Immigrant: cultural tension, language barriers, family back home. These run continuously with 2-3 beats per year.

4. **The Two-Sport Tug** — If playing multiple sports. Football coach says "you're my guy," baseball coach says "you need to commit." Parents weigh in. Scouts from both sports show up. Peaks with a decision event that's been building for years. Can end with full commitment, continued dual-sport, or unexpected path (scholarship sport isn't the one you expected).

5. **First Love / Social Life** — Age 14+ trigger. A relationship starts. Beats: meeting → dating → distraction vs. motivation → jealousy/support → breakup or commitment. Affects mental balance, social reputation, and decision-making. Not graphically romantic — more like "you spent the weekend at the lake with Sarah instead of at the showcase" with real consequences.

**Seasonal Arc Types (triggered by specific conditions):**

6. **The Showcase Circuit** — Triggered when scout exposure reaches a threshold. Series of events: invitation → preparation → performance → results → draft board impact. Success breeds more invitations. Failure requires recovery.

7. **Team Chemistry Arc** — Your team's season. Are you the star or a role player? Team wins/losses affect your story. Championship run = Big Game Moment chain. Losing season = character-building events.

8. **The Injury Recovery** — Triggered by injury. Beats: injury occurs → diagnosis → treatment decision → rehab montage → comeback → performance test. Duration depends on severity. Choices during rehab (rush back, play through it, full recovery) have long-term consequences.

9. **The Scout's Eye** — Age 15+. An MLB scout starts following you. Beats: first sighting → follow-up visit → combine invite → pre-draft workouts → draft day. The scout becomes a named NPC who reports on you. Your performance in his presence matters more.

10. **The Underdog Arc** — Triggered when you're cut, benched, or passed over. Beats: rejection → doubt → resolve → training montage → tryout → redemption (or acceptance). Ties into the politics system.

### 4.3 Arc Beat Structure

Each beat in an arc is a **DecisionEvent** with extra metadata:

```typescript
interface ArcBeat {
  arcId: string;           // Which arc this belongs to
  beatIndex: number;       // Position in the arc sequence
  totalBeats: number;      // How many beats total
  triggerCondition: string; // When this beat fires (season, age, event)

  // Standard DecisionEvent fields
  title: string;
  description: string;
  choices: DecisionChoice[];

  // Arc-specific
  previousChoiceSummary?: string;  // "Last time, you chose to stand up to him..."
  consequencePreview?: string;      // "This choice will affect your rivalry with Danny"
}
```

### 4.4 Arc Scheduling

The arc engine runs at the start of each season:
1. Check active arcs — which ones have a beat due this season?
2. Check for new arc triggers — conditions met to start a new arc?
3. Generate standalone events to fill gaps (never fewer than 10 touchpoints/year total)
4. Schedule beats across the season (some immediate, some mid-season, some end-of-season)

**Density targets per year:**
- 2-3 arc beats (from ongoing storylines)
- 1 seasonal sport selection
- 1-2 Big Game Moments
- 2-3 standalone events (training, social, family)
- 1-2 random life events
- Total: 8-12 touchpoints per year, minimum 10

### 4.5 Arc Resolution & Memory

When an arc resolves, its outcome is stored and can trigger future arcs:
- Rivalry resolved with respect → same rival appears as a teammate in college/minors
- Mentor who got fired → reappears as a scout who recommends you
- First love breakup → affects trust trait, future relationship events
- Two-sport decision → locks in identity, affects college recruitment path
- Underdog redemption → creates a "chip on shoulder" trait that generates events for years

---

## 5. Childhood Season Flow (Per Year)

Here's what a year feels like at age 14:

**Fall (September):**
- SEASONAL PICK: "Fall is here. What's your focus?" → Football / Fall Baseball / Soccer / Cross-country / Rest
- ARC BEAT: "Danny Reeves is on the JV football team too. He's playing safety. You're both competing for the starting spot." (Rivalry arc, beat 2)
- STANDALONE: "Your baseball travel ball coach texts: 'We have a fall showcase in October. Are you in?'" (Conflict with football schedule)

**Winter (December):**
- SEASONAL PICK: "Off-season. How do you spend the winter?" → Basketball / Wrestling / Indoor hitting / Weight room / Rest
- ARC BEAT: "Coach Thompson pulls you aside after practice. 'You've got something, kid. Come by the cages Saturday morning — just you and me. I'll show you how to hit the inside pitch.'" (Mentor arc, beat 1)
- FAMILY ARC: "Mom's working double shifts again. Your little sister needs someone to pick her up from school. You'd have to miss afternoon practice."

**Spring (March):**
- BASEBALL SEASON BEGINS: Spring stats simulated
- BIG GAME MOMENT: "District semifinals. Bottom of the 6th. You're up with runners on."
- ARC BEAT: "Danny Reeves is pitching for the other team. He struck you out twice last year. The whole crowd knows the history." (Rivalry arc, beat 3)
- STANDALONE: "A girl from your English class is at every home game. She always sits behind the dugout."

**Summer (June):**
- SEASONAL PICK: "Summer's here. What's the plan?" → Travel ball circuit / Summer camp / Rec league / Summer job / Rest
- SCOUT EVENT: "There's a Perfect Game showcase in Houston next month. Entry fee is $500. Your family can't really afford it."
- ARC BEAT: "Coach Thompson is moving to another school district. 'This is our last session, kid. Show me what you've learned.'" (Mentor arc, beat 4 — mentor departure)

That's 10-12 touchpoints for one year. Every single one has consequences. Every choice ripples forward.

---

## 6. Technical Architecture

### New Components
- `GeneticsComponent` — hidden floor/ceiling per attribute, lottery flags, discovery progress
- `BodyComponent` — height, weight, build type, growth stage, BMI
- `SeasonalCalendarComponent` — current season, activity history, sport participation records
- `StoryArcComponent` — active arcs, beat progress, arc history, resolution log

### New Systems
- `GeneticsSystem` — generates potential ranges from family, applies growth, reveals potential
- `BodySystem` — manages height growth spurts, weight changes from training, position viability
- `SeasonalCalendarSystem` — presents seasonal choices, applies stat effects, manages sport conflicts
- `StoryArcEngine` — the core narrative system: arc lifecycle, beat scheduling, resolution, memory

### Modified Systems
- `CareerStageSystem` — integrate seasonal calendar into stage advancement
- `FamilySystem` — feed family traits into genetics generation
- `DecisionEventSystem` — arc beats extend DecisionEvent with arc metadata

### New/Modified UI
- `SeasonalPickerModal` — seasonal sport/activity selection with tradeoff display
- Modify `LivingDynastyPage` — show current season, active arcs, body stats
- `GeneticScoutReport` — vague-to-precise potential display that sharpens with age
- `BodyCard` — height/weight display with trend indicator

### Data Flow
```
Family Archetype → GeneticsSystem → hidden [floor, ceiling] per attribute
                → BodySystem → height/weight from parents

Seasonal Pick → stat boosts to current ratings
             → potential ceiling expansion
             → weight changes
             → arc triggers (two-sport pressure, etc.)

Arc Engine → generates beats based on active arcs + season
          → beats are DecisionEvents with arc context
          → choices stored in arc memory
          → resolution triggers consequences + new arc seeds
```

---

## 7. Success Criteria

1. Player never sees raw genetic numbers — only scout descriptors that sharpen over time
2. Height comes from parents (with variance), weight changes with training/life
3. Each year has 10+ meaningful touchpoints (mix of arc beats + standalone events)
4. At least 2-3 story arcs running simultaneously at all times
5. Arcs span 2-8 years with connected beats that reference previous choices
6. Multi-sport choices in Fall/Winter/Summer with real tradeoffs
7. Playing football actually builds speed/power potential (not just current)
8. A player who trains perfectly with average genes can match a genetic freak who wastes talent
9. Weight affects the speed/power curve dynamically
10. Growth spurts are events that affect gameplay (suddenly you're too tall for SS)
11. Every childhood playthrough feels different — different arcs, different body, different path
12. Full childhood (12-18) takes 15-25 minutes to play through
13. Arc resolutions create seeds for future storylines (college, minors, MLB)
14. The "signing bonus call to mom" moment hits harder because you LIVED the story
