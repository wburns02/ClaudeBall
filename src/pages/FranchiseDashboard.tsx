import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { winPct, gamesBehind, streakStr, last10Str, runDifferential } from '@/engine/season/index.ts';
import type { TeamRecord } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

// Season milestones
const MILESTONES = [
  { day: 90, label: 'All-Star Break', shortLabel: 'ASB', color: 'text-gold' },
  { day: 120, label: 'Trade Deadline', shortLabel: 'TDL', color: 'text-red-400' },
  { day: 183, label: 'Playoffs', shortLabel: 'PO', color: 'text-green-light' },
];

function SeasonProgressBar({ currentDay, totalDays }: { currentDay: number; totalDays: number }) {
  const pct = Math.min(100, (currentDay / totalDays) * 100);
  return (
    <div>
      <div className="flex justify-between font-mono text-xs text-cream-dim mb-1">
        <span>{currentDay === 0 ? 'Opening Day' : `Day ${currentDay}`}</span>
        <span className="text-cream-dim/60">{currentDay === 0 ? 'Season not started' : 'Season Progress'}</span>
        <span>Day {totalDays}</span>
      </div>
      <div className="relative h-5 bg-navy-lighter rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/60 to-gold/90 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
        {/* Milestone markers */}
        {MILESTONES.map(m => (
          <div
            key={m.day}
            className={cn(
              'absolute top-0 bottom-0 flex items-center',
              currentDay >= m.day ? 'opacity-40' : 'opacity-100',
            )}
            style={{ left: `${(m.day / totalDays) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-px h-full bg-cream-dim/40" />
          </div>
        ))}
      </div>
      {/* Milestone labels */}
      <div className="relative h-5 mt-0.5">
        {MILESTONES.map(m => (
          <div
            key={m.day}
            className="absolute flex flex-col items-center"
            style={{ left: `${(m.day / totalDays) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <span className={cn(
              'font-mono text-[10px] whitespace-nowrap',
              currentDay >= m.day ? 'text-cream-dim/40' : m.color,
            )}>
              {m.shortLabel}
            </span>
          </div>
        ))}
      </div>
      <p className="font-mono text-xs text-cream-dim/40 text-right mt-0.5">
        {Math.round(pct)}% complete
      </p>
    </div>
  );
}

export function FranchiseDashboard() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, isInitialized, advanceDay, simDays, startPlayoffs, lastDayEvents, ilRoster, getTeamInjuries } = useFranchiseStore();
  const [showEvents, setShowEvents] = useState(true);
  const [simConfirm, setSimConfirm] = useState<number | null>(null); // days pending confirm

  useEffect(() => {
    if (!isInitialized) navigate('/franchise/new');
  }, [isInitialized, navigate]);

  if (!season || !engine || !userTeamId) return null;

  const userRecord = season.standings.getRecord(userTeamId);
  const userTeam = engine.getTeam(userTeamId);
  const upcoming = engine.getUpcomingUserGames(5);
  const recent = engine.getTeamResults(userTeamId, 5);
  const divStandings = season.standings.getDivisionStandings();

  // Find user's division
  const userDiv = divStandings.find(d => d.teams.some(t => t.teamId === userTeamId));

  // IL action: injured players not yet placed on IL
  const activeInjuries = getTeamInjuries(userTeamId).filter(r => !r.returned);
  const ilPlayerIds = new Set(ilRoster.map(s => s.playerId));
  const unplacedInjuries = activeInjuries.filter(r => !ilPlayerIds.has(r.playerId));
  // Players healed but still on IL
  const healedOnIL = ilRoster.filter(slot => {
    const rec = activeInjuries.find(r => r.playerId === slot.playerId);
    return !rec || rec.returned;
  });

  const handleAdvance = () => {
    setShowEvents(true);
    const userGame = advanceDay();
    if (userGame) {
      navigate(`/game/live?gameId=${userGame.id}`);
    }
  };

  const handleSimWeek = () => { setShowEvents(true); simDays(7); };
  const handleSimConfirm = (days: number) => { setShowEvents(true); simDays(days); setSimConfirm(null); };

  const isRegularSeason = season.phase === 'regular' || season.phase === 'preseason';
  const isPostseason = season.phase === 'postseason';
  const isOffseason = season.phase === 'offseason';

  const handleStartPlayoffs = () => {
    startPlayoffs();
    navigate('/franchise/playoffs');
  };

  const regularSeasonComplete =
    season.phase === 'postseason' ||
    (season.currentDay >= season.totalDays && season.schedule.every(g => g.played));

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
          {userTeam?.city} {userTeam?.name}
        </h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {season.currentDay === 0 ? 'Opening Day' : `Day ${season.currentDay}`} of {season.totalDays} — {season.year} Season
          {' '}
          <span className={cn(
            'uppercase text-xs font-bold ml-1 px-1.5 py-0.5 rounded',
            season.phase === 'regular' && 'bg-green-light/10 text-green-light',
            season.phase === 'preseason' && 'bg-cream-dim/10 text-cream-dim',
            season.phase === 'postseason' && 'bg-gold/10 text-gold',
            season.phase === 'offseason' && 'bg-navy-lighter text-cream-dim',
          )}>
            {season.phase}
          </span>
        </p>
      </div>

      {/* IL Action Banner */}
      {(unplacedInjuries.length > 0 || healedOnIL.length > 0) && (
        <div
          className="mb-4 px-4 py-3 rounded-lg border border-red-500/30 bg-red-950/20 flex items-center justify-between gap-3 cursor-pointer hover:border-red-500/50 transition-colors"
          onClick={() => navigate('/franchise/injuries')}
        >
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg shrink-0">🏥</span>
            <div>
              {unplacedInjuries.length > 0 && (
                <p className="font-mono text-xs text-red-400 font-bold">
                  {unplacedInjuries.length} injured player{unplacedInjuries.length !== 1 ? 's' : ''} not on IL
                  {' '}— <span className="text-cream-dim">{unplacedInjuries.map(r => r.playerName.split(' ').pop()).join(', ')}</span>
                </p>
              )}
              {healedOnIL.length > 0 && (
                <p className="font-mono text-xs text-green-light font-bold">
                  {healedOnIL.length} player{healedOnIL.length !== 1 ? 's' : ''} ready to activate from IL
                </p>
              )}
            </div>
          </div>
          <span className="font-mono text-xs text-red-400/60 shrink-0">Manage IL →</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team Record */}
        <Panel title="Your Record">
          {userRecord && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-4xl font-mono font-bold text-gold">
                  {userRecord.wins}-{userRecord.losses}
                </span>
                <span className="text-xl font-mono text-cream-dim">{winPct(userRecord)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-sm">
                <div>
                  <p className="text-cream-dim text-xs">Home</p>
                  <p className="text-cream">{userRecord.homeWins}-{userRecord.homeLosses}</p>
                </div>
                <div>
                  <p className="text-cream-dim text-xs">Away</p>
                  <p className="text-cream">{userRecord.awayWins}-{userRecord.awayLosses}</p>
                </div>
                <div>
                  <p className="text-cream-dim text-xs">Run Diff</p>
                  <p className={cn('font-bold',
                    userRecord.runsScored > userRecord.runsAllowed ? 'text-green-light' : 'text-red'
                  )}>{runDifferential(userRecord)}</p>
                </div>
              </div>
              <div className="flex gap-4 text-sm font-mono">
                <span className="text-cream-dim">Streak: <span className="text-cream">{streakStr(userRecord)}</span></span>
                <span className="text-cream-dim">L10: <span className="text-cream">{last10Str(userRecord)}</span></span>
              </div>
            </div>
          )}
        </Panel>

        {/* Actions */}
        <Panel title="Actions">
          <div className="space-y-2">
            {isRegularSeason && (
              <>
                <Button className="w-full" onClick={handleAdvance}>
                  Advance Day {season.currentDay + 1}
                </Button>
                <Button className="w-full" variant="secondary" onClick={handleSimWeek}>
                  Sim 7 Days
                </Button>
                <Button className="w-full" variant="secondary" onClick={() => { setShowEvents(true); simDays(30); }}>
                  Sim 30 Days
                </Button>
                {season.currentDay >= season.totalDays - 7 && (
                  <Button className="w-full" variant="secondary" onClick={() => { setShowEvents(true); simDays(183); }}>
                    Finish Season
                  </Button>
                )}
              </>
            )}
            {(season.phase === 'postseason' || regularSeasonComplete) && !isOffseason && (
              <>
                <Button
                  className="w-full"
                  onClick={handleStartPlayoffs}
                  data-testid="start-playoffs-btn"
                >
                  Go to Playoffs
                </Button>
              </>
            )}
            {isOffseason && (
              <>
                <Button className="w-full" onClick={() => navigate('/franchise/offseason')}>
                  Offseason Hub
                </Button>
                <Button className="w-full" variant="secondary" onClick={() => navigate('/franchise/draft')}>
                  Draft Room
                </Button>
                <Button className="w-full" variant="secondary" onClick={() => navigate('/franchise/free-agency')}>
                  Free Agency
                </Button>
              </>
            )}
          </div>
        </Panel>

        {/* Division Standings */}
        {userDiv && (
          <Panel title={`${userDiv.league} ${userDiv.division}`}>
            <StatsTable
              columns={[
                { key: 'team', label: 'Team', align: 'left' },
                { key: 'w', label: 'W', align: 'right' },
                { key: 'l', label: 'L', align: 'right' },
                { key: 'pct', label: 'PCT', align: 'right' },
                { key: 'gb', label: 'GB', align: 'right' },
              ]}
              rows={userDiv.teams.map((t: TeamRecord, i: number) => ({
                team: (t.teamId === userTeamId ? '► ' : '') + (engine.getTeam(t.teamId)?.abbreviation ?? t.teamId),
                w: t.wins,
                l: t.losses,
                pct: winPct(t),
                gb: i === 0 ? '—' : gamesBehind(userDiv.teams[0], t),
              }))}
              compact
            />
          </Panel>
        )}
      </div>

      {/* Postseason / Offseason banners */}
      {isPostseason && season.playoffBracket && (
        <div className="mt-4 p-4 rounded-lg border border-gold/40 bg-gold/5 flex items-center justify-between">
          <div>
            <p className="font-display text-gold text-lg">Postseason</p>
            <p className="font-mono text-cream-dim text-sm">
              {season.playoffBracket.isComplete()
                ? `Champion: ${engine.getTeam(season.playoffBracket.getChampion() ?? '')?.name ?? '—'}`
                : `Current round: ${season.playoffBracket.getCurrentRound()}`
              }
            </p>
          </div>
          <Button onClick={() => navigate('/franchise/playoffs')}>View Bracket</Button>
        </div>
      )}

      {isOffseason && (
        <div className="mt-4 p-4 rounded-lg border border-navy-lighter bg-navy-light/50 flex items-center justify-between">
          <div>
            <p className="font-display text-cream text-lg">Offseason</p>
            <p className="font-mono text-cream-dim text-sm">
              {season.offseasonAwards?.length
                ? `${season.offseasonAwards.length} awards given — ${season.offseasonRetirements?.length ?? 0} retirements`
                : 'Prepare for next season'
              }
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/franchise/offseason')}>
            Offseason Hub
          </Button>
        </div>
      )}

      {/* Day Events Summary */}
      {showEvents && lastDayEvents && (lastDayEvents.injuries.length + lastDayEvents.returns.length + lastDayEvents.callups.length + lastDayEvents.aiTrades.length) > 0 && (
        <div className="mt-4 p-4 rounded-lg border border-navy-lighter bg-navy-light/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm text-cream uppercase tracking-wider">Last Sim Summary</h3>
            <button
              onClick={() => setShowEvents(false)}
              className="font-mono text-xs text-cream-dim/60 hover:text-cream border border-cream-dim/20 hover:border-cream-dim/50 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              ✕ Dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            {lastDayEvents.injuries.map((e, i) => (
              <span key={`inj-${i}`} className="px-2 py-1 bg-red/10 border border-red/20 rounded text-red-400">
                🩹 {e.record.playerName} injured ({e.record.daysOut}d)
              </span>
            ))}
            {lastDayEvents.returns.map((e, i) => (
              <span key={`ret-${i}`} className="px-2 py-1 bg-green-900/20 border border-green-light/20 rounded text-green-light">
                ✓ {e.record.playerName} returned
              </span>
            ))}
            {lastDayEvents.callups.map((e, i) => (
              <span key={`cup-${i}`} className={cn(
                'px-2 py-1 rounded border',
                e.type === 'callup'
                  ? 'bg-gold/10 border-gold/20 text-gold'
                  : 'bg-navy-lighter/30 border-navy-lighter text-cream-dim',
              )}>
                {e.type === 'callup' ? '↑' : '↓'} {e.message}
              </span>
            ))}
            {lastDayEvents.aiTrades.map((e, i) => (
              <span key={`trd-${i}`} className="px-2 py-1 bg-blue-900/20 border border-blue-400/20 rounded text-blue-400">
                🔄 Trade: {e.description ?? 'AI teams swapped players'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Season Progress Bar */}
      {isRegularSeason && (
        <div className="mt-4">
          <Panel title="Season Progress">
            <SeasonProgressBar currentDay={season.currentDay} totalDays={season.totalDays} />
          </Panel>
        </div>
      )}

      {/* Recent & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Panel title="Recent Results">
          {recent.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <div className="text-3xl opacity-30">⚾</div>
              <p className="text-cream-dim text-sm font-mono">No games played yet</p>
              <p className="text-cream-dim/40 text-xs font-mono">Advance a day or simulate to see results here</p>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {recent.map(g => {
                const isHome = g.homeId === userTeamId;
                const opp = isHome ? g.awayId : g.homeId;
                const oppTeam = engine.getTeam(opp);
                const won = isHome ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0);
                return (
                  <div key={g.id} className="flex justify-between items-center py-1 border-b border-navy-lighter/30">
                    <span className={cn(won ? 'text-green-light' : 'text-red', 'font-bold w-4')}>{won ? 'W' : 'L'}</span>
                    <span className="text-cream">{isHome ? 'vs' : '@'} {oppTeam?.abbreviation ?? opp}</span>
                    <span className="text-cream-dim">{g.awayScore}-{g.homeScore}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Upcoming">
          {upcoming.length === 0 ? (
            <p className="text-cream-dim text-sm font-mono">
              {isRegularSeason ? 'No upcoming games' : 'Regular season complete'}
            </p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {upcoming.map((g, idx) => {
                const isHome = g.homeId === userTeamId;
                const opp = isHome ? g.awayId : g.homeId;
                const oppTeam = engine.getTeam(opp);
                const isNext = idx === 0;
                return (
                  <div key={g.id} className="flex justify-between items-center py-1 border-b border-navy-lighter/30">
                    <span className="text-cream-dim">Day {g.date}</span>
                    <span className="text-cream">{isHome ? 'vs' : '@'} {oppTeam?.abbreviation ?? opp}</span>
                    {isNext && isRegularSeason ? (
                      <button
                        onClick={handleAdvance}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-green-light/10 text-green-light border border-green-light/20 hover:bg-green-light/20 transition-colors cursor-pointer"
                      >
                        ▶ Play
                      </button>
                    ) : (
                      <span className="w-14" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
