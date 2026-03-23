/**
 * ManagerDecisions — generates in-game decision prompts during sim.
 * Pure TypeScript, no React.
 */
import type { RandomProvider } from '@/engine/core/RandomProvider.ts';

export type DecisionType =
  | 'pinch_hit'
  | 'pitching_change'
  | 'steal'
  | 'bunt'
  | 'intentional_walk'
  | 'challenge_play'
  | 'defensive_shift'
  | 'closer_usage';

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  successPct: number; // 0-100
}

export interface ManagerDecision {
  id: string;
  type: DecisionType;
  inning: number;
  halfInning: 'top' | 'bottom';
  situation: string;       // Narrative description
  context: string;         // Score and game state
  urgency: 'routine' | 'important' | 'critical';
  options: DecisionOption[];
  timeLimit?: number;      // seconds (optional drama)
}

export interface DecisionOutcome {
  decisionId: string;
  chosenOptionId: string;
  success: boolean;
  narrative: string;       // What happened as a result
  impactRuns: number;      // Runs gained/lost from this decision
}

// ── Name generators ─────────────────────────────────────────────

const LAST_NAMES = [
  'Rodriguez', 'Johnson', 'Martinez', 'Williams', 'Brown', 'Davis',
  'Garcia', 'Wilson', 'Anderson', 'Thomas', 'Jackson', 'White',
  'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Hall', 'Allen', 'King', 'Wright', 'Scott', 'Hill', 'Green',
];

function pick<T>(arr: readonly T[], rng: RandomProvider): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

function randInt(min: number, max: number, rng: RandomProvider): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

// ── Decision generators ─────────────────────────────────────────

function generatePinchHit(inning: number, rng: RandomProvider): ManagerDecision {
  const batter = pick(LAST_NAMES, rng);
  const pitcher = pick(LAST_NAMES, rng);
  const bench = pick(LAST_NAMES, rng);
  const runners = rng.next() > 0.5 ? 'runner on 2nd' : 'runners on 1st and 3rd';
  const outs = randInt(0, 2, rng);

  return {
    id: `dec-${Date.now()}-${Math.floor(rng.next() * 10000)}`,
    type: 'pinch_hit',
    inning,
    halfInning: 'bottom',
    situation: `${batter} is due up with ${runners}, ${outs} out. The pitcher's spot is coming around. ${bench} is available on the bench (.285 AVG, 12 HR).`,
    context: `Bottom ${inning} | ${outs} out | ${runners}`,
    urgency: inning >= 7 ? 'critical' : 'important',
    options: [
      {
        id: 'let-bat',
        label: `Let ${batter} bat`,
        description: `Keep the lineup as-is. ${batter} has been steady tonight.`,
        risk: 'low',
        successPct: 42,
      },
      {
        id: 'pinch-hit',
        label: `Pinch-hit ${bench}`,
        description: `${bench} has power and is hitting .310 vs righties this month.`,
        risk: 'medium',
        successPct: 58,
      },
      {
        id: 'bunt',
        label: 'Sacrifice bunt',
        description: 'Move the runner over, play for one run.',
        risk: 'low',
        successPct: 72,
      },
    ],
  };
}

function generatePitchingChange(inning: number, rng: RandomProvider): ManagerDecision {
  const starter = pick(LAST_NAMES, rng);
  const reliever = pick(LAST_NAMES, rng);
  const closer = pick(LAST_NAMES, rng);
  const pitchCount = randInt(85, 115, rng);
  const earnedRuns = randInt(1, 4, rng);

  return {
    id: `dec-${Date.now()}-${Math.floor(rng.next() * 10000)}`,
    type: 'pitching_change',
    inning,
    halfInning: 'top',
    situation: `${starter} has thrown ${pitchCount} pitches and given up ${earnedRuns} ER. He's facing the heart of the order. ${reliever} (2.85 ERA) is warm in the pen.`,
    context: `Top ${inning} | ${pitchCount} pitches | ${earnedRuns} ER`,
    urgency: inning >= 6 && pitchCount > 95 ? 'critical' : 'important',
    options: [
      {
        id: 'keep-in',
        label: `Leave ${starter} in`,
        description: `He has good stuff tonight. Let him work through it.`,
        risk: 'high',
        successPct: 35,
      },
      {
        id: 'reliever',
        label: `Bring in ${reliever}`,
        description: `Fresh arm with a dominant slider. Matchup advantage.`,
        risk: 'medium',
        successPct: 62,
      },
      {
        id: 'closer-early',
        label: `Go to ${closer} early`,
        description: `Your closer has been unhittable. High leverage moment.`,
        risk: 'medium',
        successPct: 71,
      },
    ],
  };
}

