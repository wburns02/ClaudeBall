import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useCareerStore } from '@/stores/careerStore.ts';
import type { CareerState } from '@/engine/player/CareerEngine.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';
import { clamp } from '@/engine/util/helpers.ts';
import { cn } from '@/lib/cn.ts';

function makeRng() {
  return new RandomProvider(Date.now() ^ (Math.random() * 0xffffffff) | 0);
}

type AtBatResult = 'HR' | '3B' | '2B' | '1B' | 'BB' | 'K' | 'GO' | 'FO';
type PitchResult = 'Ball' | 'Strike' | 'Foul' | 'In Play';

interface AtBat {
  inning: number;
  result: AtBatResult;
  rbi: number;
  description: string;
}

interface PitchState {
  balls: number;
  strikes: number;
  count: string;
}

// Simulate pitcher at-bat (pitching is currently batter-focused)
function simulateAtBat(player: CareerState | null, rng: RandomProvider, inning: number): AtBat {
  if (!player) return { inning, result: 'GO', rbi: 0, description: 'Groundout' };
  const p = player.player;
  const contact = (p.batting.contact_L + p.batting.contact_R) / 2;
  const power   = (p.batting.power_L + p.batting.power_R) / 2;
  const eye     = p.batting.eye;
  const avoidK  = p.batting.avoid_k;

  const walkChance = clamp(eye / 100 * 0.13, 0.04, 0.16);
  const kChance    = clamp((100 - avoidK) / 100 * 0.30, 0.08, 0.40);
  const hrChance   = clamp(power / 100 * 0.06, 0.005, 0.10);
  const hitChance  = clamp(contact / 100 * 0.38, 0.12, 0.44);

  const roll = rng.next();
  let result: AtBatResult;
  let rbi = 0;
  let description = '';

  if (roll < walkChance) {
    result = 'BB';
    description = 'Walk drawn on a full count';
  } else if (roll < walkChance + kChance) {
    result = 'K';
    description = rng.chance(0.4) ? 'Swinging strikeout' : 'Looking strikeout';
  } else if (roll < walkChance + kChance + hrChance) {
    result = 'HR';
    rbi = rng.nextInt(1, 4);
    description = rng.chance(0.5) ? 'Deep shot to left field — GONE!' : 'Crushed to right-center — HOME RUN!';
  } else {
    const hitRoll = rng.next();
    if (hitRoll < hitChance) {
      const r2 = rng.next();
      if (r2 < 0.06) {
        result = '3B';
        description = 'Triple off the wall!';
        rbi = rng.nextInt(0, 3);
      } else if (r2 < 0.22) {
        result = '2B';
        description = 'Double down the line!';
        rbi = rng.nextInt(0, 2);
      } else {
        result = '1B';
        description = rng.chance(0.5) ? 'Single up the middle' : 'Ground single to left';
        rbi = rng.chance(0.3) ? 1 : 0;
      }
    } else if (rng.chance(0.5)) {
      result = 'GO';
      description = rng.chance(0.5) ? 'Groundout to short' : 'Double play ball, erased at second';
    } else {
      result = 'FO';
      description = rng.chance(0.5) ? 'Flyout to center' : 'Popped up to second base';
    }
  }

  return { inning, result, rbi, description };
}

function simulatePitch(atBatState: PitchState, rng: RandomProvider): { result: PitchResult; newState: PitchState } {
  const roll = rng.next();
  let result: PitchResult;

  // 30% ball, 25% called strike, 25% foul, 20% in-play (simplified)
  if (roll < 0.30) {
    result = 'Ball';
  } else if (roll < 0.55) {
    result = 'Strike';
  } else if (roll < 0.75) {
    result = atBatState.strikes === 2 ? 'Foul' : 'Foul';
  } else {
    result = 'In Play';
  }

  const newState = { ...atBatState };
  if (result === 'Ball') {
    newState.balls = Math.min(3, newState.balls + 1);
  } else if (result === 'Strike') {
    newState.strikes = Math.min(2, newState.strikes + 1);
  } else if (result === 'Foul') {
    if (newState.strikes < 2) newState.strikes++;
    // foul on 2 strikes doesn't change count
  }
  newState.count = `${newState.balls}-${newState.strikes}`;

  return { result, newState };
}

