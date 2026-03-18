import { create } from 'zustand';
import { InteractiveGameEngine } from '@/engine/core/InteractiveGameEngine.ts';
import { getSampleTeams } from '@/engine/data/sampleTeams.ts';
import { getNeutralBallpark } from '@/engine/data/ballparks.ts';
import type { GameState, GameEvent } from '@/engine/types/game.ts';
import type { Team } from '@/engine/types/team.ts';
import type { GamePhaseInteractive, UserSwingInput, UserPitchInput, PitchStepResult } from '@/engine/types/interactive.ts';

export type UserRole = 'batting' | 'pitching' | 'spectating';

interface GameStoreState {
  // Engine
  engine: InteractiveGameEngine | null;
  gameState: GameState | null;

  // Phase & flow
  phase: GamePhaseInteractive;
  userTeam: 'home' | 'away';
  userRole: UserRole;

  // Current at-bat tracking
  currentCount: { balls: number; strikes: number };
  lastPitchResult: PitchStepResult | null;

  // Events log
  events: GameEvent[];

  // Playback speed (1=slow, 10=fast)
  gameSpeed: number;

  // Auto-play
  isAutoPlaying: boolean;
}

interface GameStoreActions {
  /** Initialize or re-initialize a game */
  initGame: (awayTeam?: Team, homeTeam?: Team, userTeam?: 'home' | 'away') => void;

  /** Start the next at-bat (sets up InteractiveAtBat) */
  startNextAtBat: () => void;

  /** User submits a pitch input */
  submitPitch: (input: UserPitchInput) => PitchStepResult | null;

  /** User submits a swing/take input */
  submitSwing: (input: UserSwingInput) => PitchStepResult | null;

  /** Called when animation completes — moves from 'animating' to next phase */
  onAnimationComplete: () => void;

  /** CPU advances one pitch automatically */
  autoAdvance: () => PitchStepResult | null;

  /** Sim remaining game instantly */
  simToEnd: () => void;

  /** Toggle auto-play */
  toggleAutoPlay: () => void;

  /** Set game speed */
  setGameSpeed: (speed: number) => void;

  /** Set user team */
  setUserTeam: (team: 'home' | 'away') => void;

  /** Reset / new game */
  resetGame: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

export const useGameStore = create<GameStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  engine: null,
  gameState: null,
  phase: 'idle',
  userTeam: 'home',
  userRole: 'batting',
  currentCount: { balls: 0, strikes: 0 },
  lastPitchResult: null,
  events: [],
  gameSpeed: 3,
  isAutoPlaying: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  initGame: (awayTeam, homeTeam, userTeam = 'home') => {
    const sample = getSampleTeams();
    const away = awayTeam ?? sample.away;
    const home = homeTeam ?? sample.home;
    const ballpark = getNeutralBallpark();
    const engine = new InteractiveGameEngine({ away, home, ballpark, seed: Date.now() });

    set({
      engine,
      gameState: engine.getState(),
      phase: 'idle',
      userTeam,
      userRole: userTeam === 'home' ? 'batting' : 'pitching', // Home bats bottom (2nd), will flip
      currentCount: { balls: 0, strikes: 0 },
      lastPitchResult: null,
      events: [],
      isAutoPlaying: false,
    });
  },

  startNextAtBat: () => {
    const { engine } = get();
    if (!engine) return;

    if (engine.isGameOver()) {
      set({ phase: 'game_over', gameState: { ...engine.getState() } });
      return;
    }

    const ab = engine.startNextAtBat();
    if (!ab) {
      // Half-inning ended — need to keep going
      const state = engine.getState();
      set({ gameState: { ...state }, phase: 'post_ab' });
      return;
    }

    const { userTeam } = get();
    const turn = engine.isUserTurn(userTeam);
    const role: UserRole = turn === 'batting' ? 'batting' : turn === 'pitching' ? 'pitching' : 'spectating';

    set({
      gameState: { ...engine.getState() },
      currentCount: { balls: 0, strikes: 0 },
      userRole: role,
      phase: role === 'batting' ? 'awaiting_swing' :
             role === 'pitching' ? 'awaiting_pitch' :
             'cpu_pitch',
    });
  },

