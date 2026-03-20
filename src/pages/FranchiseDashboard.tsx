import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useInboxStore } from '@/stores/inboxStore.ts';
import type { InboxItemType } from '@/stores/inboxStore.ts';
import { winPct, gamesBehind, streakStr, last10Str, runDifferential } from '@/engine/season/index.ts';
import type { TeamRecord } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

// Season milestones that generate inbox notifications
const INBOX_MILESTONES: Array<{
  day: number; title: string; body: string; urgent?: boolean; linkedUrl?: string;
}> = [
  { day: 30,  title: 'April In The Books', body: '30 games played. Review standings and assess your roster needs early.', linkedUrl: '/franchise/standings' },
  { day: 60,  title: 'Two Months Down', body: 'Season is one-third complete. Check league leaders and identify trade targets.', linkedUrl: '/franchise/leaders' },
  { day: 90,  title: 'All-Star Break', body: 'First half complete. The All-Star Game is here — review your roster before the second half.', linkedUrl: '/franchise/all-star' },
  { day: 115, title: 'Trade Deadline In 5 Days', body: 'The trade deadline is approaching. Decide if you\'re buying or selling for the stretch run.', urgent: true, linkedUrl: '/franchise/trade-proposals' },
  { day: 120, title: 'Trade Deadline Today', body: 'Last chance to make trades this season. All deals must be completed today.', urgent: true, linkedUrl: '/franchise/trade-proposals' },
  { day: 150, title: 'Final Month', body: 'Only 33 games remain. Watch the standings — every game counts now.', linkedUrl: '/franchise/standings' },
  { day: 175, title: 'Final Stretch — 8 Days Left', body: 'The regular season ends soon. Make sure your roster is set for the push.', linkedUrl: '/franchise/standings' },
  { day: 183, title: 'Regular Season Complete', body: 'The regular season is over! Check the standings to see your playoff status.', urgent: true, linkedUrl: '/franchise/standings' },
];

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
  const { season, engine, userTeamId, isInitialized, advanceDay, simDays, startPlayoffs, lastDayEvents, ilRoster, getTeamInjuries, tradeProposals } = useFranchiseStore();
  const { addItems, addItem, hasSeenProposal, markProposalSeen, getUnreadCount } = useInboxStore();
  const playerStats = useStatsStore(s => s.playerStats);
  const [showEvents, setShowEvents] = useState(true);
  const [recapTab, setRecapTab] = useState<'summary' | 'scores' | 'performers'>('summary');
  const [simConfirm, setSimConfirm] = useState<number | null>(null);
  const [simFromDay, setSimFromDay] = useState<number | null>(null);
  const [simFromRecord, setSimFromRecord] = useState<{ wins: number; losses: number } | null>(null); // days pending confirm

  // Track which lastDayEvents we've already processed to avoid duplicates
  const prevEventsRef = useRef<typeof lastDayEvents>(null);
  const prevDayRef = useRef<number>(-1);

  useEffect(() => {
    if (!isInitialized) navigate('/franchise/new');
  }, [isInitialized, navigate]);

  // Generate inbox items from day events whenever they change
  useEffect(() => {
    if (!lastDayEvents || !season || !userTeamId) return;
    if (lastDayEvents === prevEventsRef.current) return;
    prevEventsRef.current = lastDayEvents;

    const items: Parameters<typeof addItems>[0] = [];

    // User team injuries
    for (const event of lastDayEvents.injuries) {
      if (event.record.teamId !== userTeamId) continue;
      const isSevere = event.record.severity === 'severe' || event.record.severity === 'season-ending';
      items.push({
        type: 'injury' as InboxItemType,
        title: `${event.record.playerName} Injured`,
        body: `${event.record.description} — out ${event.record.daysOut} day${event.record.daysOut !== 1 ? 's' : ''} (${event.record.severity})`,
        day: season.currentDay,
        urgent: isSevere,
        linkedUrl: '/franchise/injuries',
      });
    }

    // Player returns from injury for user team
    for (const event of lastDayEvents.returns) {
      if (event.record.teamId !== userTeamId) continue;
      items.push({
        type: 'return' as InboxItemType,
        title: `${event.record.playerName} Returns`,
        body: `${event.record.playerName} has recovered from ${event.record.description} and is available for the lineup.`,
        day: season.currentDay,
        urgent: false,
        linkedUrl: '/franchise/roster',
      });
    }

    // Waiver claims/clears (notable)
    for (const waiver of lastDayEvents.waivers) {
      if (waiver.type !== 'claim') continue;
      items.push({
        type: 'waiver' as InboxItemType,
        title: 'Waiver Wire Activity',
        body: waiver.message,
        day: season.currentDay,
        urgent: false,
        linkedUrl: '/franchise/waivers',
      });
    }

    // Minor league callups for user team
    for (const callup of lastDayEvents.callups) {
      if (callup.teamId !== userTeamId) continue;
      const name = `${callup.player.firstName} ${callup.player.lastName}`;
      items.push({
        type: 'callup' as InboxItemType,
        title: `Callup: ${name}`,
        body: `${name} has been called up from the minor leagues. Check the roster.`,
        day: season.currentDay,
        urgent: false,
        linkedUrl: '/franchise/roster',
      });
    }

    if (items.length > 0) addItems(items);
  }, [lastDayEvents, season, userTeamId, addItems]);

  // Season milestone notifications (fire once per day)
  useEffect(() => {
    if (!season || !userTeamId) return;
    if (season.currentDay === prevDayRef.current) return;
    prevDayRef.current = season.currentDay;

    const milestone = INBOX_MILESTONES.find(m => m.day === season.currentDay);
    if (milestone) {
      addItem({
        type: 'milestone' as InboxItemType,
        title: milestone.title,
        body: milestone.body,
        day: season.currentDay,
        urgent: milestone.urgent ?? false,
        linkedUrl: milestone.linkedUrl,
      });
    }
  }, [season?.currentDay, userTeamId, addItem]);

  // New trade proposals notification
  useEffect(() => {
    if (!tradeProposals || !season) return;
    for (const proposal of tradeProposals) {
      if (proposal.status !== 'pending') continue;
      if (hasSeenProposal(proposal.id)) continue;
      markProposalSeen(proposal.id);
      addItem({
        type: 'trade_offer' as InboxItemType,
        title: `Trade Offer from ${proposal.aiTeamName}`,
        body: `The ${proposal.aiTeamName} have sent you a trade proposal. Review it and respond before the deadline.`,
        day: proposal.day,
        urgent: true,
        linkedUrl: '/franchise/trade-proposals',
      });
    }
  }, [tradeProposals, season, hasSeenProposal, markProposalSeen, addItem]);

  const inboxUnread = getUnreadCount();

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-center">
          <h2 className="font-display text-2xl text-gold tracking-wide uppercase mb-2">No Franchise Loaded</h2>
          <p className="font-mono text-cream-dim text-sm">Start a new franchise to begin managing your team.</p>
        </div>
        <Button onClick={() => navigate('/franchise/new')}>Create New Franchise</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>← Main Menu</Button>
      </div>
    );
  }

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
    const prevDay = season.currentDay;
    const rec = season.standings.getRecord(userTeamId);
    setShowEvents(true);
    setRecapTab('summary');
    const userGame = advanceDay();
    if (userGame) {
      navigate(`/game/live?gameId=${userGame.id}`);
    } else {
      setSimFromDay(prevDay);
      setSimFromRecord(rec ? { wins: rec.wins, losses: rec.losses } : null);
    }
  };

  const doSim = (days: number) => {
    const rec = season.standings.getRecord(userTeamId);
    setSimFromDay(season.currentDay);
    setSimFromRecord(rec ? { wins: rec.wins, losses: rec.losses } : null);
    setShowEvents(true);
    setRecapTab('summary');
    simDays(days);
  };

  const handleSimWeek = () => doSim(7);
  const handleSimConfirm = (days: number) => { doSim(days); setSimConfirm(null); };

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

  // Sim recap computed values
  const simGames = simFromDay !== null
    ? season.schedule.filter(g =>
        g.played &&
        g.date > simFromDay && g.date <= season.currentDay &&
        (g.homeId === userTeamId || g.awayId === userTeamId)
      )
    : [];
  const simWins = simGames.filter(g => {
    const isHome = g.homeId === userTeamId;
    return isHome
      ? (g.homeScore ?? 0) > (g.awayScore ?? 0)
      : (g.awayScore ?? 0) > (g.homeScore ?? 0);
  }).length;
  const simLosses = simGames.length - simWins;

  // All league games in the simmed period (for "All Scores" tab)
  const leagueGames = useMemo(() => simFromDay !== null
    ? season.schedule.filter(g => g.played && g.date > simFromDay && g.date <= season.currentDay)
        .sort((a, b) => a.date - b.date)
    : [],
  [season.schedule, simFromDay, season.currentDay]);

  // Top performers from the simmed period
  const topPerformers = useMemo(() => {
    if (leagueGames.length === 0) return { batters: [], pitchers: [] };
    const gameIds = new Set(leagueGames.map(g => g.id));
    const battingPerfs: { name: string; abbr: string; hr: number; rbi: number; h: number; ab: number }[] = [];
    const pitchingPerfs: { name: string; abbr: string; ip: string; er: number; k: number; decision: string }[] = [];
    for (const ps of Object.values(playerStats)) {
      const teamAbbr = engine?.getTeam(ps.teamId)?.abbreviation ?? '???';
      for (const log of ps.gameLog) {
        if (!gameIds.has(log.gameId)) continue;
        if (log.ip) {
          if (log.kPitching >= 7 || (parseFloat(log.ip) >= 6 && log.er <= 2)) {
            pitchingPerfs.push({ name: ps.playerName.split(' ').pop()!, abbr: teamAbbr, ip: log.ip, er: log.er, k: log.kPitching, decision: log.decision ?? '' });
          }
        } else if (log.hr > 0 || log.rbi >= 3 || log.h >= 3) {
          battingPerfs.push({ name: ps.playerName.split(' ').pop()!, abbr: teamAbbr, hr: log.hr, rbi: log.rbi, h: log.h, ab: log.ab });
        }
      }
    }
    battingPerfs.sort((a, b) => (b.hr * 3 + b.rbi * 1.5 + b.h) - (a.hr * 3 + a.rbi * 1.5 + a.h));
    pitchingPerfs.sort((a, b) => b.k - a.k);
    return { batters: battingPerfs.slice(0, 6), pitchers: pitchingPerfs.slice(0, 4) };
  }, [leagueGames, playerStats, engine]);
  const divRank = userDiv ? userDiv.teams.findIndex(t => t.teamId === userTeamId) + 1 : 0;
  const divLeader = userDiv?.teams[0];
  const gamesBack = divRank > 1 && divLeader && userRecord
    ? ((divLeader.wins - divLeader.losses) - (userRecord.wins - userRecord.losses)) / 2
    : 0;
  const ordinal = (n: number) => {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    return `${n}${(['', 'st', 'nd', 'rd'] as const)[n % 10] ?? 'th'}`;
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
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
        {/* Inbox button with unread badge */}
        <button
          onClick={() => navigate('/franchise/inbox')}
          className={cn(
            'relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer shrink-0',
            inboxUnread > 0
              ? 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20'
              : 'border-navy-lighter text-cream-dim hover:border-navy-lighter/80 hover:text-cream',
          )}
        >
          <span className="text-base">📬</span>
          <span className="font-mono text-xs">Inbox</span>
          {/* Badge overlaid absolutely so it doesn't shift button width */}
          {inboxUnread > 0 && (
            <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red text-white text-[9px] font-bold rounded-full leading-none">
              {inboxUnread > 99 ? '99' : inboxUnread}
            </span>
          )}
        </button>
      </div>

      {/* Upcoming Milestone Banner */}
      {isRegularSeason && (() => {
        const cd = season.currentDay;
        const td = season.totalDays;
        const milestoneList = [
          { day: 90,  label: 'All-Star Break',   url: '/franchise/all-star',       icon: '⭐', urgent: false },
          { day: 120, label: 'Trade Deadline',    url: '/franchise/trade',           icon: '⏰', urgent: true  },
          { day: td,  label: 'End of Season',     url: '/franchise/standings',       icon: '🏆', urgent: false },
        ];
        const next = milestoneList.find(m => m.day > cd);
        if (!next) return null;
        const daysLeft = next.day - cd;
        if (daysLeft > 10) return null; // only show when close
        return (
          <div
            className={cn(
              'mb-4 px-4 py-2.5 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-colors',
              next.urgent
                ? 'border-red-500/40 bg-red-950/20 hover:border-red-500/60'
                : 'border-gold/30 bg-gold/5 hover:border-gold/50',
            )}
            onClick={() => navigate(next.url)}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{next.icon}</span>
              <span className={cn('font-mono text-xs font-bold', next.urgent ? 'text-red-400' : 'text-gold')}>
                {next.label}
              </span>
              <span className="font-mono text-xs text-cream-dim">
                — {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
              </span>
            </div>
            <span className={cn('font-mono text-xs shrink-0', next.urgent ? 'text-red-400/60' : 'text-gold/60')}>
              View →
            </span>
          </div>
        );
      })()}

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
                <Button className="w-full" variant="secondary" onClick={() => doSim(30)}>
                  Sim 30 Days
                </Button>
                {/* Sim-to-milestone shortcuts */}
                {season.currentDay < 90 && (
                  <Button className="w-full" variant="ghost" size="sm" onClick={() => doSim(90 - season.currentDay)}>
                    → Sim to All-Star Break (Day 90)
                  </Button>
                )}
                {season.currentDay >= 90 && season.currentDay < 120 && (
                  <Button className="w-full" variant="ghost" size="sm" onClick={() => doSim(120 - season.currentDay)}>
                    → Sim to Trade Deadline (Day 120)
                  </Button>
                )}
                {season.currentDay >= 120 && season.currentDay < season.totalDays - 5 && (
                  <Button className="w-full" variant="ghost" size="sm" onClick={() => doSim(season.totalDays - season.currentDay)}>
                    → Sim to End of Season
                  </Button>
                )}
                {season.currentDay >= season.totalDays - 5 && (
                  <Button className="w-full" variant="secondary" onClick={() => doSim(183)}>
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

      {/* Sim Recap */}
      {showEvents && lastDayEvents && simFromDay !== null && (
        <div className="mt-4 rounded-lg border border-navy-lighter bg-navy-light/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy-lighter/50 bg-navy-light/60">
            <div className="flex items-center gap-3">
              <span className="font-display text-sm text-gold uppercase tracking-wider">
                {season.currentDay - simFromDay === 1 ? `Day ${season.currentDay} Recap` : 'Sim Recap'}
              </span>
              {season.currentDay - simFromDay > 1 && (
                <span className="font-mono text-xs text-cream-dim">
                  Day {simFromDay + 1}–{season.currentDay} · {season.currentDay - simFromDay} days
                </span>
              )}
            </div>
            <button
              onClick={() => { setShowEvents(false); setSimFromDay(null); setSimFromRecord(null); }}
              className="font-mono text-xs text-cream-dim/60 hover:text-cream border border-cream-dim/20 hover:border-cream-dim/50 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              ✕ Dismiss
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-navy-lighter/40 bg-navy-light/30">
            {([
              ['summary', 'Summary'],
              ['scores', `Scores (${leagueGames.length})`],
              ...(topPerformers.batters.length > 0 || topPerformers.pitchers.length > 0
                ? [['performers', 'Top Performers'] as const]
                : []),
            ] as [string, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setRecapTab(tab as typeof recapTab)}
                className={cn(
                  'px-4 py-2 font-mono text-xs transition-all border-b-2',
                  recapTab === tab
                    ? 'border-gold text-gold'
                    : 'border-transparent text-cream-dim/50 hover:text-cream-dim',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {recapTab === 'summary' && <>
          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 divide-x divide-navy-lighter/50 border-b border-navy-lighter/50">
            <div className="px-4 py-3 text-center">
              <p className="font-mono text-[10px] text-cream-dim/60 uppercase tracking-wider mb-1">This Period</p>
              <p className={cn(
                'font-mono text-2xl font-bold',
                simWins > simLosses ? 'text-green-light' : simWins < simLosses ? 'text-red' : 'text-cream',
              )}>
                {simWins}-{simLosses}
              </p>
              <p className="font-mono text-[10px] text-cream-dim/40">
                {simGames.length} game{simGames.length !== 1 ? 's' : ''}
                {simFromRecord && userRecord && (simFromRecord.wins > 0 || simFromRecord.losses > 0) && (
                  <span className="ml-1 text-cream-dim/40">
                    ({simFromRecord.wins}-{simFromRecord.losses} before)
                  </span>
                )}
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="font-mono text-[10px] text-cream-dim/60 uppercase tracking-wider mb-1">Season Record</p>
              <p className="font-mono text-2xl font-bold text-cream">
                {userRecord?.wins ?? 0}-{userRecord?.losses ?? 0}
              </p>
              <p className="font-mono text-[10px] text-cream-dim/40">
                {userRecord ? winPct(userRecord) : '.000'}
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="font-mono text-[10px] text-cream-dim/60 uppercase tracking-wider mb-1">Division</p>
              <p className={cn(
                'font-mono text-2xl font-bold',
                divRank === 1 ? 'text-gold' : 'text-cream',
              )}>
                {divRank > 0 ? ordinal(divRank) : '—'}
              </p>
              <p className="font-mono text-[10px] text-cream-dim/40">
                {divRank === 1 ? 'Division Leader' : divRank > 0 && gamesBack > 0 ? `${gamesBack.toFixed(1)} GB` : divRank > 1 ? 'Tied' : '—'}
              </p>
            </div>
          </div>

          {/* Recent Game Results */}
          {simGames.length > 0 && (
            <div className="px-4 py-3 border-b border-navy-lighter/50">
              <p className="font-mono text-[10px] text-cream-dim/60 uppercase tracking-wider mb-2">Results</p>
              <div className="flex flex-wrap gap-1.5">
                {simGames.slice(-8).map(g => {
                  const isHome = g.homeId === userTeamId;
                  const opp = isHome ? g.awayId : g.homeId;
                  const oppTeam = engine.getTeam(opp);
                  const won = isHome
                    ? (g.homeScore ?? 0) > (g.awayScore ?? 0)
                    : (g.awayScore ?? 0) > (g.homeScore ?? 0);
                  const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
                  const theirScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
                  return (
                    <div key={g.id} className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs border',
                      won
                        ? 'bg-green-900/20 border-green-light/20 text-green-light'
                        : 'bg-red-950/20 border-red/20 text-red-400',
                    )}>
                      <span className="font-bold">{won ? 'W' : 'L'}</span>
                      <span className="text-[10px] opacity-60">{isHome ? 'vs' : '@'}</span>
                      <span>{oppTeam?.abbreviation ?? opp.slice(0, 3)}</span>
                      <span className="text-[10px] opacity-60">{myScore}-{theirScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Events */}
          {(lastDayEvents.injuries.length + lastDayEvents.returns.length + lastDayEvents.callups.length + lastDayEvents.aiTrades.length) > 0 && (() => {
            const myInjuries = lastDayEvents.injuries.filter(e => e.record.teamId === userTeamId);
            const otherInjuries = lastDayEvents.injuries.filter(e => e.record.teamId !== userTeamId);
            const myReturns = lastDayEvents.returns.filter(e => e.record.teamId === userTeamId);
            const myCallups = lastDayEvents.callups.filter(e => e.teamId === userTeamId);
            return (
              <div className="px-4 py-3">
                <p className="font-mono text-[10px] text-cream-dim/60 uppercase tracking-wider mb-2 flex items-center gap-2">
                  Events
                  {myInjuries.length > 0 && (
                    <span className="text-red-400">· {myInjuries.length} injury{myInjuries.length !== 1 ? 'ies' : 'y'}</span>
                  )}
                  {lastDayEvents.aiTrades.length > 0 && (
                    <span className="text-blue-400">· {lastDayEvents.aiTrades.length} trade{lastDayEvents.aiTrades.length !== 1 ? 's' : ''}</span>
                  )}
                  {lastDayEvents.callups.length > 0 && (
                    <span className="text-gold">· {lastDayEvents.callups.length} roster move{lastDayEvents.callups.length !== 1 ? 's' : ''}</span>
                  )}
                </p>
                <div className="space-y-1.5">
                  {/* User team injuries */}
                  {myInjuries.map((e, i) => (
                    <div key={`my-inj-${i}`} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-red-400 shrink-0 w-4">🩹</span>
                      <span className="text-red-400 font-bold">{e.record.playerName}</span>
                      <span className="text-cream-dim">{e.record.description}</span>
                      <span className="text-red-400/60">({e.record.daysOut}d)</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-red/10 text-red-400 border border-red/20 shrink-0">YOUR TEAM</span>
                    </div>
                  ))}
                  {/* User team returns */}
                  {myReturns.map((e, i) => (
                    <div key={`my-ret-${i}`} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-green-light shrink-0 w-4">✓</span>
                      <span className="text-green-light font-bold">{e.record.playerName}</span>
                      <span className="text-cream-dim">returned from IL</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-green-900/10 text-green-light border border-green-light/20 shrink-0">ACTIVE</span>
                    </div>
                  ))}
                  {/* User team callups/optioned */}
                  {myCallups.map((e, i) => (
                    <div key={`my-cup-${i}`} className="flex items-center gap-2 text-xs font-mono">
                      <span className={cn('shrink-0 w-4', e.type === 'callup' ? 'text-gold' : 'text-cream-dim')}>
                        {e.type === 'callup' ? '↑' : '↓'}
                      </span>
                      <span className={e.type === 'callup' ? 'text-gold' : 'text-cream-dim'}>{e.message}</span>
                    </div>
                  ))}
                  {/* AI trades */}
                  {lastDayEvents.aiTrades.slice(0, 4).map((e, i) => (
                    <div key={`trd-${i}`} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-blue-400 shrink-0 w-4">⇄</span>
                      <span className="text-cream-dim">{e.description ?? 'AI teams completed a trade'}</span>
                    </div>
                  ))}
                  {lastDayEvents.aiTrades.length > 4 && (
                    <p className="text-cream-dim/30 text-xs font-mono pl-6">+{lastDayEvents.aiTrades.length - 4} more trades</p>
                  )}
                  {/* Other league injuries (dimmed) */}
                  {otherInjuries.slice(0, 2).map((e, i) => (
                    <div key={`oth-inj-${i}`} className="flex items-center gap-2 text-xs font-mono opacity-40">
                      <span className="text-red-400 shrink-0 w-4">🩹</span>
                      <span className="text-cream-dim">{e.record.playerName}</span>
                      <span className="text-cream-dim/60">({engine.getTeam(e.record.teamId)?.abbreviation ?? '?'})</span>
                      <span className="text-cream-dim/40">{e.record.description}, {e.record.daysOut}d</span>
                    </div>
                  ))}
                  {otherInjuries.length > 2 && (
                    <p className="text-cream-dim/30 text-xs font-mono pl-6">+{otherInjuries.length - 2} more league injuries</p>
                  )}
                </div>
              </div>
            );
          })()}
          </>}

          {/* Scores Tab — all league games in the period */}
          {recapTab === 'scores' && (
            <div className="px-4 py-3">
              {leagueGames.length === 0 ? (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-4">No games in this period</p>
              ) : (() => {
                // Group by date
                const byDate = new Map<number, typeof leagueGames>();
                for (const g of leagueGames) {
                  if (!byDate.has(g.date)) byDate.set(g.date, []);
                  byDate.get(g.date)!.push(g);
                }
                return Array.from(byDate.entries()).reverse().map(([day, games]) => (
                  <div key={day} className="mb-4">
                    <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-widest mb-2">Day {day}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {games.map(g => {
                        const isUser = g.homeId === userTeamId || g.awayId === userTeamId;
                        const awayAbbr = engine.getTeam(g.awayId)?.abbreviation ?? g.awayId.slice(0, 3);
                        const homeAbbr = engine.getTeam(g.homeId)?.abbreviation ?? g.homeId.slice(0, 3);
                        const awayWon = (g.awayScore ?? 0) > (g.homeScore ?? 0);
                        return (
                          <div key={g.id} className={cn(
                            'flex items-center gap-2 px-2 py-1 rounded text-xs font-mono border',
                            isUser ? 'border-gold/30 bg-gold/5' : 'border-navy-lighter/30 bg-navy-lighter/10',
                          )}>
                            <span className={cn('w-8 text-right font-bold', awayWon ? 'text-cream' : 'text-cream-dim/50')}>{awayAbbr}</span>
                            <span className={cn('text-base font-bold w-5 text-center', awayWon ? 'text-cream' : 'text-cream-dim/40')}>{g.awayScore}</span>
                            <span className="text-cream-dim/30 text-[10px]">–</span>
                            <span className={cn('text-base font-bold w-5 text-center', !awayWon ? 'text-cream' : 'text-cream-dim/40')}>{g.homeScore}</span>
                            <span className={cn('w-8 font-bold', !awayWon ? 'text-cream' : 'text-cream-dim/50')}>{homeAbbr}</span>
                            {isUser && <span className="ml-auto text-[9px] text-gold">◀ YOU</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Top Performers Tab */}
          {recapTab === 'performers' && (
            <div className="px-4 py-3 space-y-4">
              {topPerformers.batters.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] text-gold/70 uppercase tracking-widest mb-2">Batting</p>
                  <div className="space-y-1">
                    {topPerformers.batters.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-cream-dim/40 w-4 text-right">{i + 1}</span>
                        <span className="text-cream font-bold w-20 truncate">{p.name}</span>
                        <span className="text-cream-dim/50 w-8">{p.abbr}</span>
                        <div className="flex gap-2 ml-auto">
                          {p.hr > 0 && <span className="text-gold font-bold">{p.hr}HR</span>}
                          {p.rbi > 0 && <span className="text-cream">{p.rbi}RBI</span>}
                          <span className="text-cream-dim/60">{p.h}/{p.ab}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {topPerformers.pitchers.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] text-blue-400/70 uppercase tracking-widest mb-2">Pitching</p>
                  <div className="space-y-1">
                    {topPerformers.pitchers.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-cream-dim/40 w-4 text-right">{i + 1}</span>
                        <span className="text-cream font-bold w-20 truncate">{p.name}</span>
                        <span className="text-cream-dim/50 w-8">{p.abbr}</span>
                        <div className="flex gap-2 ml-auto">
                          {p.decision === 'W' && <span className="text-green-light font-bold">W</span>}
                          {p.decision === 'S' && <span className="text-gold font-bold">SV</span>}
                          <span className="text-cream">{p.ip}IP</span>
                          <span className="text-cream">{p.k}K</span>
                          <span className="text-cream-dim/60">{p.er}ER</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {topPerformers.batters.length === 0 && topPerformers.pitchers.length === 0 && (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-4">No standout performances found</p>
              )}
            </div>
          )}
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