function resultColor(r: AtBatResult): string {
  switch (r) {
    case 'HR': return '#ef4444';
    case '3B': return '#f59e0b';
    case '2B': return '#d4a843';
    case '1B': return '#22c55e';
    case 'BB': return '#3b82f6';
    case 'K':  return '#a855f7';
    default:   return '#6b7280';
  }
}

function resultLabel(r: AtBatResult): string {
  switch (r) {
    case 'HR': return 'HOME RUN';
    case '3B': return 'TRIPLE';
    case '2B': return 'DOUBLE';
    case '1B': return 'SINGLE';
    case 'BB': return 'WALK';
    case 'K':  return 'STRIKEOUT';
    case 'GO': return 'GROUND OUT';
    case 'FO': return 'FLY OUT';
  }
}

export function CareerGamePage() {
  const navigate = useNavigate();
  const careerState = useCareerStore(s => s.careerState);
  const advanceDay  = useCareerStore(s => s.advanceDay);

  const [mode, setMode] = useState<'choose' | 'live' | 'done'>('choose');
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [currentInning, setCurrentInning] = useState(1);
  const [totalInnings] = useState(9);
  const [pitchState, setPitchState] = useState<PitchState>({ balls: 0, strikes: 0, count: '0-0' });
  const [currentAtBat, setCurrentAtBat] = useState<AtBat | null>(null);
  const [pitchLog, setPitchLog] = useState<string[]>([]);
  const [inAtBat, setInAtBat] = useState(false);
  const [atBatResult, setAtBatResult] = useState<AtBat | null>(null);
  const [teamScore, setTeamScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);

  const dayStats = atBats.reduce((acc, ab) => ({
    ab: acc.ab + (ab.result !== 'BB' ? 1 : 0),
    h: acc.h + (['HR','3B','2B','1B'].includes(ab.result) ? 1 : 0),
    hr: acc.hr + (ab.result === 'HR' ? 1 : 0),
    rbi: acc.rbi + ab.rbi,
    bb: acc.bb + (ab.result === 'BB' ? 1 : 0),
    k: acc.k + (ab.result === 'K' ? 1 : 0),
  }), { ab:0, h:0, hr:0, rbi:0, bb:0, k:0 });

  const isPitcher = careerState?.player.position === 'P';

  const handleSimGame = useCallback(() => {
    advanceDay();
    navigate('/career');
  }, [advanceDay, navigate]);

  const handleStartLive = () => {
    setMode('live');
    setAtBats([]);
    setCurrentInning(1);
    setPitchState({ balls: 0, strikes: 0, count: '0-0' });
    setCurrentAtBat(null);
    setPitchLog([]);
    setInAtBat(false);
    setAtBatResult(null);
    setTeamScore(0);
    setOppScore(0);
  };

  const handleNextAtBat = () => {
    if (currentInning > totalInnings) return;
    const newAb: AtBat = { inning: currentInning, result: 'GO', rbi: 0, description: '' };
    setCurrentAtBat(newAb);
    setPitchState({ balls: 0, strikes: 0, count: '0-0' });
    setPitchLog([]);
    setInAtBat(true);
    setAtBatResult(null);
  };

  const handlePitch = () => {
    if (!inAtBat) return;
    const rng = makeRng();

    // Check for end condition
    if (pitchState.balls >= 3 && pitchState.strikes >= 2) {
      // force resolution
    }

    const { result, newState } = simulatePitch(pitchState, rng);
    const logEntry = `${newState.count} — ${result}`;
    setPitchLog(prev => [...prev, logEntry]);
    setPitchState(newState);

    // Check if at-bat is over
    const isOver = result === 'In Play' ||
                   (result === 'Strike' && newState.strikes >= 3) ||
                   (result === 'Ball' && newState.balls >= 4);

    if (isOver) {
      const finalAb = simulateAtBat(careerState, rng, currentInning);
      setAtBatResult(finalAb);
      setAtBats(prev => [...prev, finalAb]);
      setInAtBat(false);

      // Add RBI to team score
      setTeamScore(prev => prev + finalAb.rbi);
      // Opponent scores randomly
      if (rng.chance(0.3)) setOppScore(prev => prev + rng.nextInt(0, 2));
    }
  };

  const handleNextInning = () => {
    if (currentInning >= totalInnings) {
      setMode('done');
      return;
    }
    setCurrentInning(prev => prev + 1);
    setAtBatResult(null);
    setCurrentAtBat(null);
    setPitchLog([]);
  };

  const handleFinishGame = () => {
    // Apply the day's stats to career
    advanceDay();
    navigate('/career');
  };

  if (!careerState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Panel className="text-center max-w-sm">
          <p className="text-cream py-4">No career in progress.</p>
          <Button onClick={() => navigate('/career/new')}>Start Career</Button>
        </Panel>
      </div>
    );
  }

  const { player, currentTeam, year, level, dayOfSeason } = careerState;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-tight uppercase">Game Day</h1>
            <p className="text-cream-dim text-sm font-mono mt-1">
              {player.firstName} {player.lastName} · {currentTeam} · Day {dayOfSeason}/140 · {year}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/career')}>← Dashboard</Button>
        </div>

        {/* Choose mode */}
        {mode === 'choose' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Sim the Game">
              <div className="space-y-3">
                <p className="text-cream-dim text-sm font-mono">
                  Automatically simulate the full game day. Your stats are added to the season.
                  Fast and hands-off.
                </p>
                <Button className="w-full" onClick={handleSimGame}>
                  Simulate Day
                </Button>
              </div>
            </Panel>

            <Panel title="Play It Live">
              <div className="space-y-3">
                <p className="text-cream-dim text-sm font-mono">
                  {isPitcher
                    ? 'Your at-bats are limited as a pitcher. Experience a batter\'s perspective.'
                    : 'Step up to the plate for each at-bat. Rest of the game is simmed around you.'}
                </p>
                <Button variant="secondary" className="w-full" onClick={handleStartLive}>
                  Play Live Game
                </Button>
              </div>
            </Panel>
          </div>
        )}

        {/* Live game */}
        {mode === 'live' && (
          <div className="space-y-4">
            {/* Scoreboard */}
            <Panel>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-cream-dim text-xs font-mono uppercase">{currentTeam}</p>
                  <p className="font-display text-4xl text-gold">{teamScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs font-mono">Inning</p>
                  <p className="font-display text-2xl text-cream">{currentInning}</p>
                  <p className="text-cream-dim text-xs">of {totalInnings}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs font-mono uppercase">Opponent</p>
                  <p className="font-display text-4xl text-cream-dim">{oppScore}</p>
                </div>
              </div>
            </Panel>

            {/* Today's line */}
            <Panel title="Your Line">
              <div className="flex gap-6 font-mono text-sm">
                <div className="text-center">
                  <p className="text-cream-dim text-xs">AB</p>
                  <p className="text-cream">{dayStats.ab}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs">H</p>
                  <p className="text-gold font-bold">{dayStats.h}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs">HR</p>
                  <p className="text-red-400 font-bold">{dayStats.hr}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs">RBI</p>
                  <p className="text-cream">{dayStats.rbi}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs">BB</p>
                  <p className="text-blue-400">{dayStats.bb}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs">K</p>
                  <p className="text-purple-400">{dayStats.k}</p>
                </div>
              </div>
            </Panel>

            {/* At-bat history */}
            {atBats.length > 0 && (
              <Panel title="At-Bats">
                <div className="space-y-1">
                  {atBats.map((ab, i) => (
                    <div key={i} className="flex items-center gap-3 py-1 border-b border-navy-lighter/20">
                      <span className="text-cream-dim text-xs font-mono w-10">Inn {ab.inning}</span>
                      <span
                        className="text-xs font-mono font-bold w-16"
                        style={{ color: resultColor(ab.result) }}
                      >
                        {resultLabel(ab.result)}
                      </span>
                      <span className="text-cream-dim text-xs">{ab.description}</span>
                      {ab.rbi > 0 && (
                        <span className="ml-auto text-green-400 text-xs font-mono">{ab.rbi} RBI</span>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Current at-bat */}
            {!inAtBat && !atBatResult && currentInning <= totalInnings && (
              <div className="text-center py-4">
                <Button onClick={handleNextAtBat}>
                  Step to the Plate (Inning {currentInning})
                </Button>
              </div>
            )}

            {/* Result display */}
            {atBatResult && !inAtBat && (
              <div
                className="p-6 rounded-xl border-2 text-center space-y-2"
                style={{ borderColor: resultColor(atBatResult.result), backgroundColor: `${resultColor(atBatResult.result)}15` }}
              >
                <p className="font-display text-3xl tracking-wide uppercase" style={{ color: resultColor(atBatResult.result) }}>
                  {resultLabel(atBatResult.result)}
                </p>
                <p className="text-cream font-mono text-sm">{atBatResult.description}</p>
                {atBatResult.rbi > 0 && (
                  <p className="text-green-400 font-mono text-sm">{atBatResult.rbi} RBI!</p>
                )}
                <div className="pt-2">
                  {currentInning < totalInnings ? (
                    <Button size="sm" onClick={handleNextInning}>
                      Next Inning →
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setMode('done')}>
                      Final Inning →
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Pitch-by-pitch */}
            {inAtBat && (
              <Panel title={`At Bat — Inning ${currentInning} — Count: ${pitchState.count}`}>
                <div className="space-y-4">
                  {/* Count display */}
                  <div className="flex items-center gap-6 justify-center">
                    <div className="text-center">
                      <p className="text-cream-dim text-xs font-mono uppercase">Balls</p>
                      <div className="flex gap-1 mt-1">
                        {[0,1,2,3].map(i => (
                          <div key={i} className={cn('w-4 h-4 rounded-full border',
                            i < pitchState.balls ? 'bg-green-500 border-green-500' : 'border-navy-lighter'
                          )} />
                        ))}
                      </div>
                    </div>
                    <div className="font-display text-2xl text-gold">{pitchState.count}</div>
                    <div className="text-center">
                      <p className="text-cream-dim text-xs font-mono uppercase">Strikes</p>
                      <div className="flex gap-1 mt-1">
                        {[0,1,2].map(i => (
                          <div key={i} className={cn('w-4 h-4 rounded-full border',
                            i < pitchState.strikes ? 'bg-red-500 border-red-500' : 'border-navy-lighter'
                          )} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pitch log */}
                  {pitchLog.length > 0 && (
                    <div className="text-center space-y-1">
                      {pitchLog.slice(-4).map((log, i) => (
                        <p key={i} className="text-cream-dim text-xs font-mono">{log}</p>
                      ))}
                    </div>
                  )}

                  <div className="text-center">
                    <Button onClick={handlePitch} size="lg">
                      See Pitch
                    </Button>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* Done state */}
        {mode === 'done' && (
          <div className="space-y-4">
            <Panel title="Final Score">
              <div className="flex items-center justify-center gap-12 py-4">
                <div className="text-center">
                  <p className="text-cream-dim text-xs font-mono uppercase">{currentTeam}</p>
                  <p className="font-display text-5xl text-gold">{teamScore}</p>
                </div>
                <p className="text-cream-dim font-mono text-2xl">–</p>
                <div className="text-center">
                  <p className="text-cream-dim text-xs font-mono uppercase">Opponent</p>
                  <p className="font-display text-5xl text-cream-dim">{oppScore}</p>
                </div>
              </div>
              <p className="text-center font-display text-xl text-gold tracking-wide">
                {teamScore > oppScore ? 'Victory!' : teamScore === oppScore ? 'Tie' : 'Loss'}
              </p>
            </Panel>

            <Panel title="Your Final Line">
              <div className="flex justify-center gap-8 font-mono">
                <div className="text-center">
                  <p className="text-cream-dim text-xs uppercase tracking-wide">AB</p>
                  <p className="text-cream text-xl">{dayStats.ab}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs uppercase tracking-wide">H</p>
                  <p className="text-gold text-xl font-bold">{dayStats.h}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs uppercase tracking-wide">HR</p>
                  <p className="text-red-400 text-xl font-bold">{dayStats.hr}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs uppercase tracking-wide">RBI</p>
                  <p className="text-cream text-xl">{dayStats.rbi}</p>
                </div>
                <div className="text-center">
                  <p className="text-cream-dim text-xs uppercase tracking-wide">BB</p>
                  <p className="text-blue-400 text-xl">{dayStats.bb}</p>
                </div>
              </div>
            </Panel>

            <div className="flex gap-3 justify-center">
              <Button onClick={handleFinishGame}>
                Record Stats & Continue
              </Button>
              <Button variant="ghost" onClick={() => navigate('/career')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