  submitPitch: (input: UserPitchInput) => {
    const { engine, phase } = get();
    if (!engine || phase !== 'awaiting_pitch') return null;

    try {
      const result = engine.submitInput(input);
      const count = result.atBatOver ? { balls: 0, strikes: 0 } : result.count;

      set({
        lastPitchResult: result,
        currentCount: count,
        gameState: { ...engine.getState() },
        events: [...engine.getState().events],
        phase: 'animating',
      });

      return result;
    } catch {
      return null;
    }
  },

  submitSwing: (input: UserSwingInput) => {
    const { engine, phase } = get();
    if (!engine || phase !== 'awaiting_swing') return null;

    try {
      const result = engine.submitInput(input);
      const count = result.atBatOver ? { balls: 0, strikes: 0 } : result.count;

      set({
        lastPitchResult: result,
        currentCount: count,
        gameState: { ...engine.getState() },
        events: [...engine.getState().events],
        phase: 'animating',
      });

      return result;
    } catch {
      return null;
    }
  },

  onAnimationComplete: () => {
    const { engine, lastPitchResult } = get();
    if (!engine) return;

    if (!lastPitchResult) {
      set({ phase: 'post_pitch' });
      return;
    }

    if (lastPitchResult.atBatOver) {
      if (engine.isGameOver()) {
        set({ phase: 'game_over', gameState: { ...engine.getState() } });
      } else {
        set({ phase: 'post_ab' });
      }
    } else {
      set({ phase: 'post_pitch' });
    }
  },

  autoAdvance: () => {
    const { engine, phase } = get();
    if (!engine) return null;

    // Only auto-advance when it's a CPU pitch
    if (phase !== 'cpu_pitch' && phase !== 'post_pitch' && phase !== 'post_ab') {
      return null;
    }

    // If post_ab, start next at-bat
    if (phase === 'post_ab') {
      if (engine.isGameOver()) {
        set({ phase: 'game_over', gameState: { ...engine.getState() } });
        return null;
      }
      get().startNextAtBat();
      return null;
    }

    // If no active at-bat, start one
    if (!engine.getActiveAtBat()) {
      get().startNextAtBat();
      return null;
    }

    try {
      const result = engine.advanceCPUPitch();
      const count = result.atBatOver ? { balls: 0, strikes: 0 } : result.count;

      set({
        lastPitchResult: result,
        currentCount: count,
        gameState: { ...engine.getState() },
        events: [...engine.getState().events],
        phase: 'animating',
      });

      return result;
    } catch {
      return null;
    }
  },

  simToEnd: () => {
    const { engine } = get();
    if (!engine) return;

    const finalState = engine.simToEnd();
    set({
      gameState: { ...finalState },
      events: [...finalState.events],
      phase: 'game_over',
      isAutoPlaying: false,
    });
  },

  toggleAutoPlay: () => {
    set(state => ({ isAutoPlaying: !state.isAutoPlaying }));
  },

  setGameSpeed: (speed: number) => {
    set({ gameSpeed: speed });
  },

  setUserTeam: (team: 'home' | 'away') => {
    set({ userTeam: team });
  },

  resetGame: () => {
    const sample = getSampleTeams();
    const ballpark = getNeutralBallpark();
    const engine = new InteractiveGameEngine({
      away: sample.away,
      home: sample.home,
      ballpark,
      seed: Date.now(),
    });

    set({
      engine,
      gameState: engine.getState(),
      phase: 'idle',
      currentCount: { balls: 0, strikes: 0 },
      lastPitchResult: null,
      events: [],
      isAutoPlaying: false,
    });
  },
}));
