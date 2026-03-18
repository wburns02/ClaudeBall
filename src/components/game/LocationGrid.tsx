import { cn } from '@/lib/cn.ts';

interface CellCoord {
  row: number;
  col: number;
}

interface LastPitchCell extends CellCoord {
  wasStrike: boolean;
}

interface LocationGridProps {
  onSelect: (row: number, col: number) => void;
  selectedCell: CellCoord | null;
  lastPitchCell?: LastPitchCell;
}

const GRID_SIZE = 5;

function isStrikeZone(row: number, col: number): boolean {
  return row >= 1 && row <= 3 && col >= 1 && col <= 3;
}

export function LocationGrid({ onSelect, selectedCell, lastPitchCell }: LocationGridProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs text-cream-dim font-mono uppercase tracking-widest mb-1">Target Zone</p>

      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, width: 200, height: 200 }}
        role="grid"
        aria-label="Pitch location grid"
      >
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => {
            const inZone = isStrikeZone(row, col);
            const isSelected = selectedCell?.row === row && selectedCell?.col === col;
            const isLast = lastPitchCell?.row === row && lastPitchCell?.col === col;

            return (
              <button
                key={`${row}-${col}`}
                onClick={() => onSelect(row, col)}
                role="gridcell"
                aria-label={`Row ${row + 1}, Column ${col + 1}${inZone ? ' (strike zone)' : ' (ball zone)'}`}
                aria-pressed={isSelected}
                className={cn(
                  'relative rounded-sm transition-all duration-100 cursor-pointer',
                  'border border-transparent',
                  'hover:border-gold hover:z-10',
                  inZone
                    ? 'bg-navy-lighter/80'
                    : 'bg-navy-light/40',
                  isSelected && 'border-gold bg-gold/10 ring-1 ring-gold/50',
                )}
                style={{ width: 38, height: 38 }}
              >
                {/* Strike zone indicator lines */}
                {inZone && !isSelected && (
                  <span className="absolute inset-0 border border-cream/10 rounded-sm pointer-events-none" />
                )}

                {/* Selected: crosshair */}
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Horizontal line */}
                    <span className="absolute w-4 h-px bg-gold" />
                    {/* Vertical line */}
                    <span className="absolute w-px h-4 bg-gold" />
                    {/* Center dot */}
                    <span className="absolute w-1.5 h-1.5 rounded-full bg-gold ring-1 ring-gold/40" />
                  </span>
                )}

                {/* Last pitch indicator */}
                {isLast && (
                  <span
                    className={cn(
                      'absolute bottom-1 right-1 w-2 h-2 rounded-full pointer-events-none',
                      lastPitchCell.wasStrike ? 'bg-gold' : 'bg-blue-400',
                    )}
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-4 mt-1">
        <span className="flex items-center gap-1 text-xs text-cream-dim">
          <span className="w-2 h-2 rounded-full bg-gold inline-block" />
          Strike
        </span>
        <span className="flex items-center gap-1 text-xs text-cream-dim">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          Ball
        </span>
      </div>
    </div>
  );
}
