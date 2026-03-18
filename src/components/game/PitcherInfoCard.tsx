import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import type { Player } from '@/engine/types/player.ts';
import type { PitchType } from '@/engine/types/enums.ts';

interface PitcherInfoCardProps {
  pitcher: Player;
  /** ERA display string, e.g. "3.42" */
  era?: string;
  className?: string;
}

/** Color dot + label for each pitch type in the repertoire. */
const PITCH_CONFIG: Record<
  PitchType,
  { label: string; dotClass: string; velOffset: number }
> = {
  fastball:   { label: 'FB',  dotClass: 'bg-red',        velOffset: 0   },
  sinker:     { label: 'SI',  dotClass: 'bg-[#e07b40]',  velOffset: -2  },
  cutter:     { label: 'CT',  dotClass: 'bg-[#8b5cf6]',  velOffset: -3  },
  slider:     { label: 'SL',  dotClass: 'bg-blue',       velOffset: -7  },
  curveball:  { label: 'CU',  dotClass: 'bg-green',      velOffset: -12 },
  changeup:   { label: 'CH',  dotClass: 'bg-gold',       velOffset: -10 },
  splitter:   { label: 'SP',  dotClass: 'bg-[#14b8a6]',  velOffset: -6  },
  knuckleball:{ label: 'KN',  dotClass: 'bg-cream-dim',  velOffset: -18 },
};

/** Maps 0-100 fatigue to a color class (green → yellow → red). */
function fatigueColor(fatigue: number): string {
  if (fatigue < 35) return 'bg-green-light';
  if (fatigue < 65) return 'bg-gold';
  return 'bg-red';
}

/** Human-readable fatigue label. */
function fatigueLabel(fatigue: number): string {
  if (fatigue < 20) return 'Fresh';
  if (fatigue < 40) return 'Good';
  if (fatigue < 60) return 'Tiring';
  if (fatigue < 80) return 'Fatigued';
  return 'Exhausted';
}

/**
 * Compact card showing pitcher info during an at-bat:
 * name, handedness, ERA, pitch count + fatigue bar, repertoire.
 */
export function PitcherInfoCard({ pitcher, era = '—', className }: PitcherInfoCardProps) {
  const fatigue = pitcher.state.fatigue;
  const pitchCount = pitcher.state.pitchCount;
  const baseVelo = pitcher.pitching.velocity;

  return (
    <Panel className={cn('text-sm', className)}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-display text-cream text-base leading-tight">
            {pitcher.firstName[0]}. {pitcher.lastName}
          </div>
          <div className="font-mono text-xs text-cream-dim mt-0.5">
            Throws <span className="text-cream">{pitcher.throws}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-gold text-base leading-tight">{era}</div>
          <div className="font-mono text-xs text-cream-dim">ERA</div>
        </div>
      </div>

      {/* Pitch count + fatigue */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs text-cream-dim">
            Pitches: <span className="text-cream">{pitchCount}</span>
          </span>
          <span
            className={cn(
              'font-mono text-xs',
              fatigue < 35 ? 'text-green-light'
              : fatigue < 65 ? 'text-gold'
              : 'text-red',
            )}
          >
            {fatigueLabel(fatigue)}
          </span>
        </div>
        {/* Fatigue bar */}
        <div className="h-1.5 bg-navy rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', fatigueColor(fatigue))}
            style={{ width: `${Math.min(fatigue, 100)}%` }}
          />
        </div>
      </div>

      {/* Repertoire */}
      <div className="space-y-1">
        <div className="font-mono text-[10px] text-cream-dim uppercase tracking-widest mb-1.5">
          Repertoire
        </div>
        {pitcher.pitching.repertoire.map((pt) => {
          const cfg = PITCH_CONFIG[pt];
          if (!cfg) return null;
          const loVelo = Math.max(60, baseVelo + cfg.velOffset - 2);
          const hiVelo = baseVelo + cfg.velOffset + 1;
          return (
            <div key={pt} className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dotClass)} />
              <span className="font-mono text-xs text-cream w-6 shrink-0">
                {cfg.label}
              </span>
              <span className="font-mono text-xs text-cream-dim">
                {loVelo}–{hiVelo} mph
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
