import { useEffect } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GameInfo {
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  inning: string; // e.g. "Top 5th", "Bot 7th"
}

interface GamePauseMenuProps {
  isOpen: boolean;
  gameInfo: GameInfo;
  onResume: () => void;
  onSettings: () => void;
  onSave: () => void;
  onQuit: () => void;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function ScoreDisplay({ gameInfo }: { gameInfo: GameInfo }) {
  return (
    <div className="flex flex-col items-center gap-1 py-3 px-4 bg-black/30 rounded-lg border border-navy-lighter">
      <p className="text-cream-dim text-xs font-mono uppercase tracking-widest mb-1">
        {gameInfo.inning}
      </p>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-cream-dim text-xs font-mono uppercase tracking-wide">
            {gameInfo.away}
          </span>
          <span className="text-cream text-3xl font-display font-bold leading-none">
            {gameInfo.awayScore}
          </span>
        </div>

        <span className="text-navy-lighter text-xl font-mono">–</span>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-cream-dim text-xs font-mono uppercase tracking-wide">
            {gameInfo.home}
          </span>
          <span className="text-cream text-3xl font-display font-bold leading-none">
            {gameInfo.homeScore}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function GamePauseMenu({
  isOpen,
  gameInfo,
  onResume,
  onSettings,
  onSave,
  onQuit,
  className,
}: GamePauseMenuProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onResume();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onResume]);

  if (!isOpen) return null;

  return (
    /* Full-screen overlay */
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/70 backdrop-blur-sm',
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Game Paused"
    >
      {/* Menu panel — narrower, centered */}
      <Panel className="w-full max-w-xs">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <h2 className="font-display text-gold text-2xl tracking-widest uppercase">
            Paused
          </h2>
          <div className="w-12 h-px bg-gold/40" />
        </div>

        {/* Score */}
        <ScoreDisplay gameInfo={gameInfo} />

        {/* Menu items */}
        <div className="flex flex-col gap-2 mt-5">
          <Button
            variant="primary"
            size="md"
            onClick={onResume}
            className="w-full"
          >
            ▶ Resume Game
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={onSettings}
            className="w-full"
          >
            ⚙ Settings
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={onSave}
            className="w-full"
          >
            💾 Save Game
          </Button>

          <div className="w-full h-px bg-navy-lighter my-1" />

          <Button
            variant="ghost"
            size="md"
            onClick={onQuit}
            className="w-full text-red-400 hover:text-red-300"
          >
            ✕ Quit to Menu
          </Button>
        </div>

        {/* Hint */}
        <p className="text-center text-cream-dim text-xs font-mono mt-4">
          Press <kbd className="px-1 py-0.5 bg-navy-lighter rounded text-cream text-xs">Esc</kbd> to resume
        </p>
      </Panel>
    </div>
  );
}
