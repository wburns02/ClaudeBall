import type { Player } from '@/engine/types/player.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';

interface BullpenStatusProps {
  bullpen: Player[];
  currentPitcherId: string;
  onSelect: (playerId: string) => void;
}

function FatigueBar({ fatigue }: { fatigue: number }) {
  const pct = Math.round(fatigue);
  const color =
    fatigue < 30 ? 'bg-green-500'
    : fatigue < 60 ? 'bg-yellow-500'
    : 'bg-red-500';

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-navy-lighter rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-cream-dim w-8 text-right">{pct}%</span>
    </div>
  );
}

function PitcherRow({
  player,
  isCurrent,
  onSelect,
}: {
  player: Player;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const rep = player.pitching.repertoire;
  const repLabel = rep.slice(0, 3).map(p => p.slice(0, 2).toUpperCase()).join('/');

  return (
    <button
      onClick={onSelect}
      disabled={isCurrent}
      className={cn(
        'w-full px-3 py-2 rounded-md text-left transition-all duration-150 cursor-pointer',
        'border',
        isCurrent
          ? 'border-gold/40 bg-gold/5 cursor-default'
          : 'border-navy-lighter hover:border-cream/20 hover:bg-navy-lighter/60',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {/* Warming indicator */}
        {!isCurrent && player.state.fatigue < 5 && (
          <span className="text-xs text-orange-400 font-mono animate-pulse">●</span>
        )}

        <span className={cn(
          'font-body text-sm font-semibold flex-1 truncate',
          isCurrent ? 'text-gold' : 'text-cream',
        )}>
          #{player.number} {getPlayerName(player)}
        </span>

        {isCurrent && (
          <span className="text-xs font-mono text-gold px-1.5 py-0.5 border border-gold/30 rounded">
            IN
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-xs text-cream-dim">
          Stf {player.pitching.stuff} · Ctl {player.pitching.control} · Mov {player.pitching.movement}
        </span>
        {repLabel && (
          <span className="font-mono text-xs text-cream-dim/60">[{repLabel}]</span>
        )}
      </div>

      <FatigueBar fatigue={player.state.fatigue} />
    </button>
  );
}

export function BullpenStatus({ bullpen, currentPitcherId, onSelect }: BullpenStatusProps) {
  const sorted = [...bullpen].sort((a, b) => a.state.fatigue - b.state.fatigue);

  return (
    <Panel title="Bullpen">
      {sorted.length === 0 ? (
        <p className="text-cream-dim text-sm text-center py-2">No relievers available</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sorted.map(player => (
            <PitcherRow
              key={player.id}
              player={player}
              isCurrent={player.id === currentPitcherId}
              onSelect={() => onSelect(player.id)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
