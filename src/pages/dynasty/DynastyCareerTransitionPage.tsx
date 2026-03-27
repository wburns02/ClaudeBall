import { useState, useMemo } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import { getDynastyBridge } from '@/dynasty/bridge/FranchiseIntegration.ts';
import type { CareerOpportunity } from '@/dynasty/systems/CareerProgressionSystem.ts';

const ROLE_ICONS: Record<string, string> = {
  scout: 'binoculars', coach: 'clipboard', manager: 'megaphone',
  assistant_gm: 'briefcase', gm: 'crown', president: 'star',
  owner: 'building', broadcaster: 'mic',
};

const ROLE_COLORS: Record<string, string> = {
  scout: 'border-cyan-500/40 bg-cyan-500/5',
  coach: 'border-green-light/40 bg-green-light/5',
  manager: 'border-gold/40 bg-gold/5',
  assistant_gm: 'border-purple-400/40 bg-purple-400/5',
  gm: 'border-gold/60 bg-gold/10',
  president: 'border-amber-400/40 bg-amber-400/5',
  owner: 'border-yellow-300/40 bg-yellow-300/5',
  broadcaster: 'border-blue-400/40 bg-blue-400/5',
};

// Demo opportunities for display when no real data exists
const DEMO_OPPORTUNITIES: CareerOpportunity[] = [
  {
    role: 'scout', teamId: 'team1', teamName: 'Your Organization',
    description: 'Join the scouting department. Travel the country evaluating amateur and professional talent.',
    requirements: ['Baseball IQ 55+'], skipLevels: 0,
  },
  {
    role: 'coach', teamId: 'team1', teamName: 'Your Organization',
    description: 'Work with players directly as a hitting coach. Your playing experience gives you instant credibility.',
    requirements: ['Leadership 55+'], skipLevels: 0,
  },
  {
    role: 'assistant_gm', teamId: 'team2', teamName: 'Rival Organization',
    description: 'Your reputation and baseball mind earned you a fast-track to the front office. Skip the minor roles.',
    requirements: ['Baseball IQ 70+', 'Charisma 60+'], skipLevels: 2,
  },
  {
    role: 'broadcaster', teamId: '', teamName: 'ESPN Network',
    description: 'Your charisma and insights make you a natural for the broadcast booth. National exposure.',
    requirements: ['Charisma 60+'], skipLevels: 0,
  },
];

export function DynastyCareerTransitionPage() {
  const bridge = getDynastyBridge();
  const [accepted, setAccepted] = useState<string | null>(null);

  // Try to get real opportunities from the career progression system
  const opportunities = useMemo(() => {
    if (!bridge) return DEMO_OPPORTUNITIES;
    const entities = bridge.entities.getAllEntityIds();
    for (const id of entities) {
      const opps = bridge.careerProgression.getOpportunities(id);
      if (opps.length > 0) return opps;
    }
    return DEMO_OPPORTUNITIES;
  }, [bridge]);

  const handleAccept = (opp: CareerOpportunity) => {
    setAccepted(opp.role);
    if (bridge) {
      const entities = bridge.entities.getAllEntityIds();
      if (entities.length > 0) {
        bridge.careerProgression.acceptOpportunity(entities[0], opp);
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl text-gold uppercase tracking-wide">Career Transition</h1>
        <p className="font-mono text-xs text-cream-dim/50 mt-1">
          Your playing days are over. What's next?
        </p>
      </div>

      {!accepted ? (
        <div className="space-y-4">
          <h2 className="font-mono text-xs text-cream-dim/40 uppercase tracking-widest">Available Opportunities</h2>
          {opportunities.map((opp, i) => (
            <div key={i} className={cn('rounded-xl border p-5', ROLE_COLORS[opp.role] ?? 'border-navy-lighter')}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display text-xl text-cream uppercase tracking-wide">{opp.role.replace('_', ' ')}</div>
                  <div className="font-mono text-xs text-cream-dim/60 mt-0.5">
                    {opp.teamName}
                    {opp.skipLevels > 0 && (
                      <span className="ml-2 text-gold">Fast Track — skips {opp.skipLevels} level{opp.skipLevels > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-cream-dim text-sm leading-relaxed mb-3">{opp.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {opp.requirements.map((req, j) => (
                    <span key={j} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-cream-dim/60 border border-white/10">
                      {req}
                    </span>
                  ))}
                </div>
                <Button size="sm" onClick={() => handleAccept(opp)}>Accept</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Panel>
          <div className="text-center py-12">
            <div className="font-display text-4xl text-gold uppercase mb-4">
              {accepted.replace('_', ' ')}
            </div>
            <p className="text-cream text-lg mb-2">You've accepted a new role.</p>
            <p className="text-cream-dim text-sm">Your journey continues. Build your legacy from the other side of the game.</p>
            <Button className="mt-6" onClick={() => window.history.back()}>Return to Dashboard</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
