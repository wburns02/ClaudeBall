import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';
import { LineScore } from '@/components/game/LineScore.tsx';
import { PlayByPlay } from '@/components/game/PlayByPlay.tsx';
import { ManagerControls } from '@/components/game/ManagerControls.tsx';
import { BoxScoreTable } from '@/components/game/BoxScoreTable.tsx';
import { GameEngine } from '@/engine/core/GameEngine.ts';
import { getSampleTeams } from '@/engine/data/sampleTeams.ts';
import { getNeutralBallpark } from '@/engine/data/ballparks.ts';
import type { GameState, GameEvent } from '@/engine/types/index.ts';
import type { Team } from '@/engine/types/team.ts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts.ts';

interface LiveGameLocationState {
  awayTeam?: Team;
  homeTeam?: Team;
}

export function LiveGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LiveGameLocationState | null;

  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const autoPlayRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Initialize game
  useEffect(() => {
    let away: Team, home: Team;
    if (locationState?.awayTeam && locationState?.homeTeam) {
      away = JSON.parse(JSON.stringify(locationState.awayTeam)) as Team;
      home = JSON.parse(JSON.stringify(locationState.homeTeam)) as Team;
    } else {
      const sample = getSampleTeams();
      away = sample.away;
      home = sample.home;
    }
    const ballpark = getNeutralBallpark();
    const eng = new GameEngine({ away, home, ballpark, seed: Date.now() });
    setEngine(eng);
    setGameState(eng.getState());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nextAtBat = useCallback(() => {
    if (!engine) return;
    const result = engine.simulateNextAtBat();
    setEvents(prev => [...prev, ...result.events]);
    setGameOver(result.gameOver);
    setGameState({ ...engine.getState() });
    if (result.gameOver) {
      setIsAutoPlaying(false);
      autoPlayRef.current = false;
    }
  }, [engine]);

  // Auto-play loop
  useEffect(() => {
    if (!isAutoPlaying || gameOver) return;
    autoPlayRef.current = true;

    const delay = Math.max(50, 800 / speed);
    const interval = setInterval(() => {
      if (!autoPlayRef.current) {
        clearInterval(interval);
        return;
      }
      nextAtBat();
    }, delay);

    return () => {
      clearInterval(interval);
      autoPlayRef.current = false;
    };
  }, [isAutoPlaying, speed, nextAtBat, gameOver]);

  const handleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      autoPlayRef.current = false;
    } else {
      setIsAutoPlaying(true);
    }
  }, [isAutoPlaying]);

  const handleSimToEnd = useCallback(() => {
    if (!engine) return;
    if (gameOver) {
      // New game
      const { away, home } = getSampleTeams();
      const ballpark = getNeutralBallpark();
      const eng = new GameEngine({ away, home, ballpark, seed: Date.now() });
      setEngine(eng);
      setGameState(eng.getState());
      setEvents([]);
      setGameOver(false);
      return;
    }
    // Sim remaining
    let result = engine.simulateNextAtBat();
    const allEvents: GameEvent[] = [...result.events];
    while (!result.gameOver) {
      result = engine.simulateNextAtBat();
      allEvents.push(...result.events);
    }
    setEvents(prev => [...prev, ...allEvents]);
    setGameOver(true);
    setGameState({ ...engine.getState() });
    setIsAutoPlaying(false);
  }, [engine, gameOver]);

  // Auto-scroll
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNextAtBat: nextAtBat,
    onAutoPlay: handleAutoPlay,
    onSimToEnd: handleSimToEnd,
    onSpeedSelect: setSpeed,
    onEscape: () => navigate('/'),
  });

  if (!gameState) return null;

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-gold tracking-wide uppercase">
          {gameState.away.city} {gameState.away.name} @ {gameState.home.city} {gameState.home.name}
        </h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Menu</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Diamond area + controls */}
        <div className="lg:col-span-1 space-y-4">
          <ManagerControls
            game={gameState}
            isUserHome={true}
            onNextAtBat={nextAtBat}
            onAutoPlay={handleAutoPlay}
            onSimToEnd={handleSimToEnd}
            isAutoPlaying={isAutoPlaying}
            gameOver={gameOver}
            speed={speed}
            onSpeedChange={setSpeed}
          />
        </div>

        {/* Main game area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Diamond placeholder — will be DiamondView in full implementation */}
          <Panel>
            <div className="bg-[#1a2235] rounded-lg overflow-hidden" style={{ height: '400px' }}>
              <div className="w-full h-full flex items-center justify-center" id="diamond-container">
                {/* Diamond renders here when DiamondView component is available */}
                <div className="text-center space-y-4">
                  {/* Simple ASCII diamond */}
                  <pre className="text-cream font-mono text-xs leading-tight select-none">
{`          ◆ 2B
         / \\
        /   \\
   3B ◆     ◆ 1B
        \\   /
         \\ /
          ◆ HP`}
                  </pre>
                  <div className="flex gap-4 justify-center text-sm font-mono">
                    <span className="text-cream-dim">
                      {gameState.inning.half === 'top' ? '▲' : '▼'} {gameState.inning.inning}
                    </span>
                    <span className="text-cream-dim">{gameState.inning.outs} out</span>
                    <span className="text-gold">
                      {gameState.inning.bases.first ? '1B' : ''}
                      {gameState.inning.bases.second ? ' 2B' : ''}
                      {gameState.inning.bases.third ? ' 3B' : ''}
                      {!gameState.inning.bases.first && !gameState.inning.bases.second && !gameState.inning.bases.third ? 'Bases empty' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Line Score">
            <LineScore game={gameState} />
          </Panel>
        </div>

        {/* Play-by-play */}
        <div className="lg:col-span-1">
          <Panel title="Play-by-Play" className="h-full">
            <div ref={logRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              <PlayByPlay events={events} maxHeight="600px" />
            </div>
          </Panel>
        </div>
      </div>

      {/* Box Score (shown when game ends) */}
      {gameOver && gameState.boxScore.awayBatters.length > 0 && (
        <div className="mt-4">
          <BoxScoreTable game={gameState} />
        </div>
      )}
    </div>
  );
}
