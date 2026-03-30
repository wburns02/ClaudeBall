import { useState } from 'react';
import { cn } from '@/lib/cn.ts';
import type { DecisionEvent } from '@/dynasty/systems/DecisionEventSystem.ts';

const CATEGORY_ICONS: Record<DecisionEvent['category'], string> = {
  training: '💪',
  social: '🎉',
  family: '👨‍👩‍👦',
  career: '📋',
  moral: '⚖️',
  financial: '💰',
  health: '🏥',
  rivalry: '🔥',
  politics: '🏛️',
};

interface DecisionEventModalProps {
  event: DecisionEvent;
  onChoose: (choiceIndex: number) => void;
}

export function DecisionEventModal({ event, onChoose }: DecisionEventModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleChoose = (index: number) => {
    if (selectedIndex !== null) return; // Already chose
    setSelectedIndex(index);
    setTimeout(() => onChoose(index), 600);
  };

  const categoryIcon = CATEGORY_ICONS[event.category] ?? '📋';
  const stageLabel = event.stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const categoryLabel = event.category.charAt(0).toUpperCase() + event.category.slice(1);

  return (
    <div className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4">
      <div className="bg-navy-dark border-2 border-gold/40 rounded-xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-navy-lighter/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{categoryIcon}</span>
            <div>
              <h2 className="font-display text-gold text-xl tracking-wide">{event.title}</h2>
              <p className="text-cream-dim/50 text-xs font-mono mt-0.5">
                {stageLabel} &middot; {categoryLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-4 border-b border-navy-lighter/30">
          <p className="text-cream/80 italic leading-relaxed">{event.description}</p>
        </div>

        {/* Choices */}
        <div className="px-6 py-4 space-y-3">
          {event.choices.map((choice, i) => {
            const isSelected = selectedIndex === i;
            const isFaded = selectedIndex !== null && !isSelected;

            return (
              <button
                key={i}
                onClick={() => handleChoose(i)}
                disabled={selectedIndex !== null}
                className={cn(
                  'w-full text-left rounded-lg border-2 px-4 py-3 transition-all duration-300 cursor-pointer',
                  'hover:border-gold/60 hover:bg-gold/10',
                  'disabled:cursor-default',
                  isSelected && 'border-gold bg-gold/20',
                  isFaded && 'opacity-30',
                  !isSelected && !isFaded && 'border-navy-lighter/40 bg-navy-light/30'
                )}
              >
                <p className="text-cream font-mono text-sm font-semibold mb-1">{choice.label}</p>

                {/* Visible effects */}
                {choice.visibleEffects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {choice.visibleEffects.map((effect, j) => {
                      const isPositive = effect.startsWith('+');
                      const isNegative = effect.startsWith('-');
                      return (
                        <span
                          key={j}
                          className={cn(
                            'text-xs font-mono px-1.5 py-0.5 rounded',
                            isPositive && 'text-green-light bg-green-light/10',
                            isNegative && 'text-red-400 bg-red-400/10',
                            !isPositive && !isNegative && 'text-cream-dim/60 bg-navy-lighter/30'
                          )}
                        >
                          {effect}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Hidden effects hint */}
                {choice.hiddenEffects && choice.hiddenEffects.length > 0 && (
                  <p className="text-cream-dim/40 text-xs italic mt-1.5">
                    ??? hidden consequences
                  </p>
                )}

                {/* Requirements */}
                {choice.requirements && (
                  <div className="mt-1.5">
                    {choice.requirements.minAge && (
                      <span className="text-xs font-mono text-cream-dim/50">
                        Requires age {choice.requirements.minAge}+
                      </span>
                    )}
                    {choice.requirements.minAttribute && (
                      <span className="text-xs font-mono text-cream-dim/50 ml-2">
                        Requires {choice.requirements.minAttribute.attr} {choice.requirements.minAttribute.value}+
                      </span>
                    )}
                    {choice.requirements.financial && (
                      <span className="text-xs font-mono text-cream-dim/50 ml-2">
                        Requires ${choice.requirements.financial.minWealth}k+
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