function generateStealDecision(inning: number, rng: RandomProvider): ManagerDecision {
  const runner = pick(LAST_NAMES, rng);
  const speed = randInt(65, 95, rng);
  const catcher = pick(LAST_NAMES, rng);

  return {
    id: `dec-${Date.now()}-${Math.floor(rng.next() * 10000)}`,
    type: 'steal',
    inning,
    halfInning: 'bottom',
    situation: `${runner} (${speed} SPD) is on first with a big lead. ${catcher} behind the plate has a ${rng.next() > 0.5 ? 'weak' : 'strong'} arm. One out, tie game.`,
    context: `Bottom ${inning} | 1 out | Runner on 1st | Tie game`,
    urgency: 'important',
    options: [
      {
        id: 'steal',
        label: 'Send the runner',
        description: `${runner} has ${speed >= 80 ? 'elite' : 'good'} speed. He could get into scoring position.`,
        risk: speed >= 80 ? 'medium' : 'high',
        successPct: Math.min(85, speed - 5),
      },
      {
        id: 'hold',
        label: 'Hold the runner',
        description: 'Play it safe. Wait for a hit.',
        risk: 'low',
        successPct: 50,
      },
      {
        id: 'hit-and-run',
        label: 'Hit and run',
        description: 'Runner goes on the pitch, batter protects. Risky but effective.',
        risk: 'high',
        successPct: 55,
      },
    ],
  };
}

function generateCloserUsage(inning: number, rng: RandomProvider): ManagerDecision {
  const closer = pick(LAST_NAMES, rng);
  const setup = pick(LAST_NAMES, rng);
  const leadSize = randInt(1, 3, rng);

  return {
    id: `dec-${Date.now()}-${Math.floor(rng.next() * 10000)}`,
    type: 'closer_usage',
    inning,
    halfInning: 'top',
    situation: `You're leading by ${leadSize} heading to the ${inning}th. ${closer} (1.85 ERA, 28 SV) is available. ${setup} (3.20 ERA) pitched yesterday.`,
    context: `Top ${inning} | Leading by ${leadSize} | Save situation`,
    urgency: leadSize === 1 ? 'critical' : 'important',
    options: [
      {
        id: 'closer-now',
        label: `${closer} — lock it down`,
        description: `Your closer is fresh and dominant. Finish it.`,
        risk: 'low',
        successPct: 82,
      },
      {
        id: 'setup-first',
        label: `${setup} for the ${inning}th, closer for ${inning + 1}th`,
        description: `Save the closer for a tighter spot.`,
        risk: 'medium',
        successPct: 65,
      },
      {
        id: 'ride-starter',
        label: 'Let the starter finish',
        description: `He has a low pitch count and still has gas.`,
        risk: 'high',
        successPct: 40,
      },
    ],
  };
}

function generateIntentionalWalk(inning: number, rng: RandomProvider): ManagerDecision {
  const batter = pick(LAST_NAMES, rng);
  const nextBatter = pick(LAST_NAMES, rng);
  const avg = (rng.next() * 0.100 + 0.280).toFixed(3);
  const hr = randInt(15, 45, rng);

  return {
    id: `dec-${Date.now()}-${Math.floor(rng.next() * 10000)}`,
    type: 'intentional_walk',
    inning,
    halfInning: 'top',
    situation: `${batter} (.${avg.slice(2)} AVG, ${hr} HR) is at the plate with first base open. ${nextBatter} is on deck.`,
    context: `${inning >= 7 ? 'Late game' : 'Mid game'} | 1st base open`,
    urgency: inning >= 8 ? 'critical' : 'routine',
    options: [
      {
        id: 'walk-him',
        label: `Walk ${batter}`,
        description: `Set up the double play. ${nextBatter} is an easier matchup.`,
        risk: 'medium',
        successPct: 60,
      },
      {
        id: 'pitch-to-him',
        label: `Pitch to ${batter}`,
        description: `Our pitcher has had success against him. Attack.`,
        risk: 'high',
        successPct: 45,
      },
    ],
  };
}

// ── Public API ───────────────────────────────────────────────────

