import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { winPct, gamesBehind, streakStr, last10Str, runDifferential } from '@/engine/season/index.ts';
import type { TeamRecord } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

export function FranchiseDashboard() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, isInitialized, advanceDay, simDays, startPlayoffs } = useFranchiseStore();

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

  const handleAdvance = () => {
    const userGame = advanceDay();
    if (userGame) {
      navigate(`/game/live?gameId=${userGame.id}`);
    }
  };

  const handleSimWeek = () => simDays(7);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            {userTeam?.city} {userTeam?.name}
          </h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Day {season.currentDay} of {season.totalDays} — {season.year} Season
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
        <div className="flex flex-wrap gap-2 justify-end">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/standings')}>
            Standings
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/roster')}>
            Roster
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/leaders')}>
            Leaders
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/franchise/team-stats/${userTeamId}`)}>
            Team Stats
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/records')}>
            Records
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/trade')}>
            Trades
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/free-agency')}>
            FA
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/roster-manager')}>
            Roster Mgr
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/franchise/team/${userTeamId}`)}>
            Edit Team
          </Button>
          {(isPostseason || regularSeasonComplete) && (
            <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/playoffs')}>
              Playoffs
            </Button>
          )}
          {isOffseason && (
            <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/offseason')}>
              Offseason
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate('/')}>
            Menu
          </Button>
        </div>
      </div>

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
                <Button className="w-full" variant="secondary" onClick={() => simDays(30)}>
                  Sim 30 Days
                </Button>
                {season.currentDay >= season.totalDays - 7 && (
                  <Button className="w-full" variant="secondary" onClick={() => simDays(183)}>
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

      {/* Recent & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Panel title="Recent Results">
          {recent.length === 0 ? (
            <p className="text-cream-dim text-sm font-mono">No games played yet</p>
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
              {upcoming.map(g => {
                const isHome = g.homeId === userTeamId;
                const opp = isHome ? g.awayId : g.homeId;
                const oppTeam = engine.getTeam(opp);
                return (
                  <div key={g.id} className="flex justify-between items-center py-1 border-b border-navy-lighter/30">
                    <span className="text-cream-dim">Day {g.date}</span>
                    <span className="text-cream">{isHome ? 'vs' : '@'} {oppTeam?.abbreviation ?? opp}</span>
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
