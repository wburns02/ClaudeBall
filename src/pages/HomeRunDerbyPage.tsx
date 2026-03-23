// ── HomeRunDerbyPage.tsx ───────────────────────────────────────────────────
// Home Run Derby mode — focused batting experience for testing swing animations.
// Pitcher throws meatballs (center fastballs), player swings for the fences.
// Tracks HR count, distance, and round progress.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DiamondView } from '@/components/diamond/DiamondView.tsx';
import type { GameEvent } from '@/engine/types/index.ts';

// ── Derby state ─────────────────────────────────────────────────────────

interface DerbyResult {
  swing: number;
  result: 'home_run' | 'hit' | 'out' | 'foul';
  distance: number; // feet
}

const OUTS_PER_ROUND = 10;
const TOTAL_ROUNDS = 3;

// Generate a pitch + at-bat result event pair for the derby
function generateDerbyEvents(swingNum: number): { events: GameEvent[]; result: DerbyResult } {
  // Weighted outcomes: HR derby so most swings are contact
  const roll = Math.random();
  let result: DerbyResult['result'];
  let distance: number;

  if (roll < 0.35) {
    result = 'home_run';
    distance = 380 + Math.floor(Math.random() * 80); // 380-460 ft
  } else if (roll < 0.55) {
    result = 'hit';
    distance = 200 + Math.floor(Math.random() * 150);
  } else if (roll < 0.75) {
    result = 'foul';
    distance = 50 + Math.floor(Math.random() * 100);
  } else {
    result = 'out';
    distance = 150 + Math.floor(Math.random() * 200);
  }

  const pitchEvent: GameEvent = {
    type: 'pitch',
    pitchType: 'fastball',
    velocity: 88 + Math.floor(Math.random() * 8),
    result: result === 'foul' ? 'foul' : 'contact',
    balls: 0,
    strikes: 0,
    description: `Pitch ${swingNum}`,
  } as any;

  let atBatResult: string;
  let desc: string;
  if (result === 'home_run') {
    atBatResult = 'home_run';
    desc = `GONE! ${distance} feet to center field!`;
  } else if (result === 'hit') {
    atBatResult = 'single';
    desc = `Line drive to the outfield — ${distance} feet`;
  } else if (result === 'foul') {
    atBatResult = 'foul';
    desc = `Foul ball — ${distance} feet`;
  } else {
    atBatResult = 'flyout';
    desc = `Fly ball caught at the warning track — ${distance} feet`;
  }

  const abEvent: GameEvent = {
    type: 'at_bat_result',
    result: atBatResult,
    batter: 'Derby Slugger',
    pitcher: 'BP Pitcher',
    description: desc,
  } as any;

  // For fouls, only send pitch event
  const events = result === 'foul' ? [pitchEvent] : [pitchEvent, abEvent];

  return { events, result: { swing: swingNum, result, distance } };
}

// ── Component ───────────────────────────────────────────────────────────

