/**
 * BroadcastCommentary — generates TV broadcast-style commentary for game events.
 * Produces dramatic, varied play-by-play text based on game state.
 */
import type { RandomProvider } from '@/engine/core/RandomProvider.ts';

export type CommentaryMood = 'neutral' | 'excited' | 'tense' | 'dramatic' | 'disappointed';

export interface Commentary {
  text: string;
  mood: CommentaryMood;
}

function pick<T>(arr: readonly T[], rng: RandomProvider): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

// ── Strikeout commentary ────────────────────────────────────────
const STRIKEOUT_SELF = [
  'Struck out swinging! {pitcher} fooled him completely.',
  'Got him looking! Called strike three. {pitcher} paints the corner.',
  'He goes down swinging. That curve had nasty movement.',
  'Strike three! Sat him down with pure heat.',
  'Whiffed on a slider in the dirt. {pitcher} is dealing.',
  'Called strike three. The ump punches him out.',
];

const STRIKEOUT_GOOD = [
  'Strike three! What a pitch. {pitcher} is locked in tonight.',
  'Nasty slider for strike three. The crowd loves it.',
  "Can't touch that fastball. {pitcher} dealing from the mound.",
];

// ── Walk commentary ─────────────────────────────────────────────
const WALK = [
  'Ball four — take your base. {batter} draws the walk.',
  'Free pass. {batter} works the count and earns first base.',
  '{pitcher} can\'t find the zone. Walk issued to {batter}.',
  'Four balls. Patience pays off for {batter}.',
];

// ── Hit commentary ──────────────────────────────────────────────
const SINGLE = [
  'Base hit! {batter} lines one into the outfield.',
  'Single through the hole! {batter} comes through.',
  'Ground ball finds a gap — {batter} on with a single.',
  'Clean single the other way. Nice piece of hitting by {batter}.',
  'Chopper up the middle — {batter} beats the throw for a single.',
];

const DOUBLE = [
  'Ripped into the gap! {batter} in with a stand-up double!',
  'Off the wall! {batter} cruises into second with a double.',
  'Line drive splits the outfielders! Double for {batter}!',
  'Two-bagger! {batter} drives one deep into the corner.',
];

const TRIPLE = [
  'Deep to the corner — he\'s going for three! {batter} slides in with a triple!',
  'It rolls to the wall — {batter} legs out a triple! What speed!',
  'Triple! {batter} is flying around those bases!',
];

const HOMERUN = [
  'GONE! {batter} crushes it deep! Home run!',
  'Way back, way back... GONE! {batter} puts one into orbit!',
  'That ball is OUTTA HERE! {batter} with a moonshot!',
  'See. Ya. Later! {batter} goes yard! The crowd erupts!',
  'No doubt about it — {batter} deposits one into the seats!',
  'Towering fly ball... it just keeps carrying... HOME RUN! {batter}!',
];

const HOMERUN_RBI = [
  'Grand slam possibility here... {batter} DELIVERS! Grand slam! Bases cleared!',
  '{count}-run shot! {batter} changes the game with one swing!',
  'Two-run homer! {batter} makes them pay!',
];

// ── Out commentary ──────────────────────────────────────────────
const FLYOUT = [
  'Fly ball to {fielder}... and it\'s caught. One away.',
  'Routine fly to {fielder}. {batter} can\'t get it past the outfield.',
  'Sky high — {fielder} settles under it. Out.',
  '{fielder} drifts back... makes the catch.',
];

const GROUNDOUT = [
  'Ground ball to {fielder} — throw to first — out!',
  'Chopped to {fielder}, easy throw, and he\'s out.',
  'Bouncer to {fielder}... scoops and fires... got him!',
  '{fielder} fields it cleanly — routine groundout.',
];

const DOUBLE_PLAY = [
  'Ground ball — 6-4-3 double play! Inning over!',
  'Tailor-made double play! That\'s a rally killer!',
  'Two for the price of one! Double play turns the inning!',
];

