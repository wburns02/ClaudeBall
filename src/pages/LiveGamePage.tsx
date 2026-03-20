import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';
import { LineScore } from '@/components/game/LineScore.tsx';
import { BoxScoreTable } from '@/components/game/BoxScoreTable.tsx';
import { BroadcastScoreboard } from '@/components/game/BroadcastScoreboard.tsx';
import { BroadcastControls } from '@/components/game/BroadcastControls.tsx';
import { FloatingPlayByPlay } from '@/components/game/FloatingPlayByPlay.tsx';
import { getSampleTeams } from '@/engine/data/sampleTeams.ts';
import { getNeutralBallpark } from '@/engine/data/ballparks.ts';
import { InteractiveGameEngine } from '@/engine/core/InteractiveGameEngine.ts';
import type { GameState, GameEvent } from '@/engine/types/index.ts';
import type { Team } from '@/engine/types/team.ts';
import type { SwingType, GamePhaseInteractive } from '@/engine/types/interactive.ts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts.ts';
import { DiamondView, baseStateToBools } from '@/components/diamond/DiamondView.tsx';
import type { UserRole } from '@/stores/gameStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { WinProbabilityMeter } from '@/components/game/WinProbabilityMeter.tsx';
import type { WPSnapshot } from '@/engine/stats/WinProbability.ts';
import { calcWinProbability } from '@/engine/stats/WinProbability.ts';

interface LiveGameLocationState {
  awayTeam?: Team;
  homeTeam?: Team;
  userTeam?: 'home' | 'away';
}