export function HomeRunDerbyPage() {
  const navigate = useNavigate();
  const [round, setRound] = useState(1);
  const [outs, setOuts] = useState(0);
  const [swingCount, setSwingCount] = useState(0);
  const [homeRuns, setHomeRuns] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [longestHR, setLongestHR] = useState(0);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [lastResult, setLastResult] = useState<DerbyResult | null>(null);
  const [derbyOver, setDerbyOver] = useState(false);
  const [roundResults, setRoundResults] = useState<number[]>([]);
  const swingRef = useRef(0);

  const isRoundOver = outs >= OUTS_PER_ROUND;

  // Handle swing
  const handleSwing = useCallback(() => {
    if (derbyOver || isRoundOver) return;

    swingRef.current += 1;
    const num = swingRef.current;
    const { events: newEvents, result } = generateDerbyEvents(num);

    setSwingCount(s => s + 1);
    setLastResult(result);
    setEvents(prev => [...prev, ...newEvents]);

    if (result.result === 'home_run') {
      setHomeRuns(hr => hr + 1);
      setTotalDistance(d => d + result.distance);
      if (result.distance > longestHR) setLongestHR(result.distance);
    } else if (result.result === 'out') {
      setOuts(o => o + 1);
    }
    // fouls and hits don't count as outs
  }, [derbyOver, isRoundOver, longestHR]);

  // Next round
  const handleNextRound = useCallback(() => {
    setRoundResults(prev => [...prev, homeRuns]);
    if (round >= TOTAL_ROUNDS) {
      setDerbyOver(true);
      return;
    }
    setRound(r => r + 1);
    setOuts(0);
    setSwingCount(0);
    setHomeRuns(0);
    setEvents([]);
    setLastResult(null);
    swingRef.current = 0;
  }, [round, homeRuns]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (isRoundOver && !derbyOver) {
          handleNextRound();
        } else {
          handleSwing();
        }
      }
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSwing, handleNextRound, isRoundOver, derbyOver, navigate]);

  const allRoundHRs = [...roundResults, ...(derbyOver ? [] : [homeRuns])];
  const grandTotal = allRoundHRs.reduce((a, b) => a + b, 0);

  return (
    <div className="h-screen flex flex-col bg-navy overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-navy-lighter/80 border-b border-gold/20">
        <button
          onClick={() => navigate('/')}
          className="text-cream-dim/60 text-xs font-mono hover:text-cream transition-colors cursor-pointer"
        >
          &larr; Menu
        </button>
        <h1 className="font-display text-gold text-lg tracking-widest uppercase">
          Home Run Derby
        </h1>
        <div className="text-cream-dim/60 text-xs font-mono">
          Round {round}/{TOTAL_ROUNDS}
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 relative">
        <DiamondView
          fullScreen
          bases={{ first: false, second: false, third: false }}
          events={events}
        />

        {/* Derby HUD overlay */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-navy/85 backdrop-blur-sm border border-gold/20 rounded-lg px-6 py-3 pointer-events-none">
          <div className="text-center">
            <div className="text-gold font-display text-3xl">{homeRuns}</div>
            <div className="text-cream-dim/50 text-[9px] font-mono tracking-widest uppercase">Home Runs</div>
          </div>
          <div className="w-px h-10 bg-gold/20" />
          <div className="text-center">
            <div className="text-cream font-display text-xl">{outs}/{OUTS_PER_ROUND}</div>
            <div className="text-cream-dim/50 text-[9px] font-mono tracking-widest uppercase">Outs</div>
          </div>
          <div className="w-px h-10 bg-gold/20" />
          <div className="text-center">
            <div className="text-cream font-display text-xl">{longestHR || '—'}</div>
            <div className="text-cream-dim/50 text-[9px] font-mono tracking-widest uppercase">Longest (ft)</div>
          </div>
        </div>

        {/* Last result flash */}
        {lastResult && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none">
            {lastResult.result === 'home_run' && (
              <div className="text-gold font-display text-2xl tracking-wide animate-bounce">
                HOME RUN! {lastResult.distance} ft
              </div>
            )}
            {lastResult.result === 'out' && (
              <div className="text-red-400 font-display text-lg">
                OUT
              </div>
            )}
            {lastResult.result === 'foul' && (
              <div className="text-cream-dim/60 font-display text-lg">
                FOUL BALL
              </div>
            )}
            {lastResult.result === 'hit' && (
              <div className="text-green-400 font-display text-lg">
                HIT — {lastResult.distance} ft
              </div>
            )}
          </div>
        )}

        {/* Round over overlay */}
        {isRoundOver && !derbyOver && (
          <div className="absolute inset-0 bg-navy/80 flex items-center justify-center z-10">
            <div className="text-center space-y-4">
              <div className="font-display text-gold text-3xl tracking-wide uppercase">
                Round {round} Complete
              </div>
              <div className="font-display text-cream text-5xl">{homeRuns} HR</div>
              {longestHR > 0 && (
                <div className="text-cream-dim/60 font-mono text-sm">
                  Longest: {longestHR} ft
                </div>
              )}
              <button
                onClick={handleNextRound}
                className="mt-4 bg-gold text-navy font-display text-lg px-8 py-3 rounded-lg hover:bg-gold/90 active:scale-95 transition-all cursor-pointer"
              >
                {round < TOTAL_ROUNDS ? `Start Round ${round + 1}` : 'View Results'}
              </button>
              <p className="text-cream-dim/40 text-xs font-mono">Press Space</p>
            </div>
          </div>
        )}

        {/* Derby over overlay */}
        {derbyOver && (
          <div className="absolute inset-0 bg-navy/85 flex items-center justify-center z-10">
            <div className="text-center space-y-6">
              <div className="font-display text-gold text-2xl tracking-widest uppercase">
                Derby Complete
              </div>
              <div className="font-display text-cream text-6xl">{grandTotal} HR</div>
              <div className="flex gap-6 justify-center">
                {roundResults.map((hr, i) => (
                  <div key={i} className="text-center">
                    <div className="text-cream-dim/50 text-[9px] font-mono uppercase">R{i + 1}</div>
                    <div className="text-cream font-display text-2xl">{hr}</div>
                  </div>
                ))}
              </div>
              {longestHR > 0 && (
                <div className="text-cream-dim/60 font-mono text-sm">
                  Longest bomb: {longestHR} ft
                </div>
              )}
              <div className="flex gap-4 justify-center mt-4">
                <button
                  onClick={() => {
                    setRound(1); setOuts(0); setSwingCount(0); setHomeRuns(0);
                    setTotalDistance(0); setLongestHR(0); setEvents([]);
                    setLastResult(null); setDerbyOver(false); setRoundResults([]);
                    swingRef.current = 0;
                  }}
                  className="bg-gold text-navy font-display text-lg px-8 py-3 rounded-lg hover:bg-gold/90 active:scale-95 transition-all cursor-pointer"
                >
                  Play Again
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="border border-cream-dim/30 text-cream font-display text-lg px-8 py-3 rounded-lg hover:bg-cream/10 active:scale-95 transition-all cursor-pointer"
                >
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 bg-navy-lighter/80 border-t border-gold/20">
        {!isRoundOver && !derbyOver && (
          <>
            <button
              onClick={handleSwing}
              className="bg-gold text-navy font-display text-base px-6 py-2 rounded-lg hover:bg-gold/90 active:scale-95 transition-all cursor-pointer"
            >
              Swing [Space]
            </button>
            <span className="text-cream-dim/40 text-xs font-mono">
              Swing {swingCount + 1} &middot; Round {round}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
