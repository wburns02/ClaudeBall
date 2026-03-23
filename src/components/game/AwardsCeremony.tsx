/**
 * AwardsCeremony — dramatic animated reveal of season awards.
 * Shows each award category with a card-flip animation and voting breakdown.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
/** Lightweight award data for ceremony display */
export interface CeremonyAward {
  playerName: string;
  teamId: string;
  position: string;
  statLine: string;
}

const AWARD_META: Record<string, { label: string; color: string; bgGlow: string; gradientFrom: string }> = {
  MVP:           { label: 'Most Valuable Player',  color: 'text-gold',         bgGlow: 'shadow-[0_0_40px_rgba(212,168,67,0.3)]',    gradientFrom: 'from-gold/20' },
  CyYoung:       { label: 'Cy Young Award',        color: 'text-blue-400',     bgGlow: 'shadow-[0_0_40px_rgba(96,165,250,0.3)]',     gradientFrom: 'from-blue-400/20' },
  ROY:           { label: 'Rookie of the Year',    color: 'text-green-light',  bgGlow: 'shadow-[0_0_40px_rgba(74,222,128,0.3)]',     gradientFrom: 'from-green-400/20' },
  SilverSlugger: { label: 'Silver Slugger',        color: 'text-cream',        bgGlow: 'shadow-[0_0_30px_rgba(232,224,212,0.15)]',   gradientFrom: 'from-cream/10' },
  GoldGlove:     { label: 'Gold Glove',            color: 'text-gold',         bgGlow: 'shadow-[0_0_30px_rgba(212,168,67,0.2)]',     gradientFrom: 'from-gold/15' },
};

interface CeremonyStep {
  awardType: string;
  league: string;
  winner: CeremonyAward;
  runnersUp: CeremonyAward[];
}

interface Props {
  steps: CeremonyStep[];
  year: number;
  userTeamId: string | null;
  getTeamName: (id: string) => string;
  onClose: () => void;
}

function RevealCard({
  step,
  revealed,
  userTeamId,
  getTeamName,
}: {
  step: CeremonyStep;
  revealed: boolean;
  userTeamId: string | null;
  getTeamName: (id: string) => string;
}) {
  const meta = AWARD_META[step.awardType] ?? { label: step.awardType, color: 'text-cream', bgGlow: '', gradientFrom: 'from-cream/10' };
  const isUserWinner = step.winner.teamId === userTeamId;

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden transition-all duration-700',
      revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
      revealed && isUserWinner ? 'border-gold/60' : 'border-navy-lighter/40',
      revealed && meta.bgGlow,
    )}>
      {/* Gradient header */}
      <div className={cn('bg-gradient-to-r to-transparent px-5 py-4', meta.gradientFrom)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest">{step.league}</p>
            <h3 className={cn('font-display text-xl uppercase tracking-wide', meta.color)}>{meta.label}</h3>
          </div>
          {isUserWinner && (
            <span className="px-2 py-1 rounded bg-gold/20 border border-gold/40 font-mono text-[9px] text-gold uppercase tracking-wider animate-pulse">
              Your Player!
            </span>
          )}
        </div>
      </div>

      {/* Winner */}
      <div className="px-5 py-4 bg-navy-light/60">
        <div className="flex items-center gap-4">
          {/* Trophy icon area */}
          <div className={cn(
            'w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0',
            'bg-gradient-to-br from-navy-lighter/30 to-navy/30 border border-navy-lighter/40',
          )}>
            <span className={cn('font-display text-3xl', meta.color)}>
              {step.awardType === 'MVP' ? 'MVP' : step.awardType === 'CyYoung' ? 'CY' : step.awardType === 'ROY' ? 'ROY' : step.awardType === 'GoldGlove' ? 'GG' : 'SS'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className={cn('font-display text-2xl uppercase tracking-wide truncate', meta.color)}>
              {step.winner.playerName}
            </p>
            <p className="font-mono text-xs text-cream-dim mt-0.5">
              {step.winner.position} · {getTeamName(step.winner.teamId)}
            </p>
            <p className="font-mono text-sm text-cream mt-1">
              {step.winner.statLine}
            </p>
          </div>
        </div>
      </div>

      {/* Runners-up */}
      {step.runnersUp.length > 0 && (
        <div className="px-5 py-3 bg-navy/40 border-t border-navy-lighter/20">
          <p className="font-mono text-[9px] text-cream-dim/40 uppercase tracking-wider mb-2">Also Received Votes</p>
          <div className="space-y-1.5">
            {step.runnersUp.map((ru, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-cream-dim/30 w-4">{i + 2}.</span>
                <span className="font-body text-xs text-cream truncate flex-1">{ru.playerName}</span>
                <span className="font-mono text-[10px] text-cream-dim/50">{ru.position}</span>
                <span className="font-mono text-[10px] text-cream-dim/40">{getTeamName(ru.teamId).split(' ').pop()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AwardsCeremony({ steps, year, userTeamId, getTeamName, onClose }: Props) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const revealNext = useCallback(() => {
    setRevealedCount(c => Math.min(c + 1, steps.length));
  }, [steps.length]);

  // Auto-reveal one by one
  useEffect(() => {
    if (!autoPlay || revealedCount >= steps.length) return;
    const t = setTimeout(revealNext, 1200);
    return () => clearTimeout(t);
  }, [autoPlay, revealedCount, steps.length, revealNext]);

  const allRevealed = revealedCount >= steps.length;
  const userWins = steps.filter((s, i) => i < revealedCount && s.winner.teamId === userTeamId).length;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-start justify-center z-50 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto p-4 md:p-6 pb-20">
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <p className="font-mono text-[10px] text-gold/50 uppercase tracking-[0.3em] mb-2">{year} Season</p>
          <h1 className="font-display text-4xl md:text-5xl text-gold uppercase tracking-wide">
            Awards Ceremony
          </h1>
          <div className="w-24 h-0.5 bg-gold/30 mx-auto mt-3" />
          {userWins > 0 && (
            <p className="font-mono text-xs text-gold/70 mt-3">
              Your team won {userWins} award{userWins !== 1 ? 's' : ''}!
            </p>
          )}
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {steps.map((step, i) => (
            <RevealCard
              key={`${step.awardType}-${step.league}`}
              step={step}
              revealed={i < revealedCount}
              userTeamId={userTeamId}
              getTeamName={getTeamName}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-8">
          {!allRevealed && (
            <>
              <Button size="sm" variant="secondary" onClick={revealNext}>
                Reveal Next
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAutoPlay(false); setRevealedCount(steps.length); }}>
                Reveal All
              </Button>
            </>
          )}
          {allRevealed && (
            <Button onClick={onClose}>
              Close Ceremony
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
