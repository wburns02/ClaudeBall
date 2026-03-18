import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { DraftProspect } from '@/engine/gm/DraftEngine.ts';

const POSITION_COLORS: Record<string, string> = {
  P: 'text-blue-400',
  C: 'text-purple-400',
  '1B': 'text-green-light',
  '2B': 'text-green-light',
  '3B': 'text-green-light',
  SS: 'text-gold',
  LF: 'text-cream',
  CF: 'text-cream',
  RF: 'text-cream',
  DH: 'text-red',
};

function ratingBar(value: number) {
  const pct = Math.round(value);
  const color =
    value >= 80 ? 'bg-gold' :
    value >= 70 ? 'bg-green-light' :
    value >= 55 ? 'bg-cream-dim' :
    'bg-navy-lighter';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

export function DraftPage() {
  const navigate = useNavigate();
  const {
    season, engine, userTeamId, isInitialized,
    draftClass, draftPickOrder, currentDraftPick, draftComplete,
    initDraft, draftPlayer,
  } = useFranchiseStore();

  const [selectedProspect, setSelectedProspect] = useState<DraftProspect | null>(null);
  const [posFilter, setPosFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!isInitialized) navigate('/franchise/new');
  }, [isInitialized, navigate]);

  // Auto-init draft if needed
  useEffect(() => {
    if (!draftClass && season && engine) {
      initDraft();
    }
  }, [draftClass, season, engine, initDraft]);

  if (!season || !engine || !draftClass) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Panel>
          <p className="text-cream-dim font-mono">Loading draft room...</p>
        </Panel>
      </div>
    );
  }

  const totalPicks = draftClass.picks.length;
  const teamsCount = draftPickOrder.length;
  const currentPickEntry = draftClass.picks[currentDraftPick];
  const currentPickTeamId = currentPickEntry?.teamId ?? '';
  const isUserTurn = currentPickTeamId === userTeamId && !draftComplete;

  // Current round/pick
  const currentRound = draftComplete ? '—' : `${Math.floor(currentDraftPick / teamsCount) + 1}`;
  const currentPickNum = draftComplete ? '—' : `${(currentDraftPick % teamsCount) + 1}`;

  // Available prospects (not yet drafted)
  const draftedIds = new Set(draftClass.picks.filter(p => p.prospectId).map(p => p.prospectId!));
  const available = draftClass.prospects
    .filter(p => !draftedIds.has(p.id))
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .sort((a, b) => b.potentialRating - a.potentialRating);

  // Drafted players (recent picks first)
  const recentPicks = draftClass.picks
    .filter(p => p.prospectId)
    .slice(-10)
    .reverse();

  const positions = ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  const handleDraft = () => {
    if (!selectedProspect || !isUserTurn) return;
    const success = draftPlayer(selectedProspect.id);
    if (success) setSelectedProspect(null);
  };

  const handleBack = () => navigate('/franchise/offseason');

  const teamName = (id: string) => {
    const t = engine.getTeam(id);
    return t?.abbreviation ?? id.slice(0, 3).toUpperCase();
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto" data-testid="draft-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            {season.year + 1} Draft Room
          </h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {draftComplete
              ? 'Draft Complete'
              : isUserTurn
                ? `Your Pick — Round ${currentRound}, Pick ${currentPickNum}`
                : `Round ${currentRound}, Pick ${currentPickNum} — ${teamName(currentPickTeamId)} on the clock`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleBack}>
            Back to Offseason
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/')}>Menu</Button>
        </div>
      </div>

      {/* Draft status bar */}
      <div className="mb-4 p-3 rounded-lg border border-navy-lighter bg-navy-light">
        <div className="flex items-center justify-between font-mono text-sm">
          <span className="text-cream-dim">
            Pick <span className="text-cream font-bold">{Math.min(currentDraftPick + 1, totalPicks)}</span> of{' '}
            <span className="text-cream">{totalPicks}</span>
          </span>
          <span className={cn(
            'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest',
            isUserTurn ? 'bg-gold text-navy' : draftComplete ? 'bg-navy-lighter text-cream-dim' : 'bg-navy-lighter text-cream'
          )}>
            {draftComplete ? 'Complete' : isUserTurn ? 'Your Pick' : 'CPU Picking...'}
          </span>
          <span className="text-cream-dim">
            Available: <span className="text-cream font-bold">{available.length + (posFilter === 'ALL' ? 0 : 0)}</span>
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold/60 rounded-full transition-all"
            style={{ width: `${(currentDraftPick / totalPicks) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Prospect Board (main) */}
        <div className="lg:col-span-2 space-y-3">
          <Panel title="Available Prospects">
            {/* Position filter */}
            <div className="flex flex-wrap gap-1 mb-3">
              {positions.map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-mono border transition-colors',
                    posFilter === pos
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-navy-lighter text-cream-dim hover:border-navy-lighter/80'
                  )}
                >
                  {pos}
                </button>
              ))}
            </div>

            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {available.length === 0 ? (
                <p className="text-cream-dim font-mono text-sm py-4 text-center">No prospects available</p>
              ) : (
                available.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProspect(p)}
                    className={cn(
                      'w-full text-left p-2 rounded border transition-colors',
                      selectedProspect?.id === p.id
                        ? 'border-gold bg-gold/10'
                        : 'border-navy-lighter/40 hover:border-navy-lighter bg-navy-light/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cream-dim/60 text-xs w-5">{i + 1}</span>
                        <span className={cn('font-mono text-xs font-bold w-6', POSITION_COLORS[p.position] ?? 'text-cream')}>
                          {p.position}
                        </span>
                        <span className="font-body text-cream text-sm">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="font-mono text-cream-dim/60 text-xs">age {p.age}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono text-xs text-cream-dim">OVR</p>
                          <p className="font-mono text-sm text-cream font-bold">{p.currentRating}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs text-cream-dim">POT</p>
                          <p className={cn(
                            'font-mono text-sm font-bold',
                            p.potentialRating >= 85 ? 'text-gold' :
                            p.potentialRating >= 75 ? 'text-green-light' : 'text-cream'
                          )}>{p.potentialRating}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Panel>

          {/* Recent Picks */}
          <Panel title="Recent Picks">
            <StatsTable
              columns={[
                { key: 'pick', label: '#', align: 'right' },
                { key: 'team', label: 'Team', align: 'left' },
                { key: 'player', label: 'Player', align: 'left' },
                { key: 'pos', label: 'POS', align: 'center' },
                { key: 'ovr', label: 'OVR', align: 'right' },
                { key: 'pot', label: 'POT', align: 'right' },
              ]}
              rows={recentPicks.map(pk => {
                const prospect = draftClass.prospects.find(p => p.id === pk.prospectId);
                return {
                  pick: pk.overallPick,
                  team: teamName(pk.teamId),
                  player: prospect ? `${prospect.firstName} ${prospect.lastName}` : '—',
                  pos: prospect?.position ?? '—',
                  ovr: prospect?.currentRating ?? '—',
                  pot: prospect?.potentialRating ?? '—',
                };
              })}
              compact
            />
          </Panel>
        </div>

        {/* Right sidebar: selected prospect + pick action */}
        <div className="space-y-3">
          {/* Selected prospect detail */}
          <Panel title="Scout Report">
            {selectedProspect ? (
              <div className="space-y-3">
                <div>
                  <p className="font-display text-gold text-xl">
                    {selectedProspect.firstName} {selectedProspect.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('font-mono text-sm font-bold', POSITION_COLORS[selectedProspect.position] ?? 'text-cream')}>
                      {selectedProspect.position}
                    </span>
                    <span className="text-cream-dim font-mono text-sm">Age {selectedProspect.age}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="font-mono text-xs text-cream-dim uppercase tracking-widest mb-1">Current</p>
                    {ratingBar(selectedProspect.currentRating)}
                  </div>
                  <div>
                    <p className="font-mono text-xs text-cream-dim uppercase tracking-widest mb-1">Potential</p>
                    {ratingBar(selectedProspect.potentialRating)}
                  </div>
                </div>

                <div className="p-2 rounded bg-navy-lighter/20 border border-navy-lighter/40">
                  <p className="font-mono text-xs text-cream-dim italic">{selectedProspect.summary}</p>
                </div>

                {isUserTurn && !draftComplete ? (
                  <Button
                    className="w-full"
                    onClick={handleDraft}
                    data-testid="draft-player-btn"
                  >
                    Draft {selectedProspect.lastName}
                  </Button>
                ) : (
                  <p className="text-center font-mono text-xs text-cream-dim/50">
                    {draftComplete ? 'Draft is complete' : 'Wait for your turn'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-cream-dim font-mono text-sm text-center py-4">
                Select a prospect to view report
              </p>
            )}
          </Panel>

          {/* Draft order preview */}
          <Panel title="Pick Order (Next 5)">
            <div className="space-y-1">
              {draftClass.picks.slice(currentDraftPick, currentDraftPick + 5).map((pk, i) => (
                <div
                  key={pk.overallPick}
                  className={cn(
                    'flex items-center justify-between p-1.5 rounded font-mono text-sm',
                    i === 0 && !draftComplete ? 'bg-gold/10 border border-gold/30' : 'border border-transparent'
                  )}
                >
                  <span className="text-cream-dim text-xs">#{pk.overallPick}</span>
                  <span className={cn(
                    'font-bold',
                    pk.teamId === userTeamId ? 'text-gold' : 'text-cream'
                  )}>
                    {teamName(pk.teamId)}
                  </span>
                  <span className="text-cream-dim text-xs">R{pk.round}</span>
                </div>
              ))}
              {currentDraftPick >= totalPicks && (
                <p className="text-cream-dim text-xs text-center py-2">Draft complete</p>
              )}
            </div>
          </Panel>

          {draftComplete && (
            <Button
              className="w-full"
              onClick={() => navigate('/franchise/offseason')}
              data-testid="draft-complete-btn"
            >
              Return to Offseason
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
