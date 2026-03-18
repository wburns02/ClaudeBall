// ── useGameAudio.ts ───────────────────────────────────────────────────────────
// React hook that maps game events to procedural sound effects.
// Manages crowd ambience lifecycle alongside the game.

import { useEffect, useRef, useCallback } from 'react';
import { soundEngine, crowdAmbience } from '@/audio/index.ts';
import { useSettingsStore } from '@/stores/settingsStore.ts';
import type { GameEvent } from '@/engine/types/game.ts';

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Call once near the top of your game component tree.
 * Pass the latest batch of GameEvents; the hook will detect new events
 * and trigger the appropriate sounds.
 *
 * @param events   Current game event log (append-only)
 * @param isActive Whether the game is actively playing (starts/stops ambience)
 */
export function useGameAudio(events: GameEvent[], isActive: boolean): void {
  const lastProcessedRef = useRef(0);
  const ambienceStartedRef = useRef(false);

  // ── Initialize AudioContext on first user interaction ──────────────────

  useEffect(() => {
    const unlock = () => {
      soundEngine.initialize();
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // ── Crowd ambience: start/stop with game activity ─────────────────────

  useEffect(() => {
    if (isActive) {
      if (!ambienceStartedRef.current) {
        crowdAmbience.start();
        crowdAmbience.setIntensity(3); // normal background murmur
        ambienceStartedRef.current = true;
      }
    } else {
      if (ambienceStartedRef.current) {
        crowdAmbience.stop();
        ambienceStartedRef.current = false;
      }
    }
  }, [isActive]);

  // ── Cleanup on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (ambienceStartedRef.current) {
        crowdAmbience.stop();
        ambienceStartedRef.current = false;
      }
    };
  }, []);

  // ── Event sound dispatch ──────────────────────────────────────────────

  const isSfxEnabled = useCallback((): boolean => {
    const s = useSettingsStore.getState();
    return s.sfxVolume > 0 && s.masterVolume > 0;
  }, []);

  useEffect(() => {
    if (events.length <= lastProcessedRef.current) return;

    // Process only new events since last render
    const newEvents = events.slice(lastProcessedRef.current);
    lastProcessedRef.current = events.length;

    if (!isSfxEnabled()) return;

    for (const event of newEvents) {
      handleEvent(event);
    }
  }, [events, isSfxEnabled]);
}

// ── Event→Sound mapping ───────────────────────────────────────────────────────

function handleEvent(event: GameEvent): void {
  switch (event.type) {
    case 'pitch':
      handlePitchEvent(event.result);
      break;

    case 'at_bat_result':
      handleAtBatResult(event.result);
      break;

    case 'inning_change':
      // Brief organ charge between innings
      setTimeout(() => soundEngine.playOrganCharge(), 300);
      crowdAmbience.setIntensity(3);
      break;

    case 'game_end':
      // Final roar then settle
      soundEngine.playCrowdCheer('roar');
      crowdAmbience.spike(9, 3000, 2);
      break;

    default:
      break;
  }
}

function handlePitchEvent(result: string): void {
  switch (result) {
    case 'ball':
      // Pitch whoosh, catcher pop, quiet umpire, light crowd murmur
      soundEngine.playPitchThrow();
      setTimeout(() => soundEngine.playBallInGlove(), 350);
      setTimeout(() => soundEngine.playUmpireBall(), 450);
      crowdAmbience.setIntensity(3);
      break;

    case 'called_strike':
      soundEngine.playPitchThrow();
      setTimeout(() => soundEngine.playBallInGlove(), 350);
      setTimeout(() => soundEngine.playUmpireStrike(), 500);
      soundEngine.playCrowdCheer('medium');
      crowdAmbience.setIntensity(5);
      break;

    case 'swinging_strike':
    case 'strike':
      soundEngine.playPitchThrow();
      setTimeout(() => soundEngine.playStrikeoutSwing(), 280);
      setTimeout(() => soundEngine.playUmpireStrike(), 550);
      soundEngine.playCrowdCheer('medium');
      crowdAmbience.setIntensity(5);
      break;

    case 'foul':
      soundEngine.playPitchThrow();
      setTimeout(() => soundEngine.playBatCrack(), 280);
      crowdAmbience.setIntensity(4);
      break;

    default:
      // Generic pitch
      soundEngine.playPitchThrow();
      break;
  }
}

function handleAtBatResult(result: string): void {
  switch (result) {
    case 'home_run':
      // Crack, crowd roar, then horn
      soundEngine.playBatCrack(1.4);
      soundEngine.playCrowdCheer('roar');
      setTimeout(() => soundEngine.playHomeRunHorn(), 600);
      crowdAmbience.spike(10, 4000, 4);
      break;

    case 'strikeout':
      soundEngine.playCrowdCheer('roar');
      crowdAmbience.spike(8, 2000, 3);
      break;

    case 'single':
      soundEngine.playBatCrack();
      setTimeout(() => soundEngine.playBallInGlove(), 500);
      soundEngine.playCrowdCheer('medium');
      crowdAmbience.spike(6, 1000, 4);
      break;

    case 'double':
    case 'triple':
      soundEngine.playBatCrack(1.1);
      soundEngine.playCrowdCheer('roar');
      crowdAmbience.spike(8, 2000, 4);
      break;

    case 'groundout':
    case 'flyout':
    case 'lineout':
    case 'popout':
    case 'double_play':
    case 'fielders_choice':
      soundEngine.playBatCrack();
      setTimeout(() => soundEngine.playBallInGlove(), 550);
      soundEngine.playCrowdCheer('light');
      crowdAmbience.setIntensity(3);
      break;

    case 'walk':
    case 'hit_by_pitch':
      // Quiet — no dramatic sound
      crowdAmbience.setIntensity(3);
      break;

    case 'sacrifice_fly':
    case 'sacrifice_bunt':
      soundEngine.playBatCrack();
      setTimeout(() => soundEngine.playBallInGlove(), 600);
      soundEngine.playCrowdCheer('light');
      crowdAmbience.setIntensity(4);
      break;

    default:
      soundEngine.playBatCrack();
      crowdAmbience.setIntensity(4);
      break;
  }
}
