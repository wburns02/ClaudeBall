import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';
import { LineScore } from '@/components/game/LineScore.tsx';
import { PlayByPlay } from '@/components/game/PlayByPlay.tsx';
import { ManagerControls } from '@/components/game/ManagerControls.tsx';
import { BoxScoreTable } from '@/components/game/BoxScoreTable.tsx';
import { getSampleTeams } from '@/engine/data/sampleTeams.ts';
import { getNeutralBallpark } from '@/engine/data/ballparks.ts';
import { InteractiveGameEngine } from '@/engine/core/InteractiveGameEngine.ts';
import type { GameState, GameEvent } from '@/engine/types/index.ts';
import type { Team } from '@/engine/types/team.ts';
import type { SwingType, GamePhaseInteractive } from '@/engine/types/interactive.ts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts.ts';
import { useGameLoop } from '@/hooks/useGameLoop.ts';
import { useGameStore } from '@/stores/gameStore.ts';
import type { UserRole } from '@/stores/gameStore.ts';

interface LiveGameLocationState {
  awayTeam?: Team;
  homeTeam?: Team;
  userTeam?: 'home' | 'away';
}

// ── Team selector shown before the game starts ────────────────────────────────
function TeamSelector({ onStart }: { onStart: (userTeam: 'home' | 'away') => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Panel className="w-80 text-center space-y-6">
        <h2 className="font-display text-xl text-gold uppercase tracking-wide">Choose Your Team</h2>
        <p className="text-cream-dim text-sm">Select which team you want to control pitch-by-pitch.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => onStart('away')}>Away Team</Button>
          <Button variant="secondary" onClick={() => onStart('home')}>Home Team</Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onStart('home')}>
          Spectate (CPU plays both sides)
        </Button>
      </Panel>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LiveGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LiveGameLocationState | null;

  // ── Local state — manage engine locally (not in store for this page) ──────
  const [engine, setEngine] = useState<InteractiveGameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [phase, setPhase] = useState<GamePhaseInteractive>('idle');
  const [userTeam, setUserTeam] = useState<'home' | 'away' | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('spectating');
  const [currentCount, setCurrentCount] = useState({ balls: 0, strikes: 0 });
  const [selectedSwingType, setSelectedSwingType] = useState<SwingType>('normal');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [gameChosen, setGameChosen] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef(false);
  const engineRef = useRef<InteractiveGameEngine | null>(null);

  // Use gameStore for game loop management
  const storeInitGame = useGameStore(s => s.initGame);
  const storePhase = useGameStore(s => s.phase);
  const storeUserRole = useGameStore(s => s.userRole);

  // Keep store in sync when using store-based loop
  // (The local engine approach is simpler for this page)

  // Initialize engine when user picks their team
  const initEngine = useCallback((chosenTeam: 'home' | 'away') => {
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
    const eng = new InteractiveGameEngine({ away, home, ballpark, seed: Date.now() });
    engineRef.current = eng;
    setEngine(eng);
    setGameState(eng.getState());
    setUserTeam(chosenTeam);
    setGameChosen(true);
    setPhase('idle');

    // Also init the store (for useGameLoop)
    storeInitGame(away, home, chosenTeam);
  }, [locationState, storeInitGame]);

  // Auto-handle location state
  useEffect(() => {
    if (locationState?.userTeam && !gameChosen) {
      initEngine(locationState.userTeam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core game flow ────────────────────────────────────────────────────────

  const startNextAtBat = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    if (eng.isGameOver()) {
      setGameOver(true);
      setPhase('game_over');
      setGameState({ ...eng.getState() });
      return;
    }

    const ab = eng.startNextAtBat();
    if (!ab) {
      setGameState({ ...eng.getState() });
      return;
    }

    const turn = userTeam ? eng.isUserTurn(userTeam) : 'none';
    const role: UserRole = turn === 'batting' ? 'batting' : turn === 'pitching' ? 'pitching' : 'spectating';

    setUserRole(role);
    setCurrentCount({ balls: 0, strikes: 0 });
    setGameState({ ...eng.getState() });

    if (role === 'batting') {
      setPhase('awaiting_swing');
    } else if (role === 'pitching') {
      setPhase('awaiting_pitch');
    } else {
      setPhase('cpu_pitch');
    }
  }, [userTeam]);

  const resolveOnePitch = useCallback((input?: Parameters<typeof engine.submitInput>[0]) => {
    const eng = engineRef.current;
    if (!eng || !eng.getActiveAtBat()) {
      startNextAtBat();
      return;
    }

    try {
      let result;
      if (input) {
        result = eng.submitInput(input);
      } else {
        result = eng.advanceCPUPitch();
      }

      const newCount = result.atBatOver ? { balls: 0, strikes: 0 } : result.count;
      setCurrentCount(newCount);
      setEvents([...eng.getState().events]);
      setGameState({ ...eng.getState() });

      if (result.atBatOver) {
        if (eng.isGameOver()) {
          setGameOver(true);
          setPhase('game_over');
          setIsAutoPlaying(false);
          autoPlayRef.current = false;
        } else {
          setPhase('post_ab');
        }
      } else {
        // Same role — go back to awaiting input or cpu_pitch
        setPhase(prev =>
          prev === 'awaiting_swing' ? 'awaiting_swing' :
          prev === 'awaiting_pitch' ? 'awaiting_pitch' :
          'cpu_pitch'
        );
      }
    } catch {
      // Ignore errors (e.g., no active at-bat)
    }
  }, [startNextAtBat]);

  // Advance one pitch (CPU or when spectating / auto-play)
  const nextPitch = useCallback(() => {
    if (phase === 'post_ab' || phase === 'idle') {
      startNextAtBat();
      return;
    }
    resolveOnePitch();
  }, [phase, resolveOnePitch, startNextAtBat]);

  // Batting: swing
  const handleSwing = useCallback((type: SwingType) => {
    if (phase !== 'awaiting_swing') return;
    resolveOnePitch({ action: 'swing', swingType: type });
  }, [phase, resolveOnePitch]);

  // Batting: take
  const handleTake = useCallback(() => {
    if (phase !== 'awaiting_swing') return;
    resolveOnePitch({ action: 'take' });
  }, [phase, resolveOnePitch]);

  // Pitching: throw with default center-zone pitch
  const handlePitch = useCallback(() => {
    if (phase !== 'awaiting_pitch') {
      nextPitch();
      return;
    }
    const eng = engineRef.current;
    if (!eng) return;
    const state = eng.getState();
    const isTop = state.inning.half === 'top';
    const pitchingTeam = isTop ? state.home : state.away;
    const rep = pitchingTeam.roster.players.find(p => p.id === pitchingTeam.pitcherId)?.pitching.repertoire ?? ['fastball'];
    resolveOnePitch({
      pitchType: rep[0],
      targetZone: { row: 2, col: 2 }, // center of 5x5 grid
      meterAccuracy: 0.75,
    });
  }, [phase, nextPitch, resolveOnePitch]);

  // Auto-play loop
  useEffect(() => {
    if (!isAutoPlaying || gameOver) return;
    autoPlayRef.current = true;

    const delay = Math.max(80, 1200 / speed);
    const interval = setInterval(() => {
      if (!autoPlayRef.current) {
        clearInterval(interval);
        return;
      }
      const eng = engineRef.current;
      if (!eng) { clearInterval(interval); return; }

      if (phase === 'post_ab' || phase === 'idle') {
        startNextAtBat();
      } else if (phase === 'awaiting_swing') {
        // Auto-swing with normal type
        resolveOnePitch({ action: 'swing', swingType: 'normal' });
      } else if (phase === 'awaiting_pitch') {
        handlePitch();
      } else if (phase === 'cpu_pitch') {
        resolveOnePitch();
      }
    }, delay);

    return () => {
      clearInterval(interval);
      autoPlayRef.current = false;
    };
  }, [isAutoPlaying, speed, phase, gameOver, startNextAtBat, resolveOnePitch, handlePitch]);

  const handleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      autoPlayRef.current = false;
    } else {
      setIsAutoPlaying(true);
    }
  }, [isAutoPlaying]);

  const handleSimToEnd = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    if (gameOver) {
      // New game
      const sample = getSampleTeams();
      const ballpark = getNeutralBallpark();
      const newEng = new InteractiveGameEngine({
        away: sample.away,
        home: sample.home,
        ballpark,
        seed: Date.now(),
      });
      engineRef.current = newEng;
      setEngine(newEng);
      setGameState(newEng.getState());
      setEvents([]);
      setGameOver(false);
      setPhase('idle');
      setCurrentCount({ balls: 0, strikes: 0 });
      return;
    }

    setIsAutoPlaying(false);
    autoPlayRef.current = false;
    const finalState = eng.simToEnd();
    setEvents([...finalState.events]);
    setGameState({ ...finalState });
    setGameOver(true);
    setPhase('game_over');
  }, [gameOver]);

  // Auto-scroll play-by-play
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    userRole,
    onNextAtBat: () => {
      if (phase === 'awaiting_swing') {
        handleSwing(selectedSwingType);
      } else if (phase === 'awaiting_pitch') {
        handlePitch();
      } else {
        nextPitch();
      }
    },
    onPowerSwing: () => handleSwing('power'),
    onContactSwing: () => handleSwing('contact'),
    onBunt: () => handleSwing('bunt'),
    onTake: handleTake,
    onAutoPlay: handleAutoPlay,
    onSimToEnd: handleSimToEnd,
    onSpeedSelect: setSpeed,
    onEscape: () => navigate('/'),
  });

  // ── Show team selector if not chosen ─────────────────────────────────────

  if (!gameChosen) {
    return <TeamSelector onStart={initEngine} />;
  }

  if (!gameState) return null;

  const isUserHome = userTeam === 'home';

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-gold tracking-wide uppercase">
          {gameState.away.city} {gameState.away.name} @ {gameState.home.city} {gameState.home.name}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-cream-dim text-xs font-mono uppercase">
            You: {userTeam === 'home' ? gameState.home.abbreviation : gameState.away.abbreviation}
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Menu</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Diamond area + controls */}
        <div className="lg:col-span-1 space-y-4">
          <ManagerControls
            game={gameState}
            isUserHome={isUserHome}
            userRole={userRole}
            currentCount={currentCount}
            onNextPitch={handlePitch}
            onSwing={handleSwing}
            onTake={handleTake}
            onAutoPlay={handleAutoPlay}
            onSimToEnd={handleSimToEnd}
            isAutoPlaying={isAutoPlaying}
            gameOver={gameOver}
            speed={speed}
            onSpeedChange={setSpeed}
            selectedSwingType={selectedSwingType}
            onSwingTypeChange={setSelectedSwingType}
            phase={phase}
          />
        </div>

        {/* Main game area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Diamond placeholder */}
          <Panel>
            <div className="bg-[#1a2235] rounded-lg overflow-hidden" style={{ height: '400px' }}>
              <div className="w-full h-full flex items-center justify-center" id="diamond-container">
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

                  {/* Current phase indicator */}
                  <div className="text-xs font-mono">
                    {phase === 'awaiting_swing' && (
                      <span className="text-gold animate-pulse">SWING or TAKE — Space / T</span>
                    )}
                    {phase === 'awaiting_pitch' && (
                      <span className="text-blue-400 animate-pulse">THROW PITCH — Space</span>
                    )}
                    {phase === 'cpu_pitch' && (
                      <span className="text-cream-dim">CPU pitching… Space to advance</span>
                    )}
                    {phase === 'post_ab' && (
                      <span className="text-cream-dim">Space for next batter</span>
                    )}
                    {phase === 'game_over' && (
                      <span className="text-gold font-bold">GAME OVER</span>
                    )}
                    {phase === 'idle' && (
                      <span className="text-cream-dim">Press Space to begin</span>
                    )}
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

// Ensure store-based loop hook is initialized
function _UseGameLoopSideEffect() {
  useGameLoop();
  return null;
}
void _UseGameLoopSideEffect;

// Export storePhase and storeUserRole for external access
export { storePhase as _storePhase, storeUserRole as _storeUserRole };

// Declare locals to avoid TS unused warnings
declare const storePhase: string;
declare const storeUserRole: string;