// ── Inning commentary ───────────────────────────────────────────
const INNING_START = [
  'Here we go, {half} of the {inning}.',
  'Coming up: the {half} of the {inning}.',
  '{half} {inning} — let\'s see what happens.',
];

const LATE_GAME = [
  'We\'re in the late innings now. Every pitch matters.',
  'Crunch time. This is where legends are made.',
  'Down to the wire in this one.',
];

// ── Score commentary ────────────────────────────────────────────
const TIESCORE = [
  'We\'re all tied up at {score}.',
  'Deadlocked at {score} apiece.',
  'It\'s a {score}-{score} ballgame.',
];

const LEAD_CHANGE = [
  '{team} takes the lead! {score1}-{score2}!',
  'And just like that, {team} goes ahead!',
  'Lead change! {team} in front now.',
];

// ── Fielder names for position ──────────────────────────────────
const FIELDER_NAMES: Record<string, string[]> = {
  'fly': ['left field', 'center field', 'right field'],
  'ground': ['shortstop', 'second base', 'third base', 'first base'],
};

export function generateCommentary(
  event: string,
  data: { batter?: string; pitcher?: string; rbi?: number; bases?: number; inning?: number; half?: string; score?: [number, number]; teamName?: string },
  rng: RandomProvider,
): Commentary {
  const sub = (text: string) => text
    .replace('{batter}', data.batter ?? 'the batter')
    .replace('{pitcher}', data.pitcher ?? 'the pitcher')
    .replace('{fielder}', pick(event.includes('fly') ? FIELDER_NAMES.fly : FIELDER_NAMES.ground, rng))
    .replace('{inning}', data.inning ? `${data.inning}${data.inning===1?'st':data.inning===2?'nd':data.inning===3?'rd':'th'}` : 'next inning')
    .replace('{half}', data.half ?? 'top')
    .replace('{score}', data.score ? `${data.score[0]}` : '0')
    .replace('{score1}', data.score ? `${Math.max(...data.score)}` : '0')
    .replace('{score2}', data.score ? `${Math.min(...data.score)}` : '0')
    .replace('{team}', data.teamName ?? 'the team')
    .replace('{count}', String(data.rbi ?? 2));

  switch (event) {
    case 'strikeout':
      return { text: sub(pick(STRIKEOUT_SELF, rng)), mood: 'neutral' };
    case 'strikeout_good':
      return { text: sub(pick(STRIKEOUT_GOOD, rng)), mood: 'excited' };
    case 'walk':
      return { text: sub(pick(WALK, rng)), mood: 'neutral' };
    case 'single':
      return { text: sub(pick(SINGLE, rng)), mood: 'neutral' };
    case 'double':
      return { text: sub(pick(DOUBLE, rng)), mood: 'excited' };
    case 'triple':
      return { text: sub(pick(TRIPLE, rng)), mood: 'excited' };
    case 'homerun':
      return { text: sub(pick(data.rbi && data.rbi >= 2 ? HOMERUN_RBI : HOMERUN, rng)), mood: 'dramatic' };
    case 'flyout':
      return { text: sub(pick(FLYOUT, rng)), mood: 'neutral' };
    case 'groundout':
      return { text: sub(pick(GROUNDOUT, rng)), mood: 'neutral' };
    case 'double_play':
      return { text: sub(pick(DOUBLE_PLAY, rng)), mood: 'tense' };
    case 'inning_start':
      return { text: sub(pick(INNING_START, rng)), mood: 'neutral' };
    case 'late_game':
      return { text: sub(pick(LATE_GAME, rng)), mood: 'tense' };
    case 'tie_score':
      return { text: sub(pick(TIESCORE, rng)), mood: 'tense' };
    case 'lead_change':
      return { text: sub(pick(LEAD_CHANGE, rng)), mood: 'dramatic' };
    default:
      return { text: `${event}`, mood: 'neutral' };
  }
}

export function moodColor(mood: CommentaryMood): string {
  switch (mood) {
    case 'excited': return '#22c55e';
    case 'tense': return '#f59e0b';
    case 'dramatic': return '#d4a843';
    case 'disappointed': return '#ef4444';
    default: return '#b8b0a4';
  }
}
