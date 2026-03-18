import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { SeriesMatchup } from '@/engine/season/index.ts';

function seriesLabel(round: SeriesMatchup['round']): string {
  switch (round) {
    case 'wildcard': return 'Wild Card';
    case 'division': return 'Division Series';
    case 'championship': return 'Championship Series';
    case 'worldseries': return 'World Series';
  }
}

function MatchupCard({
  matchup,
  getAbbr,
  userTeamId,
}: {
  matchup: SeriesMatchup;
  getAbbr: (id: string) => string;
  userTeamId: string | null;
}) {
  const isWS = matchup.round === 'worldseries';
  const isUserInvolved = matchup.teamAId === userTeamId || matchup.teamBId === userTeamId;

  if (!matchup.teamAId && !matchup.teamBId) {
    return (
      <div className={cn(
        'rounded-lg border p-3 text-center font-mono text-sm text-cream-dim/50',
        'border-navy-lighter bg-navy-light/50'
      )}>
        TBD
      </div>
    );
  }

  const formatRecord = (wins: number, losses: number) => `${wins}-${losses}`;

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      isWS ? 'border-gold/60 bg-gold/5' : 'border-navy-lighter bg-navy-light',
      isUserInvolved && 'border-gold/40'
    )}>
      {/* Team A */}
      <div className={cn(
        'flex items-center justify-between font-mono text-sm',
        matchup.winner === matchup.teamAId && 'text-gold font-bold',
        matchup.winner && matchup.winner !== matchup.teamAId && 'opacity-40'
      )}>
        <span className="flex items-center gap-1">
          {matchup.winner === matchup.teamAId && <span className="text-gold">✦</span>}
          {matchup.teamAId ? getAbbr(matchup.teamAId) : 'TBD'}
          {matchup.teamAId === userTeamId && <span className="text-gold text-xs">★</span>}
        </span>
        <span className="text-lg font-bold">{matchup.teamAWins}</span>
      </div>

      <div className="h-px bg-navy-lighter/40" />

      {/* Team B */}
      <div className={cn(
        'flex items-center justify-between font-mono text-sm',
        matchup.winner === matchup.teamBId && 'text-gold font-bold',
        matchup.winner && matchup.winner !== matchup.teamBId && 'opacity-40'
      )}>
        <span className="flex items-center gap-1">
          {matchup.winner === matchup.teamBId && <span className="text-gold">✦</span>}
          {matchup.teamBId ? getAbbr(matchup.teamBId) : 'TBD'}
          {matchup.teamBId === userTeamId && <span className="text-gold text-xs">★</span>}
        </span>
        <span className="text-lg font-bold">{matchup.teamBWins}</span>
      </div>

      {/* Series status */}
      <div className="text-xs font-mono text-cream-dim/60 text-center pt-1">
        {matchup.winner
          ? `${getAbbr(matchup.winner)} wins ${formatRecord(
              matchup.teamAId === matchup.winner ? matchup.teamAWins : matchup.teamBWins,
              matchup.teamAId === matchup.winner ? matchup.teamBWins : matchup.teamAWins
            )}`
          : `Best of ${matchup.gamesNeeded * 2 - 1}`
        }
      </div>
    </div>
  );
}

function RoundSection({
  title,
  matchups,
  getAbbr,
  userTeamId,
}: {
  title: string;
  matchups: SeriesMatchup[];
  getAbbr: (id: string) => string;
  userTeamId: string | null;
}) {
  const active = matchups.filter(m => m.teamAId || m.teamBId);
  if (active.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-display text-sm text-cream-dim tracking-widest uppercase">{title}</h3>
      <div className="grid grid-cols-1 gap-2">
        {matchups.map(m => (
          <MatchupCard key={m.id} matchup={m} getAbbr={getAbbr} userTeamId={userTeamId} />
        ))}
      </div>
    </div>
  );
}

