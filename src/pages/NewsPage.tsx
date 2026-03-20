import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import {
  calcBattingAdvanced, calcPitchingAdvanced, deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT,
} from '@/engine/stats/AdvancedStats.ts';
import { winPct, gamesBehind, streakStr } from '@/engine/season/index.ts';
import type { SeasonEngine } from '@/engine/season/index.ts';
import type { SeasonState } from '@/engine/season/index.ts';
import type { TeamRecord } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtAvg(n: number): string {
  return n.toFixed(3).replace(/^0/, '');
}

function teamName(engine: SeasonEngine, id: string): string {
  const t = engine.getTeam(id);
  return t ? `${t.city} ${t.name}` : id;
}

function teamAbbr(engine: SeasonEngine, id: string): string {
  return engine.getTeam(id)?.abbreviation ?? id.slice(0, 3).toUpperCase();
}

// ── News Item types ───────────────────────────────────────────────────────────

type NewsCategory = 'game' | 'transaction' | 'injury' | 'standings' | 'stats' | 'milestone';

interface NewsItem {
  id: string;
  category: NewsCategory;
  day: number;
  headline: string;
  body?: string;
  teamId?: string;
  playerId?: string;
  isUserTeam?: boolean;
}

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  game: 'Game Results',
  transaction: 'Transactions',
  injury: 'Injury Wire',
  standings: 'Standings',
  stats: 'Stats Leaders',
  milestone: 'Milestones',
};

const CATEGORY_COLORS: Record<NewsCategory, string> = {
  game: 'text-cream-dim',
  transaction: 'text-blue-400',
  injury: 'text-red-400',
  standings: 'text-green-light',
  stats: 'text-gold',
  milestone: 'text-purple-400',
};

const CATEGORY_BG: Record<NewsCategory, string> = {
  game: 'bg-cream-dim/10 border-cream-dim/20',
  transaction: 'bg-blue-400/10 border-blue-400/20',
  injury: 'bg-red-400/10 border-red-400/20',
  standings: 'bg-green-light/10 border-green-light/20',
  stats: 'bg-gold/10 border-gold/20',
  milestone: 'bg-purple-400/10 border-purple-400/20',
};

// ── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: NewsCategory }) {
  return (
    <span className={cn(
      'inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0',
      CATEGORY_BG[category],
      CATEGORY_COLORS[category],
    )}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ── Single news card ──────────────────────────────────────────────────────────

function NewsCard({ item, onClick }: { item: NewsItem; onClick?: () => void }) {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border px-4 py-3 transition-colors',
        item.isUserTeam
          ? 'border-gold/30 bg-gold/5'
          : 'border-navy-lighter/40 bg-navy-light/20',
        isClickable && 'cursor-pointer hover:border-gold/40 hover:bg-navy-lighter/10',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <CategoryBadge category={item.category} />
            <span className="font-mono text-[10px] text-cream-dim/40">Day {item.day}</span>
            {item.isUserTeam && (
              <span className="font-mono text-[10px] text-gold/60 font-bold">★ YOUR TEAM</span>
            )}
            {isClickable && (
              <span className="font-mono text-[10px] text-cream-dim/30 ml-auto">→</span>
            )}
          </div>
          <p className={cn(
            'font-body text-sm leading-snug',
            item.isUserTeam ? 'text-cream' : 'text-cream/80',
          )}>
            {item.headline}
          </p>
          {item.body && (
            <p className="font-mono text-xs text-cream-dim/60 mt-1 leading-relaxed">{item.body}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stats Leaders strip ───────────────────────────────────────────────────────

function StatsLeadersStrip({
  engine,
}: {
  engine: SeasonEngine;
}) {
  const { getBattingLeaders, getPitchingLeaders, leagueTotals } = useStatsStore();

  const leagueCtx = useMemo(() => {
    const lt = leagueTotals;
    if (lt.gamesPlayed === 0) return DEFAULT_LEAGUE_CONTEXT;
    return deriveLeagueContext(
      lt.totalAB, lt.totalPA, lt.totalH, lt.totalDoubles, lt.totalTriples,
      lt.totalHR, lt.totalBB, lt.totalHBP, lt.totalSF, lt.totalSO,
      lt.totalRuns, lt.gamesPlayed, lt.totalER, lt.totalIP,
      (lt as typeof lt & { totalGameRuns?: number }).totalGameRuns,
    );
  }, [leagueTotals]);

  const batLeaders = useMemo(() => getBattingLeaders(3).map(ps => ({
    name: ps.playerName.split(' ').pop() ?? ps.playerName,
    team: teamAbbr(engine, ps.teamId),
    adv: calcBattingAdvanced(ps.batting, leagueCtx, ps.position),
    hr: ps.batting.hr,
    avg: ps.batting.ab > 0 ? ps.batting.h / ps.batting.ab : 0,
  })), [getBattingLeaders, engine, leagueCtx]);

  const pitLeaders = useMemo(() => getPitchingLeaders(3).map(ps => ({
    name: ps.playerName.split(' ').pop() ?? ps.playerName,
    team: teamAbbr(engine, ps.teamId),
    adv: calcPitchingAdvanced(ps.pitching, leagueCtx),
  })), [getPitchingLeaders, engine, leagueCtx]);

  if (batLeaders.length === 0) return null;

  const avgLeader = [...batLeaders].sort((a, b) => b.avg - a.avg)[0];
  const hrLeader = [...batLeaders].sort((a, b) => b.hr - a.hr)[0];
  const eraLeader = [...pitLeaders].sort((a, b) => a.adv.era - b.adv.era)[0];
  const warLeader = [...batLeaders].sort((a, b) => b.adv.war - a.adv.war)[0];

  const leaders: { label: string; value: string; player: string | undefined; team: string | undefined }[] = [
    { label: 'AVG', value: fmtAvg(avgLeader?.avg ?? 0), player: avgLeader?.name, team: avgLeader?.team },
    { label: 'HR', value: String(hrLeader?.hr ?? 0), player: hrLeader?.name, team: hrLeader?.team },
    { label: 'ERA', value: eraLeader?.adv.era.toFixed(2) ?? '—', player: eraLeader?.name, team: eraLeader?.team },
    { label: 'WAR', value: warLeader?.adv.war.toFixed(1) ?? '—', player: warLeader?.name, team: warLeader?.team },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {leaders.map(({ label, value, player, team }) => (
        <div key={label} className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-center">
          <div className="font-mono text-[10px] text-gold/60 uppercase tracking-wider">{label} Leader</div>
          <div className="font-display text-xl text-gold font-bold mt-0.5">{value}</div>
          <div className="font-mono text-xs text-cream-dim mt-0.5 truncate">{player} <span className="text-cream-dim/40">({team})</span></div>
        </div>
      ))}
    </div>
  );
}

// ── Standings Snapshot ────────────────────────────────────────────────────────

function StandingsSnapshot({
  engine,
  season,
  userTeamId,
}: {
  engine: SeasonEngine;
  season: SeasonState;
  userTeamId: string;
}) {
  const divisions = season.standings.getDivisionStandings();

  // One leader per division
  const leaders = divisions.map(d => ({
    div: `${d.league} ${d.division}`,
    leader: d.teams[0] as TeamRecord | undefined,
    second: d.teams[1] as TeamRecord | undefined,
  })).filter(x => x.leader);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {leaders.map(({ div, leader, second }) => {
        if (!leader) return null;
        const isUser = leader.teamId === userTeamId;
        const gb = second ? gamesBehind(leader, second) : '—';
        return (
          <div key={div} className={cn(
            'rounded-lg border px-3 py-2',
            isUser ? 'border-gold/30 bg-gold/5' : 'border-navy-lighter/40 bg-navy-light/20',
          )}>
            <div className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider mb-1">{div}</div>
            <div className="flex items-baseline gap-2">
              <span className={cn('font-mono text-sm font-bold', isUser ? 'text-gold' : 'text-cream')}>
                {teamAbbr(engine, leader.teamId)}
              </span>
              <span className="font-mono text-xs text-cream-dim">{leader.wins}-{leader.losses}</span>
              <span className={cn(
                'font-mono text-[10px]',
                leader.streak > 0 ? 'text-green-light' : 'text-red-400',
              )}>
                {streakStr(leader)}
              </span>
            </div>
            {second && (
              <div className="font-mono text-[10px] text-cream-dim/40 mt-0.5">
                {teamAbbr(engine, second.teamId)} {gb} GB
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function newsItemNav(item: NewsItem): string | null {
  if (item.playerId) return `/franchise/player-stats/${item.playerId}`;
  if (item.teamId) return `/franchise/team-stats/${item.teamId}`;
  if (item.category === 'standings') return '/franchise/standings';
  if (item.category === 'stats') return '/franchise/leaders';
  if (item.category === 'game') return '/franchise/game-log';
  return null;
}

export function NewsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, lastDayEvents, injuryLog, tradeLog, callupLog } = useFranchiseStore();
  const { playerStats } = useStatsStore();
  const [categoryFilter, setCategoryFilter] = useState<NewsCategory | null>(null);

  const currentDay = season?.currentDay ?? 0;
  const recentDays = 7; // news window

  // ── Generate news items ──────────────────────────────────────────────────

  const newsItems = useMemo((): NewsItem[] => {
    if (!season || !engine || !userTeamId) return [];
    const items: NewsItem[] = [];

    // 1. Today's game results (last recentDays days)
    const recentGames = season.schedule
      .filter(g => g.played && g.date >= currentDay - recentDays && g.date <= currentDay)
      .sort((a, b) => b.date - a.date);

    for (const g of recentGames.slice(0, 12)) {
      const awayTeam = engine.getTeam(g.awayId);
      const homeTeam = engine.getTeam(g.homeId);
      if (!awayTeam || !homeTeam) continue;
      const awayScore = g.awayScore ?? 0;
      const homeScore = g.homeScore ?? 0;
      const isUserGame = g.awayId === userTeamId || g.homeId === userTeamId;
      const userWon = isUserGame && (
        (g.awayId === userTeamId && awayScore > homeScore) ||
        (g.homeId === userTeamId && homeScore > awayScore)
      );

      let headline = '';
      if (isUserGame) {
        const isHome = g.homeId === userTeamId;
        const opp = isHome ? awayTeam : homeTeam;
        const userScore = isHome ? homeScore : awayScore;
        const oppScore = isHome ? awayScore : homeScore;
        headline = userWon
          ? `Your ${engine.getTeam(userTeamId)?.name} WIN ${userScore}–${oppScore} vs ${opp.city} ${opp.name}`
          : `${engine.getTeam(userTeamId)?.name} fall ${userScore}–${oppScore} to ${opp.city} ${opp.name}`;
      } else {
        const winner = awayScore > homeScore ? awayTeam : homeTeam;
        const loser = awayScore > homeScore ? homeTeam : awayTeam;
        const winScore = Math.max(awayScore, homeScore);
        const loseScore = Math.min(awayScore, homeScore);
        if (winScore - loseScore >= 7) {
          headline = `${winner.city} ${winner.name} rout ${loser.city} ${loser.name} ${winScore}–${loseScore}`;
        } else if (winScore - loseScore === 1) {
          headline = `${winner.city} ${winner.name} edge ${loser.city} ${loser.name} in close ${winScore}–${loseScore} contest`;
        } else {
          headline = `${winner.city} ${winner.name} defeat ${loser.city} ${loser.name} ${winScore}–${loseScore}`;
        }
      }

      items.push({
        id: `game-${g.id}`,
        category: 'game',
        day: g.date,
        headline,
        isUserTeam: isUserGame,
      });
    }

    // 2. Injury news (last recentDays days — use lastDayEvents for most recent)
    if (lastDayEvents) {
      for (const e of lastDayEvents.injuries) {
        const isUser = e.record.teamId === userTeamId;
        items.push({
          id: `inj-${e.record.playerId}-${currentDay}`,
          category: 'injury',
          day: currentDay,
          headline: `${e.record.playerName} (${teamAbbr(engine, e.record.teamId)}) placed on injured list — ${e.record.daysOut} days`,
          isUserTeam: isUser,
        });
      }

      for (const e of lastDayEvents.returns) {
        const isUser = e.record.teamId === userTeamId;
        items.push({
          id: `ret-${e.record.playerId}-${currentDay}`,
          category: 'injury',
          day: currentDay,
          headline: `${e.record.playerName} (${teamAbbr(engine, e.record.teamId)}) returns from injured list`,
          isUserTeam: isUser,
        });
      }

      for (const e of lastDayEvents.aiTrades) {
        items.push({
          id: `trade-ai-${currentDay}-${Math.random().toString(36).slice(2, 5)}`,
          category: 'transaction',
          day: currentDay,
          headline: e.description ?? 'AI teams complete a trade',
        });
      }

      for (const e of lastDayEvents.callups) {
        const isUser = e.teamId === userTeamId;
        items.push({
          id: `cup-${e.player.id}-${currentDay}`,
          category: 'transaction',
          day: currentDay,
          headline: `${e.message}`,
          isUserTeam: isUser,
        });
      }
    }

    // 3. Older injury log (last 7 days, not in lastDayEvents)
    const recentInjuries = injuryLog
      .filter(r => r.dayOccurred !== undefined && r.dayOccurred >= currentDay - recentDays && r.dayOccurred < currentDay)
      .slice(-8);

    for (const r of recentInjuries) {
      const isUser = r.teamId === userTeamId;
      if (!items.find(i => i.id === `inj-${r.playerId}-${currentDay}`)) {
        items.push({
          id: `inj-old-${r.playerId}-${r.dayOccurred}`,
          category: 'injury',
          day: r.dayOccurred ?? currentDay,
          headline: `${r.playerName} (${teamAbbr(engine, r.teamId)}) — ${r.severity} injury, ${r.daysOut}d out`,
          isUserTeam: isUser,
        });
      }
    }

    // 4. AI trade log (last 7 days)
    const recentTrades = tradeLog
      .filter(t => (t.day ?? 0) >= currentDay - recentDays && (t.day ?? 0) < currentDay)
      .slice(-6);
    for (const t of recentTrades) {
      if (!lastDayEvents?.aiTrades.some(a => a.description === t.description)) {
        items.push({
          id: `trade-${t.day ?? 0}-${t.description?.slice(0, 10)}`,
          category: 'transaction',
          day: t.day ?? currentDay,
          headline: t.description ?? 'Two teams complete a roster move',
        });
      }
    }

    // 5. Callup log (last 7 days)
    const recentCallups = callupLog
      .filter(c => !lastDayEvents?.callups.some(lc => lc.player.id === c.player.id))
      .slice(-5);
    for (const c of recentCallups) {
      const isUser = c.teamId === userTeamId;
      items.push({
        id: `cup-old-${c.player.id}`,
        category: 'transaction',
        day: currentDay - 1,
        headline: c.message,
        isUserTeam: isUser,
      });
    }

    // 6. Statistical milestones from statsStore
    // Day is estimated by back-calculating from HR pace (~1 HR per 4 games).
    // A player exactly at the threshold shows today; each HR above it pushes
    // the item ~4 days into the past, naturally aging it out of the 7-day window.
    const allStats = Object.values(playerStats);
    for (const ps of allStats) {
      const b = ps.batting;
      if (b.hr >= 30) {
        const daysAgo = Math.floor((b.hr - 30) * 4);
        items.push({
          id: `milestone-hr30-${ps.playerId}`,
          category: 'milestone',
          day: Math.max(1, currentDay - daysAgo),
          headline: `${ps.playerName} (${teamAbbr(engine, ps.teamId)}) reaches 30 home runs on the season`,
          isUserTeam: ps.teamId === userTeamId,
        });
      }
      if (b.hr >= 20 && b.hr < 30) {
        const daysAgo = Math.floor((b.hr - 20) * 4);
        items.push({
          id: `milestone-hr20-${ps.playerId}`,
          category: 'milestone',
          day: Math.max(1, currentDay - daysAgo),
          headline: `${ps.playerName} (${teamAbbr(engine, ps.teamId)}) hits 20th home run`,
          isUserTeam: ps.teamId === userTeamId,
        });
      }
    }

    // 7. Streak alerts
    const divStandings = season.standings.getDivisionStandings();
    for (const div of divStandings) {
      for (const t of div.teams) {
        if (Math.abs(t.streak) >= 5) {
          const isUser = t.teamId === userTeamId;
          const streak = t.streak > 0 ? `${t.streak}-game winning streak` : `${Math.abs(t.streak)}-game losing streak`;
          items.push({
            id: `streak-${t.teamId}`,
            category: 'standings',
            day: currentDay,
            headline: `${teamName(engine, t.teamId)} on ${streak} — now ${t.wins}–${t.losses} (${winPct(t)})`,
            isUserTeam: isUser,
          });
        }
      }
    }

    // Sort: user team news first, then by day descending
    items.sort((a, b) => {
      if (a.isUserTeam && !b.isUserTeam) return -1;
      if (!a.isUserTeam && b.isUserTeam) return 1;
      return b.day - a.day;
    });

    // Deduplicate by id
    const seen = new Set<string>();
    return items.filter(i => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }, [season, engine, userTeamId, currentDay, lastDayEvents, injuryLog, tradeLog, callupLog, playerStats]);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  const userRecord = season.standings.getRecord(userTeamId);

  // Group news by category (apply active filter)
  const filteredItems = categoryFilter ? newsItems.filter(i => i.category === categoryFilter) : newsItems;
  const userItems = filteredItems.filter(i => i.isUserTeam);
  const leagueItems = filteredItems.filter(i => !i.isUserTeam);

  // Count by category for the filter
  const categoryCounts = newsItems.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1;
    return acc;
  }, {} as Record<NewsCategory, number>);

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Masthead */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
              League Bulletin
            </h1>
            <p className="font-mono text-cream-dim text-sm mt-1">
              {season.year} Season · Day {currentDay} of {season.totalDays}
              <span className="ml-2 text-cream-dim/40">
                · {newsItems.length} items in the last {recentDays} days
              </span>
            </p>
          </div>
          {userRecord && (
            <div className="text-right shrink-0">
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider">Your Record</p>
              <p className="font-display text-2xl text-gold">{userRecord.wins}–{userRecord.losses}</p>
              <p className="font-mono text-xs text-cream-dim">{userTeam?.city} {userTeam?.name}</p>
            </div>
          )}
        </div>

        {/* Category filter pills */}
        {Object.entries(categoryCounts).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter(null)}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-cream-dim/30 text-cream-dim hover:text-cream transition-colors cursor-pointer"
              >
                ✕ All
              </button>
            )}
            {(Object.entries(categoryCounts) as [NewsCategory, number][]).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-all cursor-pointer',
                  categoryFilter === cat
                    ? cn(CATEGORY_BG[cat], CATEGORY_COLORS[cat], 'ring-1 ring-current/40')
                    : categoryFilter
                      ? 'border-navy-lighter/30 text-cream-dim/50 hover:text-cream-dim'
                      : cn(CATEGORY_BG[cat], CATEGORY_COLORS[cat]),
                )}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats Leaders Strip */}
      <div className="mb-5">
        <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider mb-2">Statistical Leaders</p>
        <StatsLeadersStrip engine={engine} />
      </div>

      {/* Standings Snapshot */}
      <Panel title="Division Leaders" className="mb-5">
        <StandingsSnapshot engine={engine} season={season} userTeamId={userTeamId} />
      </Panel>

      {/* Your Team News */}
      {userItems.length > 0 && (
        <div className="mb-5">
          <p className="font-mono text-[10px] text-gold/60 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="text-gold">★</span> {userTeam?.city} {userTeam?.name} News
          </p>
          <div className="space-y-2">
            {userItems.map(item => {
              const navUrl = newsItemNav(item);
              return <NewsCard key={item.id} item={item} onClick={navUrl ? () => navigate(navUrl) : undefined} />;
            })}
          </div>
        </div>
      )}

      {/* League News */}
      <div>
        <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider mb-2">Around the League</p>
        {leagueItems.length === 0 ? (
          <Panel>
            <div className="py-10 text-center">
              <div className="text-4xl mb-3">📰</div>
              <p className="font-display text-lg text-cream-dim">No league news yet</p>
              <p className="font-mono text-xs text-cream-dim/50 mt-1">
                News accumulates as you sim days. Advance a few days to see results, trades, and injuries.
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => navigate('/franchise')}
              >
                Go to Dashboard
              </Button>
            </div>
          </Panel>
        ) : (
          <div className="space-y-2">
            {leagueItems.map(item => {
              const navUrl = newsItemNav(item);
              return <NewsCard key={item.id} item={item} onClick={navUrl ? () => navigate(navUrl) : undefined} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
