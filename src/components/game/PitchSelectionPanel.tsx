import type { PitchType } from '@/engine/types/enums.ts';
import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';

interface PitchSelectionPanelProps {
  repertoire: PitchType[];
  stuff: number;
  selectedPitch: PitchType | null;
  onSelect: (pitch: PitchType) => void;
}

interface PitchMeta {
  name: string;
  abbrev: string;
  color: string;
  dotColor: string;
  velMin: number;
  velMax: number;
  /** Arrow direction: 'down', 'down-right', 'down-left', 'right', 'left', 'straight' */
  movement: 'down' | 'down-right' | 'down-left' | 'right' | 'left' | 'straight';
}

const PITCH_META: Record<PitchType, PitchMeta> = {
  fastball:    { name: 'Four-Seam FB', abbrev: 'FB',  color: 'text-red-400',    dotColor: 'bg-red-400',    velMin: 90, velMax: 102, movement: 'straight' },
  sinker:      { name: 'Sinker',       abbrev: 'SI',  color: 'text-orange-400', dotColor: 'bg-orange-400', velMin: 88, velMax: 97,  movement: 'down' },
  cutter:      { name: 'Cutter',       abbrev: 'CUT', color: 'text-purple-400', dotColor: 'bg-purple-400', velMin: 86, velMax: 94,  movement: 'right' },
  slider:      { name: 'Slider',       abbrev: 'SL',  color: 'text-blue-400',   dotColor: 'bg-blue-400',   velMin: 82, velMax: 90,  movement: 'down-right' },
  curveball:   { name: 'Curveball',    abbrev: 'CB',  color: 'text-green-400',  dotColor: 'bg-green-400',  velMin: 72, velMax: 82,  movement: 'down' },
  changeup:    { name: 'Changeup',     abbrev: 'CH',  color: 'text-yellow-400', dotColor: 'bg-yellow-400', velMin: 78, velMax: 87,  movement: 'down-left' },
  splitter:    { name: 'Splitter',     abbrev: 'SPL', color: 'text-teal-400',   dotColor: 'bg-teal-400',   velMin: 80, velMax: 88,  movement: 'down' },
  knuckleball: { name: 'Knuckleball',  abbrev: 'KN',  color: 'text-gray-400',   dotColor: 'bg-gray-400',   velMin: 65, velMax: 75,  movement: 'straight' },
};

// Velocity range is adjusted by stuff rating
function getVelocityDisplay(pitchType: PitchType, stuff: number): string {
  const meta = PITCH_META[pitchType];
  const stuffBonus = Math.round((stuff - 50) / 10);
  return `${meta.velMin + stuffBonus}-${meta.velMax + stuffBonus} mph`;
}

function getStars(pitchType: PitchType, stuff: number): number {
  // FB/SI/CUT rely on velocity = stuff, breaking stuff relies on movement
  const isHeat = pitchType === 'fastball' || pitchType === 'sinker' || pitchType === 'cutter';
  const base = isHeat ? stuff : Math.round(stuff * 0.7 + 30 * 0.3);
  return Math.min(5, Math.max(1, Math.round(base / 20)));
}

function MovementArrow({ direction }: { direction: PitchMeta['movement'] }) {
  const arrows: Record<PitchMeta['movement'], string> = {
    straight:    '→',
    down:        '↓',
    'down-right': '↘',
    'down-left':  '↙',
    right:       '→',
    left:        '←',
  };
  return (
    <span className="font-mono text-cream-dim text-xs w-4 inline-block text-center">
      {arrows[direction]}
    </span>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="font-mono text-xs">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < count ? 'text-gold' : 'text-navy-lighter'}>★</span>
      ))}
    </span>
  );
}

export function PitchSelectionPanel({ repertoire, stuff, selectedPitch, onSelect }: PitchSelectionPanelProps) {
  return (
    <Panel title="Pitches" className="min-w-[220px]">
      <div className="flex flex-col gap-1">
        {repertoire.map((pitch, idx) => {
          const meta = PITCH_META[pitch];
          const isSelected = selectedPitch === pitch;
          const shortcutKey = idx + 1;
          const stars = getStars(pitch, stuff);
          const velDisplay = getVelocityDisplay(pitch, stuff);

          return (
            <button
              key={pitch}
              onClick={() => onSelect(pitch)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-150',
                'border text-left cursor-pointer',
                isSelected
                  ? 'border-gold bg-gold/10 shadow-[0_0_8px_rgba(212,168,67,0.2)]'
                  : 'border-navy-lighter hover:border-cream/20 hover:bg-navy-lighter/60',
              )}
            >
              {/* Keyboard shortcut */}
              <span className={cn(
                'font-mono text-xs w-4 flex-shrink-0 font-bold',
                isSelected ? 'text-gold' : 'text-cream-dim',
              )}>
                {shortcutKey}
              </span>

              {/* Color dot */}
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', meta.dotColor)} />

              {/* Pitch info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('font-mono text-xs font-bold uppercase', isSelected ? 'text-gold' : meta.color)}>
                    {meta.abbrev}
                  </span>
                  <span className="text-cream-dim text-xs truncate hidden sm:inline">{meta.name}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Stars count={stars} />
                  <span className="text-cream-dim/60 text-xs">{velDisplay}</span>
                </div>
              </div>

              {/* Movement arrow */}
              <MovementArrow direction={meta.movement} />
            </button>
          );
        })}

        {repertoire.length === 0 && (
          <p className="text-cream-dim text-sm text-center py-2">No pitches available</p>
        )}
      </div>

      <p className="text-cream-dim/50 text-xs mt-3 text-center font-mono">
        Press 1–{Math.min(5, repertoire.length)} to select
      </p>
    </Panel>
  );
}