// ── Team selector — full-page TV style ────────────────────────────────────────
function TeamSelector({ onStart }: { onStart: (userTeam: 'home' | 'away') => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8"
      style={{ background: '#0a0f1a' }}
    >
      {/* Title block */}
      <div className="text-center space-y-2">
        <div
          className="font-mono text-xs uppercase tracking-[0.3em]"
          style={{ color: 'rgba(212,168,67,0.55)' }}
        >
          ClaudeBall Live
        </div>
        <h1
          className="font-display text-5xl uppercase tracking-wide"
          style={{ color: '#d4a843' }}
        >
          Choose Your Team
        </h1>
        <p className="text-cream-dim text-sm max-w-xs mx-auto mt-2">
          Select which side you want to control pitch-by-pitch.
          The other team will be CPU-managed.
        </p>
      </div>

      {/* Team cards */}
      <div className="flex gap-6">
        {/* Away card */}
        <button
          onClick={() => onStart('away')}
          style={{
            background: 'rgba(26,34,53,0.9)',
            border: '2px solid rgba(212,168,67,0.25)',
            borderRadius: 12,
            padding: '32px 48px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s, transform 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4a843';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,168,67,0.25)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'none';
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-cream-dim mb-2">Visiting</div>
          <div className="font-display text-3xl text-gold uppercase tracking-wide">Away Team</div>
          <div className="font-mono text-xs text-cream-dim mt-3">Bats first (top innings)</div>
        </button>

        {/* Home card */}
        <button
          onClick={() => onStart('home')}
          style={{
            background: 'rgba(26,34,53,0.9)',
            border: '2px solid rgba(212,168,67,0.25)',
            borderRadius: 12,
            padding: '32px 48px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s, transform 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4a843';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,168,67,0.25)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'none';
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-cream-dim mb-2">Home Field</div>
          <div className="font-display text-3xl text-gold uppercase tracking-wide">Home Team</div>
          <div className="font-mono text-xs text-cream-dim mt-3">Bats last (bottom innings)</div>
        </button>
      </div>

      {/* Spectate option */}
      <button
        onClick={() => onStart('home')}
        className="font-mono text-xs text-cream-dim/50 hover:text-cream-dim cursor-pointer"
        style={{ textDecoration: 'underline', textUnderlineOffset: 4 }}
      >
        Spectate — CPU controls both teams
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LiveGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LiveGameLocationState | null;

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
  const [showPlayByPlay, setShowPlayByPlay] = useState(true);
  const [showBoxScore, setShowBoxScore] = useState(false);
  const [wpHistory, setWpHistory] = useState<WPSnapshot[]>([]);
  const lastInningHalfRef = useRef<string>('');

  const autoPlayRef = useRef(false);
  const engineRef = useRef<InteractiveGameEngine | null>(null);
  const statsRecordedRef = useRef(false);

  // Franchise + stats store for recording results
  const { season, recordGameResult } = useFranchiseStore();
  const { recordGameStats } = useStatsStore();
  const [searchParams] = useSearchParams();
  const franchiseGameId = searchParams.get('gameId');

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
    setGameState(eng.getState());
    setUserTeam(chosenTeam);
    setGameChosen(true);
    setPhase('idle');
    setEvents([]);
    setCurrentCount({ balls: 0, strikes: 0 });
    setGameOver(false);
  }, [locationState]);

  // Auto-handle location state
  useEffect(() => {
    if (locationState?.userTeam && !gameChosen) {
      initEngine(locationState.userTeam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Record stats when a franchise game ends
  useEffect(() => {
    if (!gameOver || !gameState || statsRecordedRef.current) return;
    if (gameState.phase !== 'final') return;
    statsRecordedRef.current = true;

    const box = gameState.boxScore;
    if (!box.awayBatters.length && !box.homeBatters.length) return;

    const awayId = gameState.away.id;
    const homeId = gameState.home.id;
    const year = season?.year ?? 2026;
    const gameDay = season?.currentDay ?? 0;
    const gId = franchiseGameId ?? gameState.id;

    // Record the full box score stats
    const awayTotal = gameState.score.away.reduce((a, b) => a + b, 0);
    const homeTotal = gameState.score.home.reduce((a, b) => a + b, 0);
    recordGameStats(
      gId, gameDay, year,
      awayId, homeId,
      box.awayBatters, box.homeBatters,
      box.awayPitchers, box.homePitchers,
      (playerId) => {
        const inAway = gameState.away.roster.players.some(p => p.id === playerId);
        return inAway ? awayId : homeId;
      },
      (playerId) => {
        const p = gameState.away.roster.players.find(pl => pl.id === playerId)
          ?? gameState.home.roster.players.find(pl => pl.id === playerId);
        return p?.position ?? 'DH';
      },
      awayTotal,
      homeTotal,
    );

    // If franchise game, record the result
    if (franchiseGameId) {
      recordGameResult(franchiseGameId, awayTotal, homeTotal);
    }
  }, [gameOver, gameState, franchiseGameId, season, recordGameStats, recordGameResult]);

  // ── Core game flow ────────────────────────────────────────────────────────

  const startNextAtBat = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    if (eng.isGameOver()) {
      setGameOver(true);
      setPhase('game_over');
      const finalState = eng.getState();
      // Record final WP snapshot
      const awayF = finalState.score.away.reduce((a, b) => a + b, 0);
      const homeF = finalState.score.home.reduce((a, b) => a + b, 0);
      setWpHistory(h => [...h, {
        label: 'F',
        homeWP: homeF > awayF ? 100 : homeF < awayF ? 0 : 50,
      }]);
      setGameState({ ...finalState });
      return;
    }

    const ab = eng.startNextAtBat();
    // Sync events immediately so any inning_change event added by startNextAtBat is animated
    const currentState = eng.getState();
    setEvents([...currentState.events]);

    // Track WP snapshot at each inning change
    const halfKey = `${currentState.inning.inning}-${currentState.inning.half}`;
    if (halfKey !== lastInningHalfRef.current) {
      lastInningHalfRef.current = halfKey;
      const aS = currentState.score.away.reduce((a, b) => a + b, 0);
      const hS = currentState.score.home.reduce((a, b) => a + b, 0);
      const runners = [currentState.inning.bases.first, currentState.inning.bases.second, currentState.inning.bases.third].filter(Boolean).length;
      const wp = calcWinProbability(
        currentState.inning.inning, currentState.inning.half,
        currentState.inning.outs, hS - aS, runners
      );
      setWpHistory(h => [...h, {
        label: `${currentState.inning.half === 'top' ? 'T' : 'B'}${currentState.inning.number}`,
        homeWP: wp,
      }]);
    }

    if (!ab) {
      setGameState({ ...currentState });
      return;
    }

    const currentUserTeam = userTeam;
    const turn = currentUserTeam ? eng.isUserTurn(currentUserTeam) : 'none';
    const role: UserRole = turn === 'batting' ? 'batting' : turn === 'pitching' ? 'pitching' : 'spectating';

    setUserRole(role);
    setCurrentCount({ balls: 0, strikes: 0 });
    setGameState({ ...currentState });

    if (role === 'batting') {
      setPhase('awaiting_swing');
    } else if (role === 'pitching') {
      setPhase('awaiting_pitch');
    } else {
      setPhase('cpu_pitch');
    }
  }, [userTeam]);

  const resolveOnePitch = useCallback((input?: Parameters<InteractiveGameEngine['submitInput']>[0]) => {
    const eng = engineRef.current;
    if (!eng) return;

    if (!eng.getActiveAtBat()) {
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
      // eng.getState().events only has events that ended an at-bat (via applyAtBatResult).
      // For mid-at-bat pitches (ball, strike, foul), result.events holds the pitch event
      // but it's NOT yet in state.events. Merge them so DiamondView animates every pitch.
      const engineEvents = eng.getState().events;
      const pitchEvents = result.events ?? [];
      // Avoid duplicates: pitchEvents are already in engineEvents when atBatOver=true
      const mergedEvents = result.atBatOver
        ? engineEvents
        : [...engineEvents, ...pitchEvents];
      setEvents(mergedEvents);
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
      }
    } catch {
      // Ignore errors
    }
  }, [startNextAtBat]);

  // Next pitch: context-aware
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

  // Pitching: throw with default center-zone fastball
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
    const rep = pitchingTeam.roster.players
      .find(p => p.id === pitchingTeam.pitcherId)?.pitching.repertoire ?? ['fastball'];
    resolveOnePitch({
      pitchType: rep[0],
      targetZone: { row: 2, col: 2 },
      meterAccuracy: 0.75,
    });
  }, [phase, nextPitch, resolveOnePitch]);

  // Auto-play loop
  useEffect(() => {
    if (!isAutoPlaying || gameOver) return;
    autoPlayRef.current = true;

    const delay = Math.max(80, 1200 / speed);
    const interval = setInterval(() => {
      if (!autoPlayRef.current) { clearInterval(interval); return; }
      const eng = engineRef.current;
      if (!eng) { clearInterval(interval); return; }

      if (phase === 'post_ab' || phase === 'idle') {
        startNextAtBat();
      } else if (phase === 'awaiting_swing') {
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

    if (gameOver || !eng) {
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
      setGameState(newEng.getState());
      setEvents([]);
      setGameOver(false);
      setPhase('idle');
      setCurrentCount({ balls: 0, strikes: 0 });
      setShowBoxScore(false);
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
  const awayScore = gameState.score.away.reduce((a, b) => a + b, 0);
  const homeScore = gameState.score.home.reduce((a, b) => a + b, 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0f1a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Diamond fill area (flex-1, relative for overlays) ── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

        {/* Diamond canvas — fills the area */}
        <DiamondView
          fullScreen
          bases={baseStateToBools(gameState.inning.bases)}
          events={events}
          width={800}
          height={600}
        />

        {/* ── TOP-LEFT: Scoreboard overlay ── */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
          }}
        >
          <BroadcastScoreboard
            game={gameState}
            currentCount={currentCount}
            userTeam={userTeam}
            gameOver={gameOver}
          />
        </div>

        {/* ── TOP-RIGHT: Menu + Play-by-play ── */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          {/* Menu row */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest">
              You: {isUserHome ? gameState.home.abbreviation : gameState.away.abbreviation}
            </span>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'rgba(10,15,26,0.85)',
                border: '1px solid rgba(212,168,67,0.22)',
                borderRadius: 5,
                padding: '3px 12px',
                fontSize: 11,
                fontFamily: 'IBM Plex Mono, monospace',
                color: '#e8e0d4',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              Menu [Esc]
            </button>
          </div>

          {/* Box score toggle (shown when game over) */}
          {gameOver && (
            <button
              onClick={() => setShowBoxScore(v => !v)}
              style={{
                background: 'rgba(10,15,26,0.85)',
                border: '1px solid rgba(212,168,67,0.22)',
                borderRadius: 5,
                padding: '3px 12px',
                fontSize: 11,
                fontFamily: 'IBM Plex Mono, monospace',
                color: '#d4a843',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              {showBoxScore ? 'Hide Box Score' : 'Box Score'}
            </button>
          )}

          {/* Play-by-play floating panel */}
          <FloatingPlayByPlay
            events={events}
            visible={showPlayByPlay}
            onToggle={() => setShowPlayByPlay(v => !v)}
          />
        </div>

        {/* ── BOTTOM-LEFT: Win Probability Meter ── */}
        {!gameOver && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              zIndex: 10,
            }}
          >
            <WinProbabilityMeter
              game={gameState}
              history={wpHistory}
            />
          </div>
        )}

        {/* ── CENTER phase hint (idle / post_ab / game_over) ── */}
        {(phase === 'idle' || phase === 'post_ab' || phase === 'game_over') && (
          <div
            style={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                background: 'rgba(10,15,26,0.85)',
                border: '1px solid rgba(212,168,67,0.3)',
                borderRadius: 6,
                padding: '6px 20px',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 13,
                color: phase === 'game_over' ? '#d4a843' : '#b8b0a4',
                letterSpacing: '0.05em',
              }}
            >
              {phase === 'game_over'
                ? `FINAL — ${gameState.away.abbreviation} ${awayScore}, ${gameState.home.abbreviation} ${homeScore}`
                : phase === 'idle'
                ? 'Press Space to begin'
                : 'Space → next batter'}
            </span>
          </div>
        )}

        {/* ── CPU pitch hint ── */}
        {phase === 'cpu_pitch' && !isAutoPlaying && (
          <div
            style={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                background: 'rgba(10,15,26,0.75)',
                borderRadius: 5,
                padding: '4px 14px',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                color: 'rgba(184,176,164,0.7)',
              }}
            >
              CPU pitching… [Space]
            </span>
          </div>
        )}

        {/* ── Game-over box score overlay ── */}
        {gameOver && showBoxScore && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              background: 'rgba(10,15,26,0.93)',
              backdropFilter: 'blur(6px)',
              overflowY: 'auto',
              padding: '24px',
            }}
          >
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-gold uppercase tracking-wide">
                  Final: {gameState.away.abbreviation} {awayScore} — {gameState.home.abbreviation} {homeScore}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowBoxScore(false)}>
                  Close ✕
                </Button>
              </div>
              <Panel title="Line Score">
                <LineScore game={gameState} />
              </Panel>
              {gameState.boxScore.awayBatters.length > 0 && (
                <BoxScoreTable game={gameState} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR: BroadcastControls ── */}
      <BroadcastControls
        game={gameState}
        userRole={userRole}
        currentCount={currentCount}
        phase={phase}
        selectedSwingType={selectedSwingType}
        onSwingTypeChange={setSelectedSwingType}
        onSwing={handleSwing}
        onTake={handleTake}
        onNextPitch={handlePitch}
        onAutoPlay={handleAutoPlay}
        onSimToEnd={handleSimToEnd}
        isAutoPlaying={isAutoPlaying}
        gameOver={gameOver}
        speed={speed}
        onSpeedChange={setSpeed}
      />
    </div>
  );
}
