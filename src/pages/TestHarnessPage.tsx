import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';
import { LineScore } from '@/components/game/LineScore.tsx';
import { BoxScoreTable } from '@/components/game/BoxScoreTable.tsx';
import { PlayByPlay } from '@/components/game/PlayByPlay.tsx';
import { GameEngine } from '@/engine/core/GameEngine.ts';
import { StatAccumulator } from '@/engine/stats/StatAccumulator.ts';
import { getSampleTeams } from '@/engine/data/sampleTeams.ts';
import { getNeutralBallpark } from '@/engine/data/ballparks.ts';
import type { GameState, GameEvent } from '@/engine/types/index.ts';
import { fmt3, fmt2 } from '@/engine/util/helpers.ts';
import { cn } from '@/lib/cn.ts';

type Tab = 'single' | 'bulk' | 'pitch';

export function TestHarnessPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('single');

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Test Harness</h1>
          <p className="font-mono text-cream-dim text-xs mt-1">Engine verification dashboard</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          Back to Menu
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-navy-lighter pb-px">
        {(['single', 'bulk', 'pitch'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 font-display text-sm uppercase tracking-wider transition-colors cursor-pointer',
              'border-b-2 -mb-px',
              tab === t
                ? 'text-gold border-gold'
                : 'text-cream-dim border-transparent hover:text-cream hover:border-cream-dim/30',
            )}
          >
            {t === 'single' ? 'Single Game' : t === 'bulk' ? '100-Game Sim' : 'Pitch by Pitch'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'single' && <SingleGameTab />}
      {tab === 'bulk' && <BulkSimTab />}
      {tab === 'pitch' && <PitchByPitchTab />}
    </div>
  );
}

