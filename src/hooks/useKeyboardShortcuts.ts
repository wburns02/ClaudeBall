import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  /** Space: swing (normal) when batting, next pitch when spectating */
  onNextAtBat?: () => void;
  /** A: toggle auto-play */
  onAutoPlay?: () => void;
  /** S: sim to end / new game */
  onSimToEnd?: () => void;
  /** 1-4: speed selection (passes speed 1-4) */
  onSpeedSelect?: (speed: number) => void;
  /** Escape: back / close */
  onEscape?: () => void;

  // ── Interactive batting shortcuts ─────────────────────────────────────────
  /** Shift+Space: power swing */
  onPowerSwing?: () => void;
  /** C: contact swing */
  onContactSwing?: () => void;
  /** B: bunt */
  onBunt?: () => void;
  /** T: take (don't swing) */
  onTake?: () => void;

  // ── Interactive pitching shortcuts ────────────────────────────────────────
  /** 1-5: pitch type selection when pitching (Digit1–Digit5 in pitching mode) */
  onPitchTypeSelect?: (slot: number) => void;

  /** Whether the hook is active (default: true) */
  enabled?: boolean;

  /** Current user role, used to determine context of Space and number keys */
  userRole?: 'batting' | 'pitching' | 'spectating';
}

/**
 * Global keyboard shortcut hook for the live game view.
 *
 * Key bindings:
 *   Space        — swing normal (batting) / next pitch (spectating/pitching)
 *   Shift+Space  — power swing (batting)
 *   C            — contact swing (batting)
 *   B            — bunt (batting)
 *   T            — take / don't swing (batting)
 *   A            — toggle auto-play
 *   S            — sim to end
 *   1-5          — speed (spectating) / pitch type slot (pitching)
 *   Escape       — back/menu
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const { enabled = true, userRole = 'spectating' } = handlers;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (userRole === 'batting' && !e.shiftKey) {
            handlers.onNextAtBat?.(); // normal swing when batting
          } else if (userRole === 'batting' && e.shiftKey) {
            handlers.onPowerSwing?.();
          } else {
            handlers.onNextAtBat?.(); // next pitch for spectating / pitching
          }
          break;

        case 'KeyC':
          e.preventDefault();
          if (userRole === 'batting') {
            handlers.onContactSwing?.();
          }
          break;

        case 'KeyB':
          e.preventDefault();
          if (userRole === 'batting') {
            handlers.onBunt?.();
          }
          break;

        case 'KeyT':
          e.preventDefault();
          if (userRole === 'batting') {
            handlers.onTake?.();
          }
          break;

        case 'KeyA':
          e.preventDefault();
          handlers.onAutoPlay?.();
          break;

        case 'KeyS':
          e.preventDefault();
          handlers.onSimToEnd?.();
          break;

        case 'Digit1':
          if (userRole === 'pitching') {
            handlers.onPitchTypeSelect?.(1);
          } else {
            handlers.onSpeedSelect?.(1);
          }
          break;
        case 'Digit2':
          if (userRole === 'pitching') {
            handlers.onPitchTypeSelect?.(2);
          } else {
            handlers.onSpeedSelect?.(2);
          }
          break;
        case 'Digit3':
          if (userRole === 'pitching') {
            handlers.onPitchTypeSelect?.(3);
          } else {
            handlers.onSpeedSelect?.(3);
          }
          break;
        case 'Digit4':
          if (userRole === 'pitching') {
            handlers.onPitchTypeSelect?.(4);
          } else {
            handlers.onSpeedSelect?.(4);
          }
          break;
        case 'Digit5':
          if (userRole === 'pitching') {
            handlers.onPitchTypeSelect?.(5);
          }
          break;

        case 'Escape':
          handlers.onEscape?.();
          break;

        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled, userRole,
    handlers.onNextAtBat, handlers.onAutoPlay, handlers.onSimToEnd,
    handlers.onSpeedSelect, handlers.onEscape, handlers.onPowerSwing,
    handlers.onContactSwing, handlers.onBunt, handlers.onTake,
    handlers.onPitchTypeSelect,
  ]);
}
