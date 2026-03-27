import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useInboxStore } from '@/stores/inboxStore.ts';
import { winPct } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

// ── Types ────────────────────────────────────────────────────────────────────

interface GameResult {
  day: number;
  gameId: string;
  opponent: string;
  oppAbbr: string;
  isHome: boolean;
  won: boolean;
  myScore: number;
  oppScore: number;
  cumulativeWins: number;
  cumulativeLosses: number;
}

interface TimelineEvent {
  day: number;
  type: 'streak' | 'injury' | 'trade' | 'milestone' | 'callup';
  text: string;
  color: string;
  icon: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function streakRuns(results: GameResult[]): { type: 'W' | 'L'; length: number; startDay: number; endDay: number }[] {
  const streaks: { type: 'W' | 'L'; length: number; startDay: number; endDay: number }[] = [];
  let i = 0;
  while (i < results.length) {
    const type = results[i].won ? 'W' : 'L';
    const startDay = results[i].day;
    let length = 1;
    while (i + length < results.length && results[i + length].won === results[i].won) length++;
    streaks.push({ type: type as 'W' | 'L', length, startDay, endDay: results[i + length - 1].day });
    i += length;
  }
  return streaks;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SeasonTimelinePage() {
  const navigate = useNavigate();
  const { engine, userTeamId, season } = useFranchiseStore();
  const playerStats = useStatsStore(s => s.playerStats);
  const inboxItems = useInboxStore(s => s.items);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  if (!engine || !userTeamId || !season) {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl text-gold uppercase tracking-wide mb-4">Season Timeline</h1>
        <p className="font-mono text-cream-dim text-sm">
          Track your season's story — wins, losses, streaks, trades, and key moments visualized on an interactive timeline.
        </p>
        <p className="font-mono text-cream-dim/50 text-xs mt-2">Loading franchise data...</p>
        <Button className="mt-4" onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const userRecord = season.standings.getRecord(userTeamId);
  const userTeam = engine.getTeam(userTeamId);

  // Build game results
  const gameResults = useMemo(() => {
    const results: GameResult[] = [];
    let wins = 0, losses = 0;

    const userGames = season.schedule
      .filter(g => g.played && (g.awayId === userTeamId || g.homeId === userTeamId))
      .sort((a, b) => a.date - b.date);

    for (const g of userGames) {
      const isHome = g.homeId === userTeamId;
      const oppId = isHome ? g.awayId : g.homeId;
      const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      const won = myScore > oppScore;

      if (won) wins++; else losses++;

      const oppTeam = engine.getTeam(oppId);
      results.push({
        day: g.date,
        gameId: g.id,
        opponent: oppTeam ? `${oppTeam.city} ${oppTeam.name}` : oppId,
        oppAbbr: oppTeam?.abbreviation ?? oppId.slice(0, 3),
        isHome,
        won,
        myScore,
        oppScore,
        cumulativeWins: wins,
        cumulativeLosses: losses,
      });
    }
    return results;
  }, [season.schedule, userTeamId, engine]);

  // Build timeline events from inbox
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Streaks (5+)
    const streaks = streakRuns(gameResults);
    for (const s of streaks) {
      if (s.length >= 5) {
        events.push({
          day: s.endDay,
          type: 'streak',
          text: `${s.length}-game ${s.type === 'W' ? 'winning' : 'losing'} streak (Day ${s.startDay}–${s.endDay})`,
          color: s.type === 'W' ? 'text-green-light' : 'text-red-400',
          icon: s.type === 'W' ? '🔥' : '📉',
        });
      }
    }

    // Inbox events (injuries, trades, milestones)
    for (const item of inboxItems) {
      if (item.day === undefined || item.day > season.currentDay) continue;
      if (item.type === 'injury') {
        events.push({
          day: item.day,
          type: 'injury',
          text: item.title,
          color: 'text-red-400',
          icon: '🩹',
        });
      } else if (item.type === 'trade_offer' || item.type === 'trade_result') {
        events.push({
          day: item.day,
          type: 'trade',
          text: item.title,
          color: 'text-blue-400',
          icon: '⇄',
        });
      } else if (item.type === 'milestone') {
        events.push({
          day: item.day,
          type: 'milestone',
          text: item.title,
          color: 'text-gold',
          icon: '⭐',
        });
      } else if (item.type === 'callup') {
        events.push({
          day: item.day,
          type: 'callup',
          text: item.title,
          color: 'text-gold',
          icon: '↑',
        });
      }
    }

    return events.sort((a, b) => a.day - b.day);
  }, [gameResults, inboxItems, season.currentDay]);

  // Monthly breakdown
  const monthlyStats = useMemo(() => {
    const months = [
      { label: 'Apr', startDay: 1, endDay: 30 },
      { label: 'May', startDay: 31, endDay: 60 },
      { label: 'Jun', startDay: 61, endDay: 90 },
      { label: 'Jul', startDay: 91, endDay: 120 },
      { label: 'Aug', startDay: 121, endDay: 150 },
      { label: 'Sep', startDay: 151, endDay: 183 },
    ];
    return months.map(m => {
      const monthGames = gameResults.filter(g => g.day >= m.startDay && g.day <= m.endDay);
      const wins = monthGames.filter(g => g.won).length;
      const losses = monthGames.length - wins;
      return { ...m, wins, losses, games: monthGames.length };
    }).filter(m => m.games > 0);
  }, [gameResults]);

  // Current streaks
  const allStreaks = useMemo(() => streakRuns(gameResults), [gameResults]);
  const currentStreak = allStreaks.length > 0 ? allStreaks[allStreaks.length - 1] : null;
  const longestWin = allStreaks.filter(s => s.type === 'W').reduce((max, s) => s.length > max.length ? s : max, { type: 'W' as const, length: 0, startDay: 0, endDay: 0 });
  const longestLoss = allStreaks.filter(s => s.type === 'L').reduce((max, s) => s.length > max.length ? s : max, { type: 'L' as const, length: 0, startDay: 0, endDay: 0 });

  // Win % over time data for the chart
  const chartData = useMemo(() => {
    if (gameResults.length === 0) return [];
    return gameResults.map((g, i) => ({
      day: g.day,
      wpct: g.cumulativeWins / (g.cumulativeWins + g.cumulativeLosses),
      wins: g.cumulativeWins,
      losses: g.cumulativeLosses,
      won: g.won,
      oppAbbr: g.oppAbbr,
      score: `${g.myScore}-${g.oppScore}`,
      isHome: g.isHome,
    }));
  }, [gameResults]);

  // Chart dimensions
  const CHART_W = 800;
  const CHART_H = 200;
  const CHART_PAD = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const maxDay = Math.max(season.totalDays, ...chartData.map(d => d.day));
  const xScale = (day: number) => CHART_PAD.left + (day / maxDay) * plotW;
  const yScale = (wpct: number) => CHART_PAD.top + (1 - wpct) * plotH;

  // SVG path for win %
  const linePath = chartData.length > 1
    ? chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.day).toFixed(1)} ${yScale(d.wpct).toFixed(1)}`).join(' ')
    : '';

  // Area path (filled under the line)
  const areaPath = chartData.length > 1
    ? `${linePath} L ${xScale(chartData[chartData.length - 1].day).toFixed(1)} ${yScale(0).toFixed(1)} L ${xScale(chartData[0].day).toFixed(1)} ${yScale(0).toFixed(1)} Z`
    : '';

  // Momentum: last 10 games
  const last10 = gameResults.slice(-10);
  const last10Wins = last10.filter(g => g.won).length;
  const momentum = last10.length > 0 ? last10Wins / last10.length : 0.5;
  const momentumLabel = momentum >= 0.7 ? 'Hot' : momentum >= 0.5 ? 'Steady' : momentum >= 0.3 ? 'Cold' : 'Ice Cold';
  const momentumColor = momentum >= 0.7 ? 'text-green-light' : momentum >= 0.5 ? 'text-cream' : momentum >= 0.3 ? 'text-orange-400' : 'text-red-400';
  const momentumBg = momentum >= 0.7 ? 'bg-green-light' : momentum >= 0.5 ? 'bg-cream-dim' : momentum >= 0.3 ? 'bg-orange-400' : 'bg-red-400';

  // Pace projection
  const gamesPlayed = gameResults.length;
  const totalGames = 162; // rough
  const paceWins = gamesPlayed > 0 ? Math.round((gameResults.filter(g => g.won).length / gamesPlayed) * totalGames) : 0;

  // Division rank tracking
  const divisions = season.standings.getDivisionStandings();
  const userDiv = divisions.find((d: { teams: { teamId: string }[] }) => d.teams.some((t: { teamId: string }) => t.teamId === userTeamId));
  const divRank = userDiv ? userDiv.teams.findIndex((t: { teamId: string }) => t.teamId === userTeamId) + 1 : 0;

  // Find hovered game
  const hoveredGame = hoveredDay !== null ? gameResults.find(g => g.day === hoveredDay) : null;
  const hoveredChartPt = hoveredDay !== null ? chartData.find(d => d.day === hoveredDay) : null;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Season Timeline</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam?.city} {userTeam?.name} — {season.year} Season · Day {season.currentDay}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/franchise')}>← Back</Button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Record</p>
          <p className="font-mono text-2xl font-bold text-gold mt-1">
            {userRecord?.wins ?? 0}-{userRecord?.losses ?? 0}
          </p>
          <p className="font-mono text-xs text-cream-dim/50">{userRecord ? winPct(userRecord) : '.000'}</p>
        </div>
        <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Pace</p>
          <p className={cn('font-mono text-2xl font-bold mt-1', paceWins >= 90 ? 'text-gold' : paceWins >= 81 ? 'text-green-light' : 'text-cream')}>
            {paceWins}W
          </p>
          <p className="font-mono text-xs text-cream-dim/50">162-game pace</p>
        </div>
        <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Division</p>
          <p className={cn('font-mono text-2xl font-bold mt-1', divRank === 1 ? 'text-gold' : divRank <= 3 ? 'text-cream' : 'text-cream-dim')}>
            {divRank > 0 ? `${divRank}${divRank === 1 ? 'st' : divRank === 2 ? 'nd' : divRank === 3 ? 'rd' : 'th'}` : '—'}
          </p>
          <p className="font-mono text-xs text-cream-dim/50">{userDiv?.division ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Momentum</p>
          <p className={cn('font-mono text-2xl font-bold mt-1', momentumColor)}>{momentumLabel}</p>
          <p className="font-mono text-xs text-cream-dim/50">L10: {last10Wins}-{last10.length - last10Wins}</p>
        </div>
        <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Streak</p>
          <p className={cn('font-mono text-2xl font-bold mt-1', currentStreak?.type === 'W' ? 'text-green-light' : currentStreak?.type === 'L' ? 'text-red-400' : 'text-cream-dim')}>
            {currentStreak ? `${currentStreak.type}${currentStreak.length}` : '—'}
          </p>
          <p className="font-mono text-xs text-cream-dim/50">current</p>
        </div>
      </div>

      {/* Win Percentage Chart */}
      <Panel title="Season Trajectory" className="mb-6">
        <div className="relative">
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full h-auto"
            onMouseLeave={() => setHoveredDay(null)}
          >
            {/* .500 line */}
            <line
              x1={CHART_PAD.left} y1={yScale(0.5)}
              x2={CHART_W - CHART_PAD.right} y2={yScale(0.5)}
              stroke="rgba(212,168,67,0.15)" strokeWidth="1" strokeDasharray="4 3"
            />
            <text x={CHART_PAD.left - 5} y={yScale(0.5) + 3} textAnchor="end" className="fill-cream-dim/30 text-[9px] font-mono">.500</text>

            {/* .600 and .400 lines */}
            <line x1={CHART_PAD.left} y1={yScale(0.6)} x2={CHART_W - CHART_PAD.right} y2={yScale(0.6)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <text x={CHART_PAD.left - 5} y={yScale(0.6) + 3} textAnchor="end" className="fill-cream-dim/20 text-[8px] font-mono">.600</text>
            <line x1={CHART_PAD.left} y1={yScale(0.4)} x2={CHART_W - CHART_PAD.right} y2={yScale(0.4)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <text x={CHART_PAD.left - 5} y={yScale(0.4) + 3} textAnchor="end" className="fill-cream-dim/20 text-[8px] font-mono">.400</text>

            {/* Y-axis labels */}
            <text x={CHART_PAD.left - 5} y={yScale(1) + 3} textAnchor="end" className="fill-cream-dim/20 text-[8px] font-mono">1.000</text>
            <text x={CHART_PAD.left - 5} y={yScale(0) + 3} textAnchor="end" className="fill-cream-dim/20 text-[8px] font-mono">.000</text>

            {/* X-axis month labels */}
            {[
              { label: 'Apr', day: 1 },
              { label: 'May', day: 31 },
              { label: 'Jun', day: 61 },
              { label: 'Jul', day: 91 },
              { label: 'Aug', day: 121 },
              { label: 'Sep', day: 151 },
            ].map(m => (
              <g key={m.label}>
                <line x1={xScale(m.day)} y1={CHART_PAD.top} x2={xScale(m.day)} y2={CHART_H - CHART_PAD.bottom} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                <text x={xScale(m.day)} y={CHART_H - 8} textAnchor="middle" className="fill-cream-dim/40 text-[9px] font-mono">{m.label}</text>
              </g>
            ))}

            {/* Milestone markers */}
            {[
              { day: 90, label: 'ASB', color: '#d4a843' },
              { day: 120, label: 'TDL', color: '#ef4444' },
            ].filter(m => m.day <= maxDay).map(m => (
              <g key={m.label}>
                <line x1={xScale(m.day)} y1={CHART_PAD.top} x2={xScale(m.day)} y2={CHART_H - CHART_PAD.bottom} stroke={m.color} strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                <text x={xScale(m.day)} y={CHART_PAD.top - 5} textAnchor="middle" fill={m.color} className="text-[8px] font-mono" opacity="0.7">{m.label}</text>
              </g>
            ))}

            {/* Area fill under line */}
            {areaPath && (
              <path d={areaPath} fill="url(#areaGradient)" />
            )}

            {/* Win % line */}
            {linePath && (
              <path d={linePath} fill="none" stroke="#d4a843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Event markers on chart */}
            {timelineEvents.map((e, i) => {
              const closest = chartData.reduce((best, pt) =>
                Math.abs(pt.day - e.day) < Math.abs(best.day - e.day) ? pt : best, chartData[0]);
              if (!closest) return null;
              return (
                <g key={`evt-${i}`}>
                  <circle
                    cx={xScale(closest.day)}
                    cy={yScale(closest.wpct)}
                    r="5"
                    fill={e.type === 'streak' && e.icon === '🔥' ? '#4ade80' : e.type === 'injury' ? '#f87171' : e.type === 'trade' ? '#60a5fa' : '#d4a843'}
                    opacity="0.8"
                    stroke="#0a0f1a"
                    strokeWidth="1.5"
                    className="cursor-pointer"
                    onClick={() => setSelectedEvent(selectedEvent?.day === e.day ? null : e)}
                  />
                </g>
              );
            })}

            {/* Individual game dots (interactive) */}
            {chartData.map((d, i) => (
              <circle
                key={i}
                cx={xScale(d.day)}
                cy={yScale(d.wpct)}
                r={hoveredDay === d.day ? 5 : 2.5}
                fill={d.won ? '#4ade80' : '#f87171'}
                opacity={hoveredDay === d.day ? 1 : 0.5}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredDay(d.day)}
                onClick={() => navigate(`/franchise/box-score/${gameResults[i]?.gameId}`)}
              />
            ))}

            {/* Gradient definition */}
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4a843" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#d4a843" stopOpacity="0.02" />
              </linearGradient>
            </defs>
          </svg>

          {/* Hover tooltip */}
          {hoveredChartPt && hoveredGame && (
            <div
              className="absolute pointer-events-none bg-navy border border-navy-lighter rounded-lg px-3 py-2 shadow-xl z-10"
              style={{
                left: `${(xScale(hoveredChartPt.day) / CHART_W) * 100}%`,
                top: `${(yScale(hoveredChartPt.wpct) / CHART_H) * 100 - 15}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <p className="font-mono text-[10px] text-cream-dim/60">Day {hoveredGame.day}</p>
              <p className={cn('font-mono text-xs font-bold', hoveredGame.won ? 'text-green-light' : 'text-red-400')}>
                {hoveredGame.won ? 'W' : 'L'} {hoveredGame.myScore}-{hoveredGame.oppScore}
                <span className="text-cream-dim/60 ml-1">{hoveredGame.isHome ? 'vs' : '@'} {hoveredGame.oppAbbr}</span>
              </p>
              <p className="font-mono text-[10px] text-cream-dim/40">{hoveredChartPt.wins}-{hoveredChartPt.losses} ({(hoveredChartPt.wpct * 1000).toFixed(0).replace(/^0+/, '') || '0'})</p>
            </div>
          )}
        </div>

        {/* Selected event detail */}
        {selectedEvent && (
          <div className="mt-2 px-4 py-2 bg-navy-lighter/20 rounded border border-navy-lighter/40 flex items-center gap-2">
            <span className="text-base">{selectedEvent.icon}</span>
            <span className={cn('font-mono text-xs', selectedEvent.color)}>{selectedEvent.text}</span>
            <button onClick={() => setSelectedEvent(null)} className="ml-auto text-cream-dim/40 hover:text-cream-dim text-xs cursor-pointer">✕</button>
          </div>
        )}
      </Panel>

      {/* Monthly Breakdown & Streaks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Monthly Performance */}
        <Panel title="Monthly Breakdown">
          <div className="space-y-2">
            {monthlyStats.map(m => {
              const pct = m.games > 0 ? m.wins / m.games : 0;
              const barW = Math.max(5, pct * 100);
              return (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-cream-dim w-8 shrink-0">{m.label}</span>
                  <div className="flex-1 h-5 bg-navy-lighter/20 rounded-full overflow-hidden relative">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        pct >= 0.6 ? 'bg-green-light/70' : pct >= 0.5 ? 'bg-gold/50' : pct >= 0.4 ? 'bg-orange-400/50' : 'bg-red-400/50',
                      )}
                      style={{ width: `${barW}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-cream font-bold">
                      {m.wins}-{m.losses}
                    </span>
                  </div>
                  <span className={cn(
                    'font-mono text-xs font-bold w-10 text-right',
                    pct >= 0.6 ? 'text-green-light' : pct >= 0.5 ? 'text-gold' : pct >= 0.4 ? 'text-orange-400' : 'text-red-400',
                  )}>
                    .{(pct * 1000).toFixed(0).padStart(3, '0')}
                  </span>
                </div>
              );
            })}
            {monthlyStats.length === 0 && (
              <p className="font-mono text-xs text-cream-dim/40 text-center py-4">No games played yet</p>
            )}
          </div>
        </Panel>

        {/* Streak Records */}
        <Panel title="Streak Records">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Longest Win Streak</p>
                <p className="font-mono text-2xl font-bold text-green-light mt-1">{longestWin.length > 0 ? longestWin.length : '—'}</p>
                {longestWin.length > 0 && (
                  <p className="font-mono text-[10px] text-cream-dim/40">Day {longestWin.startDay}–{longestWin.endDay}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Longest Losing Streak</p>
                <p className="font-mono text-2xl font-bold text-red-400 mt-1">{longestLoss.length > 0 ? longestLoss.length : '—'}</p>
                {longestLoss.length > 0 && (
                  <p className="font-mono text-[10px] text-cream-dim/40">Day {longestLoss.startDay}–{longestLoss.endDay}</p>
                )}
              </div>
            </div>

            {/* Momentum Bar */}
            <div>
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-2">Momentum (Last 10)</p>
              <div className="h-3 bg-navy-lighter/30 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', momentumBg)}
                  style={{ width: `${momentum * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-mono text-[9px] text-red-400/40">Cold</span>
                <span className={cn('font-mono text-xs font-bold', momentumColor)}>{last10Wins}-{last10.length - last10Wins}</span>
                <span className="font-mono text-[9px] text-green-light/40">Hot</span>
              </div>
            </div>

            {/* All streaks (3+) */}
            <div>
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-1.5">Notable Streaks</p>
              <div className="flex flex-wrap gap-1.5">
                {allStreaks.filter(s => s.length >= 3).map((s, i) => (
                  <span
                    key={i}
                    className={cn(
                      'px-2 py-0.5 rounded font-mono text-[10px] font-bold border',
                      s.type === 'W'
                        ? 'bg-green-900/20 border-green-light/20 text-green-light'
                        : 'bg-red-950/20 border-red/20 text-red-400',
                    )}
                  >
                    {s.type}{s.length}
                  </span>
                ))}
                {allStreaks.filter(s => s.length >= 3).length === 0 && (
                  <span className="font-mono text-[10px] text-cream-dim/30">No notable streaks yet</span>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Recent Timeline Events */}
      {timelineEvents.length > 0 && (
        <Panel title={`Key Events (${timelineEvents.length})`}>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {timelineEvents.slice().reverse().map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy-lighter/20 transition-colors"
              >
                <span className="text-sm shrink-0">{e.icon}</span>
                <span className="font-mono text-xs text-cream-dim/50 w-10 shrink-0">D{e.day}</span>
                <span className={cn('font-mono text-xs flex-1', e.color)}>{e.text}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Game-by-Game Results Strip */}
      <Panel title="Game-by-Game Results" className="mt-4">
        <div className="flex flex-wrap gap-0.5">
          {gameResults.map((g, i) => (
            <button
              key={i}
              onClick={() => navigate(`/franchise/box-score/${g.gameId}`)}
              className={cn(
                'w-5 h-5 rounded-sm text-[8px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer hover:scale-150 hover:z-10',
                g.won
                  ? 'bg-green-light/20 text-green-light border border-green-light/30 hover:bg-green-light/40'
                  : 'bg-red-400/15 text-red-400 border border-red-400/20 hover:bg-red-400/30',
              )}
              title={`Day ${g.day}: ${g.won ? 'W' : 'L'} ${g.myScore}-${g.oppScore} ${g.isHome ? 'vs' : '@'} ${g.oppAbbr}`}
            >
              {g.won ? 'W' : 'L'}
            </button>
          ))}
          {gameResults.length === 0 && (
            <p className="font-mono text-xs text-cream-dim/40 py-4 text-center w-full">
              No games played yet. Advance the season from the dashboard to start building your timeline.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
