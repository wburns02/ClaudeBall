import { cn } from '@/lib/cn.ts';
import type { CareerStage, CareerStageComponent } from '@/dynasty/systems/CareerStageSystem.ts';

const STAGE_LABELS: Record<CareerStage, { label: string; emoji: string }> = {
  little_league: { label: 'Little League', emoji: '🧒' },
  high_school: { label: 'High School', emoji: '🏫' },
  college: { label: 'College', emoji: '🎓' },
  minor_leagues: { label: 'Minors', emoji: '🚌' },
  mlb: { label: 'MLB', emoji: '⭐' },
  post_career: { label: 'Post-Career', emoji: '🎙️' },
  retired: { label: 'Retired', emoji: '🏆' },
};

const STAGE_ORDER: CareerStage[] = [
  'little_league',
  'high_school',
  'college',
  'minor_leagues',
  'mlb',
  'post_career',
  'retired',
];

interface CareerTimelineProps {
  careerStage: CareerStageComponent;
}

export function CareerTimeline({ careerStage }: CareerTimelineProps) {
  const currentIndex = STAGE_ORDER.indexOf(careerStage.currentStage);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGE_ORDER.map((stage, i) => {
        const info = STAGE_LABELS[stage];
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={stage} className="flex items-center gap-1">
            {/* Dash connector before this pill (skip first) */}
            {i > 0 && (
              <span
                className={cn(
                  'text-xs select-none',
                  isPast || isCurrent ? 'text-green-light/70' : 'text-navy-lighter/30'
                )}
              >
                &mdash;
              </span>
            )}

            {/* Pill badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono border transition-colors',
                isCurrent && 'border-gold bg-gold/15 text-gold font-semibold',
                isPast && 'border-green-light/30 bg-green-light/10 text-green-light/70',
                isFuture && 'border-navy-lighter/30 text-cream-dim/30'
              )}
            >
              <span>{info.emoji}</span>
              <span>{info.label}</span>
              {isCurrent && (
                <span className="text-gold/70 ml-0.5">Age {careerStage.age}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
