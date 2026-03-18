import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import type { Player } from '@/engine/types/player.ts';

interface BatterInfoCardProps {
  batter: Player;
  /** Current game stats (e.g. from box score). If omitted, ratings are shown. */
  gameAVG?: string;
  gameHR?: number;
  gameRBI?: number;
  className?: string;
}

interface RatingBarProps {
  label: string;
  value: number; // 1-100
}

/** Narrow horizontal rating bar. */
function RatingBar({ label, value }: RatingBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const colorClass =
    pct >= 75 ? 'bg-gold' : pct >= 50 ? 'bg-green-light' : 'bg-cream-dim';

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-cream-dim w-14 shrink-0 uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-navy rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-cream-dim w-6 text-right">
        {pct}
      </span>
    </div>
  );
}

/**
 * Compact card for the current batter:
 * name, number, position, bats, key stats, and rating bars.
 */
export function BatterInfoCard({
  batter,
  gameAVG = '—',
  gameHR = 0,
  gameRBI = 0,
  className,
}: BatterInfoCardProps) {
  const contact =
    batter.bats === 'L'
      ? batter.batting.contact_L
      : batter.bats === 'R'
      ? batter.batting.contact_R
      : Math.round((batter.batting.contact_L + batter.batting.contact_R) / 2);

  const power =
    batter.bats === 'L'
      ? batter.batting.power_L
      : batter.bats === 'R'
      ? batter.batting.power_R
      : Math.round((batter.batting.power_L + batter.batting.power_R) / 2);

  return (
    <Panel className={cn('text-sm', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-display text-cream text-base leading-tight">
            {batter.firstName[0]}. {batter.lastName}
          </div>
          <div className="font-mono text-xs text-cream-dim mt-0.5 flex items-center gap-2">
            <span className="text-cream font-semibold">#{batter.number}</span>
            <span>{batter.position}</span>
          </div>
        </div>
        {/* Bats indicator */}
        <div className="shrink-0 bg-navy rounded px-2 py-1 text-center">
          <div className="font-mono text-gold text-base leading-none font-bold">
            {batter.bats}
          </div>
          <div className="font-mono text-[9px] text-cream-dim uppercase tracking-wider">
            Bats
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 mb-3 pb-3 border-b border-navy-lighter">
        {[
          { label: 'AVG', value: gameAVG },
          { label: 'HR', value: String(gameHR) },
          { label: 'RBI', value: String(gameRBI) },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="font-mono text-cream text-sm font-semibold leading-none">
              {value}
            </div>
            <div className="font-mono text-[9px] text-cream-dim uppercase tracking-wider mt-0.5">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Rating bars */}
      <div className="space-y-1.5">
        <RatingBar label="Contact" value={contact} />
        <RatingBar label="Power" value={power} />
        <RatingBar label="Eye" value={batter.batting.eye} />
        <RatingBar label="Speed" value={batter.batting.speed} />
      </div>
    </Panel>
  );
}
