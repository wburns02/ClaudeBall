/**
 * ManagerDecisionModal — dramatic in-game decision prompt during franchise sim.
 * Shows the game situation and lets the GM make real-time decisions.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import type { ManagerDecision, DecisionOption, DecisionOutcome } from '@/engine/manager/ManagerDecisions.ts';

// ── Risk badge ──────────────────────────────────────────────────
function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'text-green-light border-green-light/30 bg-green-900/20',
    medium: 'text-gold border-gold/30 bg-gold/10',
    high: 'text-red-400 border-red-400/30 bg-red-900/20',
  };
  return (
    <span className={cn('font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border', colors[risk])}>
      {risk}
    </span>
  );
}

// ── Success meter ───────────────────────────────────────────────
function SuccessMeter({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#22c55e' : pct >= 50 ? '#d4a843' : pct >= 35 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[10px] font-bold w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── Option card ─────────────────────────────────────────────────
function OptionCard({
  option,
  selected,
  onSelect,
  disabled,
}: {
  option: DecisionOption;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full text-left p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer',
        selected
          ? 'border-gold bg-gold/10 shadow-[0_0_12px_rgba(212,168,67,0.15)]'
          : 'border-navy-lighter/40 bg-navy-lighter/10 hover:border-navy-lighter/80 hover:bg-navy-lighter/20',
        disabled && 'opacity-50 cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className={cn('font-display text-sm uppercase tracking-wide', selected ? 'text-gold' : 'text-cream')}>
          {option.label}
        </p>
        <RiskBadge risk={option.risk} />
      </div>
      <p className="font-mono text-xs text-cream-dim/70 mb-2">{option.description}</p>
      <SuccessMeter pct={option.successPct} />
    </button>
  );
}

// ── Outcome display ─────────────────────────────────────────────
function OutcomeDisplay({ outcome }: { outcome: DecisionOutcome }) {
  return (
    <div className={cn(
      'rounded-lg border-2 p-4 text-center space-y-2',
      outcome.success
        ? 'border-green-light/40 bg-green-900/15'
        : 'border-red-400/40 bg-red-900/15',
    )}>
      <p className={cn(
        'font-display text-2xl uppercase tracking-wide',
        outcome.success ? 'text-green-light' : 'text-red-400',
      )}>
        {outcome.success ? 'Great Call!' : 'Didn\'t Work Out'}
      </p>
      <p className="font-body text-sm text-cream leading-relaxed">{outcome.narrative}</p>
      {outcome.impactRuns !== 0 && (
        <p className={cn(
          'font-mono text-xs font-bold',
          outcome.impactRuns > 0 ? 'text-green-light' : 'text-red-400',
        )}>
          {outcome.impactRuns > 0 ? '+' : ''}{outcome.impactRuns} Run{Math.abs(outcome.impactRuns) !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ── Main Modal ──────────────────────────────────────────────────
interface Props {
  decision: ManagerDecision;
  onResolve: (optionId: string) => void;
  outcome: DecisionOutcome | null;
  onDismiss: () => void;
}

export function ManagerDecisionModal({ decision, onResolve, outcome, onDismiss }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const urgencyColors = {
    routine: 'border-navy-lighter/50',
    important: 'border-gold/40',
    critical: 'border-red-400/40 animate-pulse',
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div
        className={cn(
          'bg-navy-light rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border-2 shadow-2xl',
          urgencyColors[decision.urgency],
        )}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded',
              decision.urgency === 'critical' ? 'bg-red-400/20 text-red-400' :
              decision.urgency === 'important' ? 'bg-gold/20 text-gold' :
              'bg-navy-lighter/30 text-cream-dim',
            )}>
              {decision.urgency} decision
            </span>
            <span className="font-mono text-[10px] text-cream-dim/40">
              {decision.halfInning === 'top' ? 'Top' : 'Bot'} {decision.inning}
            </span>
          </div>
          <h2 className="font-display text-xl text-gold uppercase tracking-wide">
            Manager's Call
          </h2>
        </div>

        {/* Situation */}
        <div className="px-5 pb-4">
          <div className="rounded-lg bg-navy/60 border border-navy-lighter/30 p-3 mb-4">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-1">{decision.context}</p>
            <p className="font-body text-sm text-cream leading-relaxed">{decision.situation}</p>
          </div>

          {/* Outcome or Options */}
          {outcome ? (
            <div className="space-y-3">
              <OutcomeDisplay outcome={outcome} />
              <Button className="w-full" onClick={onDismiss}>Continue</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-2">What's the call, Skip?</p>
              {decision.options.map(opt => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  selected={selected === opt.id}
                  onSelect={() => setSelected(opt.id)}
                  disabled={false}
                />
              ))}
              <div className="pt-2 flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!selected}
                  onClick={() => selected && onResolve(selected)}
                >
                  Make the Call
                </Button>
                <Button variant="ghost" onClick={onDismiss}>
                  Let AI Decide
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
