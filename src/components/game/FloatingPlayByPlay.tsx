import { useRef, useEffect } from 'react';
import { cn } from '@/lib/cn.ts';
import type { GameEvent } from '@/engine/types/index.ts';

interface FloatingPlayByPlayProps {
  events: GameEvent[];
  visible: boolean;
  onToggle: () => void;
  className?: string;
}

/** Color-coded styling per event type. */
const EVENT_COLOR: Record<string, string> = {
  pitch: 'text-cream-dim/70',
  at_bat_result: 'text-cream',
  inning_change: 'text-gold font-semibold',
  game_end: 'text-gold font-bold',
  error: 'text-red',
  steal_attempt: 'text-blue',
  baserunning: 'text-green-light',
  pitching_change: 'italic text-cream-dim',
};

function isHomRun(ev: GameEvent): boolean {
  return ev.type === 'at_bat_result' && ev.result.includes('home_run');
}
function isExtraBase(ev: GameEvent): boolean {
  return (
    ev.type === 'at_bat_result' &&
    (ev.result.includes('double') || ev.result.includes('triple'))
  );
}

export function FloatingPlayByPlay({
  events,
  visible,
  onToggle,
  className,
}: FloatingPlayByPlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current && visible) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, visible]);

  // Show max 50 most recent events for performance
  const recent = events.slice(-50);

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          background: 'rgba(10,15,26,0.85)',
          border: '1px solid rgba(212,168,67,0.22)',
          borderRadius: 5,
          padding: '3px 10px',
          fontSize: 11,
          fontFamily: 'IBM Plex Mono, monospace',
          color: '#d4a843',
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'auto',
        }}
      >
        {visible ? 'Hide Log ▸' : 'Show Log ◂'}
      </button>

      {/* Log panel */}
      {visible && (
        <div
          style={{
            background: 'rgba(10,15,26,0.85)',
            border: '1px solid rgba(212,168,67,0.18)',
            borderRadius: 6,
            width: 260,
            maxHeight: 320,
            overflow: 'hidden',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '5px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              fontSize: 10,
              fontFamily: 'IBM Plex Mono, monospace',
              color: 'rgba(212,168,67,0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}
          >
            Play-by-Play
          </div>

          {/* Events list */}
          <div
            ref={scrollRef}
            style={{
              overflowY: 'auto',
              padding: '6px 10px',
              flex: 1,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(212,168,67,0.2) transparent',
            }}
          >
            {recent.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(184,176,164,0.5)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  padding: '8px 0',
                }}
              >
                No plays yet
              </div>
            )}
            {recent.map((ev, i) => (
              <div
                key={i}
                className={cn(
                  'py-0.5 font-mono text-[11px] leading-snug truncate',
                  isHomRun(ev)
                    ? 'text-gold font-bold'
                    : isExtraBase(ev)
                    ? 'text-gold-dim'
                    : EVENT_COLOR[ev.type] || 'text-cream-dim',
                  ev.type === 'inning_change' && 'mt-2 pt-1.5 border-t border-navy-lighter/60'
                )}
                title={ev.description}
              >
                {ev.type === 'pitch' && (
                  <span style={{ color: 'rgba(184,176,164,0.35)' }} className="mr-1">
                    {ev.balls}-{ev.strikes}
                  </span>
                )}
                {ev.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
