import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { Award } from '@/engine/season/index.ts';

const AWARD_LABELS = {
  MVP: 'Most Valuable Player',
  CyYoung: 'Cy Young Award',
  ROY: 'Rookie of the Year',
};

function AwardCard({ award, getTeamName }: { award: Award; getTeamName: (id: string) => string }) {
  return (
    <div className="p-4 rounded-lg border border-gold/40 bg-gold/5 space-y-1">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-gold text-lg tracking-wide">{award.playerName}</p>
          <p className="font-mono text-cream-dim text-sm">{getTeamName(award.teamId)}</p>
        </div>
        <span className="text-gold/60 font-mono text-xs">
          {award.value.toFixed(1)}
        </span>
      </div>
      <p className="font-mono text-cream-dim/60 text-xs uppercase tracking-widest">
        {AWARD_LABELS[award.type]}
      </p>
    </div>
  );
}

export function OffseasonPage() {
  const navigate = useNavigate();
  const {
    season, engine, userTeamId, isInitialized,
    startOffseason, initDraft, initFreeAgency, advanceSeason,
  } = useFranchiseStore();

  useEffect(() => {
    if (!isInitialized) navigate('/franchise/new');
  }, [isInitialized, navigate]);

  useEffect(() => {
    if (season?.phase === 'postseason' && season.playoffBracket?.isComplete()) {
      startOffseason();
    }
  }, [season?.phase, startOffseason]);

  if (!season || !engine) return null;

  // Guard: only show offseason page when actually in offseason
  if (season.phase !== 'offseason') {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/franchise')}>← Back to Dashboard</Button>
        </div>
        <Panel>
          <div className="text-center py-12">
            <p className="font-display text-2xl text-gold tracking-wide uppercase mb-2">Season in Progress</p>
            <p className="font-mono text-cream-dim text-sm">
              The offseason begins after the World Series ends.
            </p>
            <p className="font-mono text-cream-dim/50 text-xs mt-2">
              {season.phase === 'regular' && `${season.schedule.filter(g => !g.played).length} games remaining`}
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/franchise')}>Back to Dashboard</Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const awards = season.offseasonAwards ?? [];
  const retirements = season.offseasonRetirements ?? [];
  const userTeam = userTeamId ? engine.getTeam(userTeamId) : null;

  const getTeamName = (id: string) => {
    const t = engine.getTeam(id);
    return t ? `${t.city} ${t.name}` : id;
  };

  // Derive actual league names from awards (dynamic — not hardcoded)
  const leagueNames = [...new Set(awards.map(a => a.league))].sort();
  const league1 = leagueNames[0] ?? 'American';
  const league2 = leagueNames[1] ?? 'National';
  const league1Awards = awards.filter(a => a.league === league1);
  const league2Awards = awards.filter(a => a.league === league2);

  const handleStartDraft = () => {
    initDraft();
    navigate('/franchise/draft');
  };

  const handleFreeAgency = () => {
    initFreeAgency();
    navigate('/franchise/free-agency');
  };

  const handleAdvanceSeason = () => {
    advanceSeason();
    navigate('/franchise');
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto" data-testid="offseason-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            {season.year} Offseason
          </h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam?.city} {userTeam?.name} — {season.year}→{season.year + 1}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate('/')}>Menu</Button>
        </div>
      </div>

      {/* Awards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {[{ name: league1, awards: league1Awards }, { name: league2, awards: league2Awards }].map(({ name, awards: lgAwards }) => (
          <Panel key={name} title={`${name} Awards`}>
            <div className="space-y-3">
              {lgAwards.length === 0 ? (
                <p className="text-cream-dim font-mono text-sm">No awards data</p>
              ) : (
                lgAwards
                  .sort((a, b) => {
                    const order = ['MVP', 'CyYoung', 'ROY'];
                    return order.indexOf(a.type) - order.indexOf(b.type);
                  })
                  .map(a => (
                    <AwardCard key={`${a.league}-${a.type}`} award={a} getTeamName={getTeamName} />
                  ))
              )}
            </div>
          </Panel>
        ))}
      </div>

      {/* Retirements */}
      <Panel title={`Retirements (${retirements.length})`} className="mb-6">
        {retirements.length === 0 ? (
          <p className="text-cream-dim font-mono text-sm">No players retired this offseason</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {retirements.map(r => (
              <div
                key={r.playerId}
                className={cn(
                  'p-2 rounded border border-navy-lighter font-mono text-sm',
                  r.teamId === userTeamId && 'border-gold/30 bg-gold/5'
                )}
              >
                <p className="text-cream">{r.playerName}</p>
                <p className="text-cream-dim text-xs">Age {r.age} — {getTeamName(r.teamId)}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Offseason Actions */}
      <Panel title="Offseason Actions" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-navy-lighter text-center space-y-2">
            <p className="font-display text-gold text-sm tracking-wide uppercase">Free Agency</p>
            <p className="font-mono text-cream-dim text-xs">Sign available players to bolster your roster</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={handleFreeAgency}>
              Browse FA Market
            </Button>
          </div>

          <div className="p-3 rounded-lg border border-navy-lighter text-center space-y-2">
            <p className="font-display text-gold text-sm tracking-wide uppercase">Draft</p>
            <p className="font-mono text-cream-dim text-xs">Select prospects in the annual draft</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={handleStartDraft}>
              Enter Draft Room
            </Button>
          </div>

          <div className="p-3 rounded-lg border border-navy-lighter text-center space-y-2">
            <p className="font-display text-gold text-sm tracking-wide uppercase">Trades</p>
            <p className="font-mono text-cream-dim text-xs">Trade players with other teams</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => navigate('/franchise/trade')}>
              Trade Block
            </Button>
          </div>
        </div>
      </Panel>

      {/* Advance to Next Season */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleAdvanceSeason}
          data-testid="advance-season-btn"
        >
          Advance to {season.year + 1} Season
        </Button>
      </div>
    </div>
  );
}
