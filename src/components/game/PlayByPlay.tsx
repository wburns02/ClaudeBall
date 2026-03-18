import type { GameEvent } from '@/engine/types/index.ts';
import { cn } from '@/lib/cn.ts';

interface PlayByPlayProps {
  events: GameEvent[];
  maxHeight?: string;
}

const EVENT_STYLES: Record<string, string> = {
  pitch: 'text-cream-dim',
  at_bat_result: 'text-cream font-medium',
  inning_change: 'text-gold font-display text-base tracking-wide',
  game_end: 'text-gold font-bold text-lg',
  error: 'text-red',
  steal_attempt: 'text-blue',
  baserunning: 'text-green-light',
  pitching_change: 'text-gold-dim italic',
};

export function PlayByPlay({ events, maxHeight = '400px' }: PlayByPlayProps) {
  return (
    <div
      className="space-y-0.5 overflow-y-auto font-mono text-sm pr-2"
      style={{ maxHeight }}
    >
      {events.map((ev, i) => (
        <div
          key={i}
          className={cn(
            'py-0.5',
            EVENT_STYLES[ev.type] || 'text-cream-dim',
            ev.type === 'inning_change' && 'mt-3 mb-1 pt-2 border-t border-navy-lighter',
            ev.type === 'at_bat_result' && ev.result.includes('home_run') && 'text-gold',
          )}
        >
          {ev.type === 'pitch' && (
            <span className="text-cream-dim/40 mr-2">{ev.balls}-{ev.strikes}</span>
          )}
          {ev.description}
        </div>
      ))}
    </div>
  );
}