// ─── Single Game ────────────────────────────────────────────
function SingleGameTab() {
  const [game, setGame] = useState<GameState | null>(null);
  const [simTime, setSimTime] = useState<number>(0);

  const simulate = useCallback(() => {
    const { away, home } = getSampleTeams();
    const ballpark = getNeutralBallpark();
    const start = performance.now();
    const engine = new GameEngine({ away, home, ballpark, seed: Date.now() });
    const result = engine.simulateGame();
    setSimTime(performance.now() - start);
    setGame(result);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={simulate} data-testid="sim-single-btn">Simulate Game</Button>
        {simTime > 0 && (
          <span className="font-mono text-cream-dim text-xs">
            Completed in {simTime.toFixed(0)}ms
          </span>
        )}
      </div>

      {game && (
        <div className="space-y-4" data-testid="single-game-result">
          <Panel title="Line Score">
            <LineScore game={game} />
          </Panel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <BoxScoreTable game={game} />
            </div>
            <Panel title="Play-by-Play">
              <PlayByPlay events={game.events} maxHeight="600px" />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Simulation ────────────────────────────────────────
function BulkSimTab() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    avg: number; kPct: number; bbPct: number; hrPct: number;
    runsPerGame: number; era: number; totalGames: number;
    simTime: number;
  } | null>(null);

  const simulate = useCallback(() => {
    setRunning(true);
    setProgress(0);
    setResults(null);

    // Run in batches to not block UI
    const accumulator = new StatAccumulator();
    const totalGames = 100;
    const ballpark = getNeutralBallpark();
    let completed = 0;
    const start = performance.now();

    const runBatch = () => {
      const batchSize = 5;
      for (let i = 0; i < batchSize && completed < totalGames; i++) {
        const { away, home } = getSampleTeams();
        const engine = new GameEngine({ away, home, ballpark, seed: Date.now() + completed });
        const result = engine.simulateGame();
        accumulator.addGame(result);
        completed++;
      }
      setProgress(Math.round((completed / totalGames) * 100));

      if (completed < totalGames) {
        requestAnimationFrame(runBatch);
      } else {
        const avgs = accumulator.getLeagueAverages();
        setResults({
          ...avgs,
          totalGames,
          simTime: performance.now() - start,
        });
        setRunning(false);
      }
    };

    requestAnimationFrame(runBatch);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={simulate} disabled={running} data-testid="sim-bulk-btn">
          {running ? `Simulating... ${progress}%` : 'Simulate 100 Games'}
        </Button>
      </div>

      {running && (
        <div className="w-full bg-navy-lighter rounded-full h-2">
          <div
            className="bg-gold h-2 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {results && (
        <Panel title="Aggregate Statistics (100 Games)" className="max-w-2xl">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="bulk-results">
            <StatCard label="Batting Average" value={fmt3(results.avg)} target=".230-.270" pass={results.avg >= 0.23 && results.avg <= 0.27} />
            <StatCard label="K%" value={`${(results.kPct * 100).toFixed(1)}%`} target="18-26%" pass={results.kPct >= 0.18 && results.kPct <= 0.26} />
            <StatCard label="BB%" value={`${(results.bbPct * 100).toFixed(1)}%`} target="6-10%" pass={results.bbPct >= 0.06 && results.bbPct <= 0.10} />
            <StatCard label="HR%" value={`${(results.hrPct * 100).toFixed(1)}%`} target="2-4%" pass={results.hrPct >= 0.02 && results.hrPct <= 0.04} />
            <StatCard label="Runs/Game" value={fmt2(results.runsPerGame)} target="3.5-5.5" pass={results.runsPerGame >= 3.5 && results.runsPerGame <= 5.5} />
            <StatCard label="League ERA" value={fmt2(results.era)} target="3.50-5.00" pass={results.era >= 3.5 && results.era <= 5.0} />
          </div>
          <p className="text-cream-dim text-xs font-mono mt-4">
            Simulated in {results.simTime.toFixed(0)}ms ({(results.simTime / results.totalGames).toFixed(1)}ms/game)
          </p>
        </Panel>
      )}
    </div>
  );
}

function StatCard({ label, value, target, pass }: { label: string; value: string; target: string; pass: boolean }) {
  return (
    <div className={cn(
      'p-3 rounded-lg border',
      pass ? 'bg-green/10 border-green-light/30' : 'bg-red/10 border-red/30',
    )}>
      <p className="text-cream-dim text-xs font-mono">{label}</p>
      <p className={cn('text-2xl font-mono font-bold mt-1', pass ? 'text-green-light' : 'text-red')} data-testid={`stat-${label.toLowerCase().replace(/[^a-z]/g, '')}`}>
        {value}
      </p>
      <p className="text-cream-dim/50 text-xs font-mono mt-1">Target: {target}</p>
    </div>
  );
}

// ─── Pitch-by-Pitch ─────────────────────────────────────────
function PitchByPitchTab() {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback(() => {
    const { away, home } = getSampleTeams();
    const ballpark = getNeutralBallpark();
    const eng = new GameEngine({ away, home, ballpark, seed: Date.now() });
    setEngine(eng);
    setEvents([]);
    setGameOver(false);
    setGameState(eng.getState());
  }, []);

  const nextAtBat = useCallback(() => {
    if (!engine) return;
    const result = engine.simulateNextAtBat();
    setEvents(prev => [...prev, ...result.events]);
    setGameOver(result.gameOver);
    setGameState({ ...engine.getState() });
  }, [engine]);

  // Auto-scroll play-by-play
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const state = gameState;
  const inning = state?.inning;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {!engine ? (
          <Button onClick={startGame} data-testid="start-pbp-btn">Start New Game</Button>
        ) : (
          <>
            <Button onClick={nextAtBat} disabled={gameOver} data-testid="next-ab-btn">
              {gameOver ? 'Game Over' : 'Next At-Bat'}
            </Button>
            <Button variant="secondary" onClick={startGame}>New Game</Button>
          </>
        )}
      </div>

      {state && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="pbp-dashboard">
          {/* Game Info */}
          <div className="lg:col-span-2 space-y-4">
            <Panel title="Line Score">
              <LineScore game={state} />
            </Panel>

            {/* Count + Situation */}
            {inning && !gameOver && (
              <Panel>
                <div className="flex items-center gap-6 font-mono text-sm">
                  <div>
                    <span className="text-cream-dim">Inning: </span>
                    <span className="text-gold font-bold" data-testid="current-inning">
                      {inning.half === 'top' ? 'Top' : 'Bot'} {inning.inning}
                    </span>
                  </div>
                  <div>
                    <span className="text-cream-dim">Outs: </span>
                    <span className="text-cream font-bold" data-testid="current-outs">{inning.outs}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cream-dim">Bases: </span>
                    <span className={cn('w-3 h-3 rotate-45 border', inning.bases.first ? 'bg-gold border-gold' : 'border-cream-dim/30')} />
                    <span className={cn('w-3 h-3 rotate-45 border', inning.bases.second ? 'bg-gold border-gold' : 'border-cream-dim/30')} />
                    <span className={cn('w-3 h-3 rotate-45 border', inning.bases.third ? 'bg-gold border-gold' : 'border-cream-dim/30')} />
                  </div>
                </div>
              </Panel>
            )}

            {gameOver && state.boxScore.awayBatters.length > 0 && (
              <BoxScoreTable game={state} />
            )}
          </div>

          {/* Play-by-Play Log */}
          <Panel title="Play-by-Play" className="lg:col-span-1">
            <div ref={logRef} className="overflow-y-auto" style={{ maxHeight: '500px' }}>
              <PlayByPlay events={events} maxHeight="500px" />
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
