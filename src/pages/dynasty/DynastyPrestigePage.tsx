import { useMemo } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { cn } from '@/lib/cn.ts';
import { getDynastyBridge } from '@/dynasty/bridge/FranchiseIntegration.ts';
import { PrestigeEngine } from '@/dynasty/systems/PrestigeEngine.ts';
import type { PrestigeScore, PrestigeTier } from '@/dynasty/systems/PrestigeEngine.ts';

const TIER_COLORS: Record<PrestigeTier, string> = {
  Legend: 'text-gold',
  Elite: 'text-purple-400',
  'All-Star': 'text-green-light',
  'Solid Pro': 'text-cream',
  Journeyman: 'text-cream-dim',
  Prospect: 'text-cream-dim/50',
};

const HOF_LABELS: Record<string, { label: string; color: string }> = {
  first_ballot: { label: 'First-Ballot HOF', color: 'text-gold' },
  likely: { label: 'HOF Candidate', color: 'text-green-light' },
  borderline: { label: 'Borderline HOF', color: 'text-cream' },
  unlikely: { label: 'Unlikely HOF', color: 'text-cream-dim' },
  no_chance: { label: 'Not HOF Track', color: 'text-cream-dim/50' },
};

function PrestigeBar({ label, value, max, color = 'bg-gold/60' }: { label: string; value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-cream-dim uppercase tracking-wider">{label}</span>
        <span className="text-cream">{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-navy-lighter overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DynastyPrestigePage() {
  const bridge = getDynastyBridge();

  const prestige: PrestigeScore | null = useMemo(() => {
    if (!bridge) return null;
    const engine = new PrestigeEngine(bridge.entities);
    const entities = bridge.entities.getAllEntityIds();
    if (entities.length === 0) return null;
    return engine.calculate(entities[0]); // First entity = user avatar
  }, [bridge]);

  // Fallback demo data
  const score = prestige ?? {
    total: 42,
    breakdown: { career: 12, achievements: 8, reputation: 10, relationships: 7, wealth: 5 },
    tier: 'Solid Pro' as PrestigeTier,
    hofProjection: 'borderline' as const,
    milestones: ['Reached the front office', 'Fan favorite', 'Wide network of allies'],
  };

  const hof = HOF_LABELS[score.hofProjection];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl text-gold uppercase tracking-wide">Legacy & Prestige</h1>
        <p className="font-mono text-xs text-cream-dim/50 mt-1">Your career legacy score</p>
      </div>

      {/* Main Score */}
      <Panel>
        <div className="text-center py-6">
          <div className="font-display text-7xl text-gold mb-2">{score.total}</div>
          <div className={cn('font-display text-2xl uppercase tracking-wide', TIER_COLORS[score.tier])}>
            {score.tier}
          </div>
          <div className={cn('font-mono text-sm mt-2', hof.color)}>
            {hof.label}
          </div>
        </div>
      </Panel>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Panel title="Score Breakdown">
          <div className="space-y-3">
            <PrestigeBar label="Career Path" value={score.breakdown.career} max={25} color="bg-gold/60" />
            <PrestigeBar label="Achievements" value={score.breakdown.achievements} max={25} color="bg-purple-400/60" />
            <PrestigeBar label="Reputation" value={score.breakdown.reputation} max={25} color="bg-green-light/60" />
            <PrestigeBar label="Relationships" value={score.breakdown.relationships} max={15} color="bg-cyan-500/60" />
            <PrestigeBar label="Wealth" value={score.breakdown.wealth} max={10} color="bg-amber-400/60" />
          </div>
        </Panel>

        <Panel title="Milestones">
          {score.milestones.length > 0 ? (
            <div className="space-y-2">
              {score.milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gold">★</span>
                  <span className="text-cream">{m}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-cream-dim/40 font-mono text-sm">No milestones yet. Play through seasons to earn legacy.</p>
          )}
        </Panel>
      </div>

      {/* HOF Tracker */}
      <Panel title="Hall of Fame Projection" className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className={cn('font-display text-xl uppercase', hof.color)}>{hof.label}</div>
            <p className="text-cream-dim text-xs mt-1">
              {score.hofProjection === 'first_ballot' && 'Your legacy is cemented. First ballot, no question.'}
              {score.hofProjection === 'likely' && 'Strong candidate. A few more big moments and you\'re in.'}
              {score.hofProjection === 'borderline' && 'On the bubble. Need more awards or a championship to secure it.'}
              {score.hofProjection === 'unlikely' && 'Long shot. Would need a dramatic career turnaround.'}
              {score.hofProjection === 'no_chance' && 'Not on the HOF radar yet. Keep building your resume.'}
            </p>
          </div>
          <div className="text-right font-mono">
            <div className="text-3xl text-gold font-bold">{score.breakdown.career + score.breakdown.achievements}</div>
            <div className="text-xs text-cream-dim/50">HOF Score (need 30+)</div>
          </div>
        </div>
      </Panel>

      {/* Tier Progression */}
      <Panel title="Tier Progression" className="mt-6">
        <div className="flex items-center gap-1">
          {(['Prospect', 'Journeyman', 'Solid Pro', 'All-Star', 'Elite', 'Legend'] as PrestigeTier[]).map(tier => {
            const isActive = tier === score.tier;
            const isPast = (['Prospect', 'Journeyman', 'Solid Pro', 'All-Star', 'Elite', 'Legend'] as PrestigeTier[]).indexOf(tier) <
              (['Prospect', 'Journeyman', 'Solid Pro', 'All-Star', 'Elite', 'Legend'] as PrestigeTier[]).indexOf(score.tier);
            return (
              <div key={tier} className="flex-1">
                <div className={cn(
                  'h-2 rounded-full',
                  isActive ? 'bg-gold' : isPast ? 'bg-gold/30' : 'bg-navy-lighter'
                )} />
                <div className={cn(
                  'text-[9px] font-mono text-center mt-1',
                  isActive ? 'text-gold font-bold' : isPast ? 'text-cream-dim/50' : 'text-cream-dim/30'
                )}>
                  {tier}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
