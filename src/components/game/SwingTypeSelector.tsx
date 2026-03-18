import { cn } from '@/lib/cn.ts';
import type { SwingType } from '@/engine/types/batting.ts';

interface SwingOption {
  type: SwingType;
  label: string;
  shortcut: string;
  icon: string;
  description: string;
}

const SWING_OPTIONS: SwingOption[] = [
  {
    type: 'normal',
    label: 'Normal',
    shortcut: 'Space',
    icon: '●',
    description: 'Balanced swing',
  },
  {
    type: 'power',
    label: 'Power',
    shortcut: 'Shift',
    icon: '⚡',
    description: 'Max exit velocity, less contact',
  },
  {
    type: 'contact',
    label: 'Contact',
    shortcut: 'C',
    icon: '⊕',
    description: 'Put it in play',
  },
  {
    type: 'bunt',
    label: 'Bunt',
    shortcut: 'B',
    icon: '→',
    description: 'Sacrifice / squeeze',
  },
];

interface SwingTypeSelectorProps {
  selected: SwingType;
  onChange: (type: SwingType) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Horizontal button group for selecting swing type.
 * Shows keyboard shortcut inside each button.
 * Selected option highlighted with gold background.
 */
export function SwingTypeSelector({
  selected,
  onChange,
  className,
  disabled = false,
}: SwingTypeSelectorProps) {
  return (
    <div
      className={cn(
        'flex gap-1 bg-navy-lighter rounded-lg p-1 border border-navy-lighter/50',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
      role="radiogroup"
      aria-label="Swing type"
    >
      {SWING_OPTIONS.map((opt) => {
        const isSelected = selected === opt.type;
        return (
          <button
            key={opt.type}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${opt.label} swing (${opt.shortcut})`}
            title={opt.description}
            onClick={() => onChange(opt.type)}
            disabled={disabled}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-md',
              'transition-all duration-150 cursor-pointer text-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
              isSelected
                ? 'bg-gold text-navy shadow-[0_2px_0_#8a6e2e]'
                : 'text-cream-dim hover:text-cream hover:bg-navy-lighter',
            )}
          >
            {/* Icon */}
            <span className="text-base leading-none" aria-hidden>
              {opt.icon}
            </span>
            {/* Label */}
            <span className="font-display text-xs uppercase tracking-wide leading-none">
              {opt.label}
            </span>
            {/* Keyboard shortcut badge */}
            <span
              className={cn(
                'font-mono text-[10px] px-1 py-0.5 rounded leading-none mt-0.5',
                isSelected
                  ? 'bg-navy/30 text-navy'
                  : 'bg-navy-lighter text-cream-dim',
              )}
            >
              {opt.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );
}