export function PlayoffsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, isInitialized, startPlayoffs, simPlayoffRound, startOffseason } = useFranchiseStore();

  useEffect(() => {
    if (!isInitialized) navigate('/franchise/new');
  }, [isInitialized, navigate]);

  if (!season || !engine) return null;

  // Ensure playoffs are started
  useEffect(() => {
    if (season.phase === 'regular' || season.phase === 'preseason') {
      startPlayoffs();
    }
  }, [season.phase, startPlayoffs]);

  const bracket = season.playoffBracket;
  const champion = bracket?.getChampion();
  const championTeam = champion ? engine.getTeam(champion) : null;
  const isComplete = bracket?.isComplete() ?? false;
  const currentRound = bracket?.getCurrentRound();

  const getAbbr = (id: string) => engine.getTeam(id)?.abbreviation ?? id.toUpperCase().slice(0, 3);

  const handleSimRound = () => {
    simPlayoffRound();
  };

  const handleGoOffseason = () => {
    startOffseason();
    navigate('/franchise/offseason');
  };

  if (!bracket) {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto flex items-center justify-center">
        <Panel>
          <p className="text-cream-dim font-mono">Loading playoffs...</p>
        </Panel>
      </div>
    );
  }

  const { wildcard, division, championship, worldseries } = bracket.getBracket();

  const roundLabels: Record<SeriesMatchup['round'], string> = {
    wildcard: 'Wild Card Round',
    division: 'Division Series',
    championship: 'Championship Series',
    worldseries: 'World Series',
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto" data-testid="playoffs-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            {season.year} Playoffs
          </h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {isComplete
              ? `World Series Champion: ${championTeam?.city} ${championTeam?.name}`
              : `Current Round: ${currentRound ? roundLabels[currentRound] : '—'}`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise')}>
            Dashboard
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/')}>
            Menu
          </Button>
        </div>
      </div>

      {/* Champion Banner */}
      {isComplete && champion && (
        <div className="mb-6 p-6 rounded-lg border-2 border-gold bg-gold/10 text-center">
          <p className="font-display text-gold text-lg tracking-widest uppercase mb-1">World Series Champion</p>
          <p className="font-display text-4xl text-gold tracking-wide">
            {championTeam?.city} {championTeam?.name}
          </p>
          {champion === userTeamId && (
            <p className="font-mono text-cream text-sm mt-2 uppercase tracking-widest">Your Team Won It All!</p>
          )}
        </div>
      )}

      {/* Two-column bracket: AL / NL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* AL Bracket */}
        <Panel title="American League" className="space-y-4">
          <div className="space-y-4">
            <RoundSection
              title="Wild Card"
              matchups={wildcard.filter(m => m.league === 'AL')}
              getAbbr={getAbbr}
              userTeamId={userTeamId}
            />
            <RoundSection
              title="Division Series"
              matchups={division.filter(m => m.league === 'AL')}
              getAbbr={getAbbr}
              userTeamId={userTeamId}
            />
            <RoundSection
              title="ALCS"
              matchups={championship.filter(m => m.league === 'AL')}
              getAbbr={getAbbr}
              userTeamId={userTeamId}
            />
          </div>
        </Panel>

        {/* World Series */}
        <Panel title="World Series" className="flex flex-col justify-center">
          <div className="space-y-4">
            {worldseries.map(m => (
              <MatchupCard key={m.id} matchup={m} getAbbr={getAbbr} userTeamId={userTeamId} />
            ))}
          </div>
          {!isComplete && (
            <p className="text-center font-mono text-xs text-cream-dim/50 mt-4">
              AL Champion vs NL Champion
            </p>
          )}
        </Panel>

        {/* NL Bracket */}
        <Panel title="National League" className="space-y-4">
          <div className="space-y-4">
            <RoundSection
              title="Wild Card"
              matchups={wildcard.filter(m => m.league === 'NL')}
              getAbbr={getAbbr}
              userTeamId={userTeamId}
            />
            <RoundSection
              title="Division Series"
              matchups={division.filter(m => m.league === 'NL')}
              getAbbr={getAbbr}
              userTeamId={userTeamId}
            />
            <RoundSection
              title="NLCS"
              matchups={championship.filter(m => m.league === 'NL')}
              getAbbr={getAbbr}
              userTeamId={userTeamId}
            />
          </div>
        </Panel>
      </div>

      {/* Qualifiers */}
      {season.playoffQualifiers && (
        <Panel title="Playoff Qualifiers" className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            {(['AL', 'NL'] as const).map(league => (
              <div key={league}>
                <h4 className="font-display text-sm text-gold tracking-widest uppercase mb-2">{league}</h4>
                <div className="space-y-1">
                  {season.playoffQualifiers!
                    .filter(q => q.league === league)
                    .sort((a, b) => a.seed - b.seed)
                    .map(q => (
                      <div key={q.teamId} className="flex items-center gap-2 font-mono text-sm">
                        <span className="text-cream-dim w-4">#{q.seed}</span>
                        <span className={cn(
                          'text-cream',
                          q.teamId === userTeamId && 'text-gold font-bold'
                        )}>
                          {getAbbr(q.teamId)}
                        </span>
                        <span className="text-cream-dim text-xs">
                          {q.record.wins}-{q.record.losses}
                        </span>
                        {q.isWildCard && (
                          <span className="text-cream-dim/50 text-xs">(WC)</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        {!isComplete ? (
          <Button
            size="lg"
            onClick={handleSimRound}
            data-testid="sim-round-btn"
          >
            Sim {currentRound ? seriesLabel(currentRound) : 'Next Round'}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleGoOffseason}
            data-testid="go-offseason-btn"
          >
            Begin Offseason
          </Button>
        )}
        <Button variant="secondary" size="md" onClick={() => navigate('/franchise')}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
