/**
 * CommentaryTicker — scrolling broadcast commentary display for live games.
 * Shows recent play-by-play text with mood-based coloring.
 */
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn.ts';
import { generateCommentary, moodColor, type Commentary } from '@/engine/commentary/BroadcastCommentary.ts';
import { RandomProvider } from '@/engine/core/RandomProvider.ts';

interface Props {
  events: { type: string; batter?: string; pitcher?: string; rbi?: number }[];
  maxLines?: number;
}

export function CommentaryTicker({ events, maxLines = 4 }: Props) {
  const [lines, setLines] = useState<Commentary[]>([]);
  const prevCount = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (events.length <= prevCount.current) return;

    const newEvents = events.slice(prevCount.current);
    prevCount.current = events.length;

    const rng = new RandomProvider(Date.now());
    const newLines = newEvents.map(ev => generateCommentary(ev.type, ev, rng));

    setLines(prev => [...prev, ...newLines].slice(-maxLines * 2));

    // Auto-scroll to bottom
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [events, maxLines]);

  if (lines.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto max-h-20 px-2 py-1 space-y-0.5"
      style={{
        background: 'rgba(10,15,26,0.85)',
        borderTop: '1px solid rgba(212,168,67,0.15)',
        scrollbarWidth: 'none',
      }}
    >
      {lines.slice(-maxLines).map((line, i) => {
        const isLatest = i === Math.min(lines.length, maxLines) - 1;
        return (
          <p
            key={`${i}-${line.text.slice(0, 20)}`}
            className={cn(
              'font-mono text-[11px] leading-relaxed transition-opacity duration-300',
              isLatest ? 'opacity-100' : 'opacity-50',
            )}
            style={{ color: isLatest ? moodColor(line.mood) : 'rgba(184,176,164,0.5)' }}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
