import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  /** Space: next at-bat */
  onNextAtBat?: () => void;
  /** A: toggle auto-play */
  onAutoPlay?: () => void;
  /** S: sim to end / new game */
  onSimToEnd?: () => void;
  /** 1-4: speed selection (passes speed 1-4) */
  onSpeedSelect?: (speed: number) => void;
  /** Escape: back / close */
  onEscape?: () => void;
  /** Whether the hook is active (default: true) */
  enabled?: boolean;
}

/**
 * Global keyboard shortcut hook for the live game view.
 *
 * Key bindings:
 *   Space    — next at-bat
 *   A        — toggle auto-play
 *   S        — sim to end
 *   1-4      — select speed
 *   Escape   — back/menu
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const { enabled = true } = handlers;

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
          handlers.onNextAtBat?.();
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
          handlers.onSpeedSelect?.(1);
          break;
        case 'Digit2':
          handlers.onSpeedSelect?.(2);
          break;
        case 'Digit3':
          handlers.onSpeedSelect?.(3);
          break;
        case 'Digit4':
          handlers.onSpeedSelect?.(4);
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
  }, [enabled, handlers.onNextAtBat, handlers.onAutoPlay, handlers.onSimToEnd, handlers.onSpeedSelect, handlers.onEscape]);
}