const GENERATORS = [
  generatePinchHit,
  generatePitchingChange,
  generateStealDecision,
  generateCloserUsage,
  generateIntentionalWalk,
];

/** Generate 1-3 decisions for a simulated game */
export function generateGameDecisions(rng: RandomProvider): ManagerDecision[] {
  const count = rng.next() < 0.3 ? 1 : rng.next() < 0.7 ? 2 : 3;
  const decisions: ManagerDecision[] = [];

  for (let i = 0; i < count; i++) {
    const inning = randInt(5, 9, rng);
    const gen = pick(GENERATORS, rng);
    decisions.push(gen(inning, rng));
  }

  return decisions.sort((a, b) => a.inning - b.inning);
}

/** Resolve a decision based on the chosen option */
export function resolveDecision(
  decision: ManagerDecision,
  chosenOptionId: string,
  rng: RandomProvider,
): DecisionOutcome {
  const option = decision.options.find(o => o.id === chosenOptionId);
  if (!option) throw new Error(`Invalid option: ${chosenOptionId}`);

  const roll = rng.next() * 100;
  const success = roll < option.successPct;

  // Generate narrative
  const narratives: Record<DecisionType, { success: string; fail: string }> = {
    pinch_hit: {
      success: chosenOptionId === 'pinch-hit'
        ? 'The pinch-hitter drives a double into the gap, scoring the runner!'
        : chosenOptionId === 'bunt'
        ? 'Perfect bunt moves the runner to third. Run scores on a sac fly.'
        : 'He lines a single up the middle to drive in the go-ahead run!',
      fail: chosenOptionId === 'pinch-hit'
        ? 'The pinch-hitter grounds into an inning-ending double play.'
        : chosenOptionId === 'bunt'
        ? 'The bunt pops up and the runner is doubled off!'
        : 'He strikes out swinging on a nasty slider. Inning over.',
    },
    pitching_change: {
      success: chosenOptionId === 'keep-in'
        ? 'The starter reaches back for more. Strikes out the side!'
        : chosenOptionId === 'closer-early'
        ? 'The closer dominates with three straight strikeouts!'
        : 'The reliever gets a huge double-play ball to end the threat!',
      fail: chosenOptionId === 'keep-in'
        ? 'First pitch — line drive to the gap. Two runs score.'
        : chosenOptionId === 'closer-early'
        ? 'The closer hangs a curve. Three-run homer ties the game.'
        : 'Walk, single, walk. Bases loaded, nobody out.',
    },
    steal: {
      success: chosenOptionId === 'steal'
        ? 'Safe! Great jump and a headfirst slide into second!'
        : chosenOptionId === 'hit-and-run'
        ? 'Hit and run executed perfectly — single through the hole!'
        : 'The batter works a walk, putting runners at first and second.',
      fail: chosenOptionId === 'steal'
        ? 'Caught stealing! Perfect throw from the catcher.'
        : chosenOptionId === 'hit-and-run'
        ? 'Swing and miss! Runner hung out to dry at second.'
        : 'The batter grounds into a force play.',
    },
    closer_usage: {
      success: 'Three up, three down. Ballgame! Your closer slams the door.',
      fail: 'Lead-off double. Walk. The tying run comes to the plate...',
    },
    intentional_walk: {
      success: chosenOptionId === 'walk-him'
        ? 'Double play ball! The strategy pays off perfectly.'
        : 'Our pitcher freezes him with a backdoor slider. Strike three!',
      fail: chosenOptionId === 'walk-him'
        ? 'The next batter clears the bases with a triple. Disaster.'
        : 'First pitch... GONE. Three-run homer over the wall.',
    },
    challenge_play: { success: 'The call is overturned! Runner is safe.', fail: 'Call stands. Out.' },
    defensive_shift: { success: 'Ground ball right to the shifted fielder. Easy out.', fail: 'He slaps it the other way for a double.' },
    bunt: { success: 'Perfect bunt down the line!', fail: 'Popped it up! Easy out.' },
  };

  const n = narratives[decision.type];
  const impactRuns = success
    ? (decision.type === 'pinch_hit' ? randInt(1, 2, rng) : decision.type === 'steal' ? 0 : 0)
    : (decision.type === 'pitching_change' ? -randInt(1, 3, rng) : decision.type === 'intentional_walk' ? -randInt(1, 3, rng) : 0);

  return {
    decisionId: decision.id,
    chosenOptionId,
    success,
    narrative: success ? n.success : n.fail,
    impactRuns,
  };
}
