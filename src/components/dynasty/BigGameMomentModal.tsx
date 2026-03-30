import { cn } from '@/lib/cn.ts';
import { Button } from '@/components/ui/Button.tsx';
import type { BigGameMoment } from '@/dynasty/systems/BigGameMoments.ts';

const STAKES_CONFIG: Record<BigGameMoment['stakes'], { label: string; color: string; pulse: boolean }> = {
  career_defining: { label: 'CAREER DEFINING', color: 'bg-gold/20 border-gold text-gold', pulse: true },
  high: { label: 'HIGH STAKES', color: 'bg-orange-500/20 border-orange-500/60 text-orange-400', pulse: false },
  medium: { label: 'MEDIUM STAKES', color: 'bg-blue-500/20 border-blue-500/60 text-blue-400', pulse: false },
  low: { label: 'LOW STAKES', color: 'bg-navy-lighter/30 border-navy-lighter/50 text-cream-dim/50', pulse: false },
};

interface BigGameMomentModalProps {
  moment: BigGameMoment;
  onPlay: () => void;
  onSim: () => void;
  onSkip: () => void;
}

export function BigGameMomentModal({ moment, onPlay, onSim, onSkip }: BigGameMomentModalProps) {
  const stakesConfig = STAKES_CONFIG[moment.stakes];
  const sit = moment.situation;
  const hasSituation = sit.inning != null || sit.count != null || sit.runnersOn != null || sit.score != null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
      <div className="bg-navy-dark border-2 border-gold/40 rounded-xl max-w-lg w-full shadow-2xl">
        {/* Stakes banner */}
        <div
          className={cn(
            'px-4 py-2 border-b border-navy-lighter/40 text-center text-xs font-mono uppercase tracking-widest rounded-t-xl border',
            stakesConfig.color,
            stakesConfig.pulse && 'animate-pulse'
          )}
        >
          {stakesConfig.label}
        </div>

        {/* Title + context */}
        <div className="px-6 pt-5 pb-3">
          <h2 className="font-display text-gold text-2xl tracking-wide">{moment.title}</h2>
          {sit.context && (
            <p className="text-cream-dim/50 text-xs font-mono mt-1">{sit.context}</p>
          )}
        </div>

        {/* Description */}
        <div className="px-6 pb-4">
          <p className="text-cream/80 italic leading-relaxed">{moment.description}</p>
        </div>

        {/* Situation box */}
        {hasSituation && (
          <div className="mx-6 mb-4 bg-navy-light/50 border border-navy-lighter/30 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono">
              {sit.inning != null && (
                <div className="flex justify-between">
                  <span className="text-cream-dim/50 uppercase tracking-wider">Inning</span>
                  <span className="text-cream font-semibold">{sit.inning}</span>
                </div>
              )}
              {sit.outs != null && (
                <div className="flex justify-between">
                  <span className="text-cream-dim/50 uppercase tracking-wider">Outs</span>
                  <span className="text-cream font-semibold">{sit.outs}</span>
                </div>
              )}
              {sit.count && (
                <div className="flex justify-between">
                  <span className="text-cream-dim/50 uppercase tracking-wider">Count</span>
                  <span className="text-cream font-semibold">{sit.count.balls}-{sit.count.strikes}</span>
                </div>
              )}
              {sit.score && (
                <div className="flex justify-between">
                  <span className="text-cream-dim/50 uppercase tracking-wider">Score</span>
                  <span className="text-cream font-semibold">{sit.score.you}-{sit.score.them}</span>
                </div>
              )}
              {sit.runnersOn && sit.runnersOn.length > 0 && (
                <div className="col-span-2 flex justify-between">
                  <span className="text-cream-dim/50 uppercase tracking-wider">Runners</span>
                  <span className="text-cream font-semibold">
                    {sit.runnersOn.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-5 space-y-3">
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={onSim}
              className="flex-1"
            >
              Sim It
            </Button>
            <Button
              variant="primary"
              onClick={onPlay}
              className="flex-1 bg-gradient-to-r from-gold to-gold-dim text-navy font-bold"
            >
              Play This Moment
            </Button>
          </div>
          <div className="text-center">
            <button
              onClick={onSkip}
              className="text-cream-dim/30 text-xs font-mono hover:text-cream-dim/60 transition-colors cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
