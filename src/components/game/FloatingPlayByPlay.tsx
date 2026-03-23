import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/cn.ts';
import type { GameEvent } from '@/engine/types/index.ts';
import { generateCommentary, moodColor } from '@/engine/commentary/BroadcastCommentary.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';

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

function eventToCommentaryType(ev: GameEvent): string | null {
  if (ev.type === 'at_bat_result') {
    if (ev.result.includes('home_run')) return 'homerun';
    if (ev.result.includes('triple')) return 'triple';
    if (ev.result.includes('double') && !ev.result.includes('double_play')) return 'double';
    if (ev.result.includes('single')) return 'single';
    if (ev.result.includes('strikeout')) return 'strikeout';
    if (ev.result.includes('walk')) return 'walk';
    if (ev.result.includes('double_play')) return 'double_play';
    if (ev.result.includes('fly') || ev.result.includes('pop')) return 'flyout';
    if (ev.result.includes('ground')) return 'groundout';
    return 'groundout';
  }
  if (ev.type === 'inning_change') return 'inning_start';
  return null;
}

export function FloatingPlayByPlay({
  events,
  visible,
  onToggle,
  className,
}: FloatingPlayByPlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [broadcastMode, setBroadcastMode] = useState(true);

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
            <span>Play-by-Play</span>
            <button
              onClick={() => setBroadcastMode(v => !v)}
              style={{ float: 'right', color: broadcastMode ? '#d4a843' : 'rgba(184,176,164,0.4)', cursor: 'pointer', fontSize: 9 }}
            >
              {broadcastMode ? 'BROADCAST' : 'RAW'}
            </button>
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
            {recent.map((ev, i) => {
              // In broadcast mode, generate commentary for significant events
              if (broadcastMode && ev.type !== 'pitch') {
                const cType = eventToCommentaryType(ev);
                if (cType) {
                  const rng = new RandomProvider(i * 1000 + ev.description.length);
                  const commentary = generateCommentary(cType, {
                    batter: 'batter' in ev ? ev.batter : undefined,
                    pitcher: 'pitcher' in ev ? ev.pitcher : undefined,
                  }, rng);
                  return (
                    <div
                      key={i}
                      className={cn(
                        'py-0.5 font-mono text-[11px] leading-snug',
                        ev.type === 'inning_change' && 'mt-2 pt-1.5 border-t border-navy-lighter/60'
                      )}
                      style={{ color: moodColor(commentary.mood) }}
                      title={ev.description}
                    >
                      {commentary.text}
                    </div>
                  );
                }
              }
              return (
                <div
                  key={i}
                  className={cn(
                    'py-0.5 font-mono text-[11px] leading-snug truncate',
                    isHomRun(ev) ? 'text-gold font-bold'
                    : isExtraBase(ev) ? 'text-gold-dim'
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
