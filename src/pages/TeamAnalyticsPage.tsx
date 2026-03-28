import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend,
} from 'recharts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { winPct } from '@/engine/season/index.ts';
import { battingAvg, onBasePct, slugging, era as calcEra } from '@/engine/types/stats.ts';
import { woba, wrcPlus, opsPlus, babip, iso, fip, k9, bb9, eraPlus, deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT } from '@/engine/stats/AdvancedStats.ts';
import { cn } from '@/lib/cn.ts';

const GOLD = '#d4a843';
const GREEN = '#4ade80';
const RED = '#f87171';
const CREAM = '#e8e0d4';
const CREAM_DIM = '#a09880';
const NAVY_LIGHT = '#1a2540';

type Tab = 'trends' | 'h2h' | 'splits';

// ── Custom tooltip for win% chart ─────────────────────────────────────────────
function WinPctTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { game: number; day: number; wl: string; opponent: string; result: string } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-navy border border-navy-lighter rounded-lg p-2 font-mono text-xs shadow-xl">
      <p className="text-gold font-bold">Game {d.game} — Day {d.day}</p>
      <p className={cn('font-bold', d.result === 'W' ? 'text-green-light' : 'text-red-400')}>{d.result} vs {d.opponent}</p>
      <p className="text-cream-dim">{d.wl} · {(payload[0].value * 100).toFixed(1)}% win rate</p>
    </div>
  );
}

// ── Custom tooltip for run chart ──────────────────────────────────────────────
function RunTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy border border-navy-lighter rounded-lg p-2 font-mono text-xs shadow-xl">
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export function TeamAnalyticsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();
  const [tab, setTab] = useState<Tab>('trends');

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/franchise')}>Back to Dashboard</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);

  // All user games played so far, in date order
  const userGames = useMemo(() =>
    season.schedule
      .filter(g => g.played && (g.homeId === userTeamId || g.awayId === userTeamId))
      .sort((a, b) => a.date - b.date),
    [season.schedule, userTeamId]
  );

  // ── Win% trend data ────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    let wins = 0;
    let losses = 0;
    return userGames.map((g, idx) => {
      const isHome = g.homeId === userTeamId;
      const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      const won = myScore > oppScore;
      if (won) wins++; else losses++;
      const oppId = isHome ? g.awayId : g.homeId;
      const oppTeam = engine.getTeam(oppId);
      const oppAbbr = oppTeam?.abbreviation ?? oppId.slice(0, 3).toUpperCase();
      const wPct = (wins + losses) > 0 ? wins / (wins + losses) : 0;
      return {
        game: idx + 1,
        day: g.date,
        winPct: +wPct.toFixed(4),
        wins,
        losses,
        result: won ? 'W' : 'L',
        opponent: oppAbbr,
        wl: `${wins}-${losses}`,
        myScore,
        oppScore,
      };
    });
  }, [userGames, userTeamId, engine]);

  // Rolling 7-game win% (for "hot streak" view)
  const rollingData = useMemo(() => {
    return trendData.map((d, i) => {
      const window = trendData.slice(Math.max(0, i - 6), i + 1);
      const windowWins = window.filter(x => x.result === 'W').length;
      const rolling7 = +(windowWins / window.length).toFixed(4);
      return { ...d, rolling7 };
    });
  }, [trendData]);

  // ── Run scoring data ───────────────────────────────────────────────────────
  const runData = useMemo(() =>
    userGames.map((g, i) => {
      const isHome = g.homeId === userTeamId;
      const rs = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const ra = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      return { game: i + 1, day: g.date, scored: rs, allowed: ra, diff: rs - ra };
    }),
    [userGames, userTeamId]
  );

  // Runs per game averages
  const avgRS = runData.length > 0 ? runData.reduce((s, d) => s + d.scored, 0) / runData.length : 0;
  const avgRA = runData.length > 0 ? runData.reduce((s, d) => s + d.allowed, 0) / runData.length : 0;

  // ── Head-to-Head records ──────────────────────────────────────────────────
  const h2hData = useMemo(() => {
    const map = new Map<string, { teamId: string; wins: number; losses: number; rs: number; ra: number }>();
    for (const g of userGames) {
      const isHome = g.homeId === userTeamId;
      const oppId = isHome ? g.awayId : g.homeId;
      const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      const won = myScore > oppScore;
      if (!map.has(oppId)) map.set(oppId, { teamId: oppId, wins: 0, losses: 0, rs: 0, ra: 0 });
      const rec = map.get(oppId)!;
      if (won) rec.wins++; else rec.losses++;
      rec.rs += myScore;
      rec.ra += oppScore;
    }
    return Array.from(map.values())
      .map(r => {
        const team = engine.getTeam(r.teamId);
        const oppRecord = season.standings.getRecord(r.teamId);
        const gp = r.wins + r.losses;
        return {
          ...r,
          teamName: team ? `${team.city} ${team.name}` : r.teamId,
          abbr: team?.abbreviation ?? r.teamId.slice(0, 3).toUpperCase(),
          oppWins: oppRecord?.wins ?? 0,
          oppLosses: oppRecord?.losses ?? 0,
          gp,
          wPct: gp > 0 ? r.wins / gp : 0,
          rdPerGame: gp > 0 ? (r.rs - r.ra) / gp : 0,
        };
      })
      .sort((a, b) => b.gp - a.gp);
  }, [userGames, userTeamId, engine, season]);

  const h2hWins = h2hData.reduce((s, r) => s + r.wins, 0);
  const h2hLosses = h2hData.reduce((s, r) => s + r.losses, 0);

  // ── Period splits (30-day chunks) ─────────────────────────────────────────
  const splitData = useMemo(() => {
    const PERIOD_SIZE = 30;
    const periods: { label: string; wins: number; losses: number; rs: number; ra: number; gp: number }[] = [];
    for (let start = 1; start <= season.totalDays; start += PERIOD_SIZE) {
      const end = Math.min(start + PERIOD_SIZE - 1, season.totalDays);
      const games = userGames.filter(g => g.date >= start && g.date <= end);
      if (games.length === 0) continue;
      let wins = 0, losses = 0, rs = 0, ra = 0;
      for (const g of games) {
        const isHome = g.homeId === userTeamId;
        const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
        const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
        if (myScore > oppScore) wins++; else losses++;
        rs += myScore;
        ra += oppScore;
      }
      // Map day ranges to MLB-like period labels
      const label = start <= 30 ? 'April' : start <= 60 ? 'May' : start <= 90 ? 'June'
        : start <= 120 ? 'July' : start <= 150 ? 'August' : 'September';
      const gp = wins + losses;
      periods.push({ label, wins, losses, rs, ra, gp });
    }
    return periods;
  }, [userGames, userTeamId, season.totalDays]);

  const userRecord = season.standings.getRecord(userTeamId);
  const gamesPlayed = userGames.length;
  const hasData = gamesPlayed > 0;

  // ── Advanced sabermetrics ─────────────────────────────────────────────────
  const { getCurrentSeasonStats, leagueTotals } = useStatsStore();
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);

  const teamPlayerStats = useMemo(
    () => Object.values(playerStats).filter(ps => ps.teamId === userTeamId),
    [playerStats, userTeamId],
  );

  const teamBatting = useMemo(() => {
    const agg = { pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, bb: 0, so: 0, hbp: 0, sb: 0, sf: 0, rbi: 0, r: 0, cs: 0, sh: 0, gidp: 0 };
    for (const ps of teamPlayerStats.filter(p => p.position !== 'P')) {
      agg.pa += ps.batting.pa; agg.ab += ps.batting.ab; agg.h += ps.batting.h;
      agg.doubles += ps.batting.doubles; agg.triples += ps.batting.triples;
      agg.hr += ps.batting.hr; agg.bb += ps.batting.bb; agg.so += ps.batting.so;
      agg.hbp += ps.batting.hbp; agg.sb += ps.batting.sb; agg.sf += ps.batting.sf;
      agg.rbi += ps.batting.rbi; agg.r += ps.batting.r;
    }
    return agg;
  }, [teamPlayerStats]);

  const teamPitching = useMemo(() => {
    const agg = { ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, wins: 0, losses: 0, saves: 0, bf: 0, pitchCount: 0, holds: 0 };
    for (const ps of teamPlayerStats.filter(p => p.pitching.ip > 0)) {
      agg.ip += ps.pitching.ip; agg.er += ps.pitching.er; agg.bb += ps.pitching.bb;
      agg.so += ps.pitching.so; agg.hr += ps.pitching.hr; agg.h += ps.pitching.h;
      agg.r += ps.pitching.r; agg.wins += ps.pitching.wins; agg.losses += ps.pitching.losses;
    }
    return agg;
  }, [teamPlayerStats]);

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

  // Pythagorean expected W-L
  const pythExp = avgRS ** 2 / (avgRS ** 2 + avgRA ** 2 + 0.001);
  const pythW = Math.round(pythExp * gamesPlayed);
  const pythL = gamesPlayed - pythW;

  // Chart domain: clamp to 0.3..0.8 range with .500 line prominent
  const minPct = Math.max(0.2, Math.min(...rollingData.map(d => d.winPct)) - 0.05);
  const maxPct = Math.min(0.9, Math.max(...rollingData.map(d => d.winPct)) + 0.05);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'trends', label: 'Performance Trends' },
    { key: 'h2h', label: 'Head-to-Head' },
    { key: 'splits', label: 'Period Splits' },
  ];

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Team Analytics</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {userTeam?.city} {userTeam?.name} — {season.year} Season
          {userRecord && (
            <span className="ml-2 text-cream font-bold">{userRecord.wins}-{userRecord.losses}</span>
          )}
          {gamesPlayed > 0 && (
            <span className="ml-2 text-cream-dim/60">{gamesPlayed} games played</span>
          )}
        </p>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 mb-5 p-1 bg-navy-light/40 rounded-lg w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-1.5 rounded-md font-mono text-xs font-semibold transition-all cursor-pointer',
              tab === key ? 'bg-gold text-navy shadow-sm' : 'text-cream-dim hover:text-cream',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {!hasData && (
        <Panel>
          <div className="text-center py-16">
            <p className="font-mono text-cream-dim text-lg mb-2">No games played yet.</p>
            <p className="font-mono text-cream-dim/40 text-sm mb-4">Simulate some games to see analytics here.</p>
            <Button onClick={() => navigate('/franchise')}>Back to Dashboard</Button>
          </div>
        </Panel>
      )}

      {hasData && tab === 'trends' && (
        <div className="space-y-6">
          {/* Quick stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Season W-L', value: userRecord ? `${userRecord.wins}-${userRecord.losses}` : '—', color: 'text-gold' },
              { label: 'Win %', value: userRecord ? winPct(userRecord) : '—', color: 'text-cream' },
              { label: 'RS/G', value: avgRS.toFixed(2), color: 'text-green-light' },
              { label: 'RA/G', value: avgRA.toFixed(2), color: 'text-red-400' },
            ].map(stat => (
              <Panel key={stat.label}>
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className={cn('font-mono text-2xl font-bold', stat.color)}>{stat.value}</p>
              </Panel>
            ))}
          </div>

          {/* Win% Trend Chart */}
          <Panel title="Win % Over Season">
            <p className="font-mono text-[10px] text-cream-dim/40 mb-3 uppercase tracking-wider">
              Season win % (solid) · 7-game rolling (dashed)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rollingData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="winGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="game"
                  tick={{ fill: CREAM_DIM, fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                  label={{ value: 'Game', position: 'insideBottom', fill: CREAM_DIM, fontSize: 10, offset: -2 }}
                />
                <YAxis
                  domain={[Math.max(0.2, minPct), Math.min(0.9, maxPct)]}
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: CREAM_DIM, fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                  width={44}
                />
                <Tooltip content={<WinPctTooltip />} />
                <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{ value: '.500', fill: CREAM_DIM, fontSize: 9, fontFamily: 'IBM Plex Mono' }} />
                <Area
                  type="monotone"
                  dataKey="winPct"
                  stroke={GOLD}
                  strokeWidth={2}
                  fill="url(#winGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: GOLD, strokeWidth: 0 }}
                  name="Season Win%"
                />
                <Area
                  type="monotone"
                  dataKey="rolling7"
                  stroke={GREEN}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  fill="none"
                  dot={false}
                  activeDot={{ r: 3, fill: GREEN, strokeWidth: 0 }}
                  name="7-Game Rolling"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          {/* Runs Scored vs Allowed Chart */}
          <Panel title="Runs Scored vs Allowed (Last 30 Games)">
            <p className="font-mono text-[10px] text-cream-dim/40 mb-3 uppercase tracking-wider">
              RS avg: <span className="text-green-light font-bold">{avgRS.toFixed(2)}</span>
              {'  ·  '}
              RA avg: <span className="text-red-400 font-bold">{avgRA.toFixed(2)}</span>
              {'  ·  '}
              Run diff: <span className={cn('font-bold', avgRS >= avgRA ? 'text-green-light' : 'text-red-400')}>{avgRS >= avgRA ? '+' : ''}{(avgRS - avgRA).toFixed(2)}</span>
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={runData.slice(-30)}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="game"
                  tick={{ fill: CREAM_DIM, fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                />
                <YAxis
                  tick={{ fill: CREAM_DIM, fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                  width={28}
                />
                <Tooltip content={<RunTooltip />} />
                <ReferenceLine y={avgRS} stroke={GREEN} strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={avgRA} stroke={RED} strokeDasharray="3 3" strokeOpacity={0.5} />
                <Bar dataKey="scored" fill={GREEN} fillOpacity={0.7} name="Runs Scored" radius={[2, 2, 0, 0]} />
                <Bar dataKey="allowed" fill={RED} fillOpacity={0.7} name="Runs Allowed" radius={[2, 2, 0, 0]} />
                <Legend
                  wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: CREAM_DIM, paddingTop: 4 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          {/* Last 10 games mini scoreboard */}
          <Panel title="Last 10 Games">
            <div className="flex flex-wrap gap-1.5">
              {trendData.slice(-10).map(d => (
                <div
                  key={d.game}
                  className={cn(
                    'flex flex-col items-center px-2.5 py-1.5 rounded-lg border font-mono text-xs min-w-[52px]',
                    d.result === 'W'
                      ? 'border-green-light/30 bg-green-900/15'
                      : 'border-red-400/30 bg-red-950/15',
                  )}
                >
                  <span className={cn('font-bold text-sm', d.result === 'W' ? 'text-green-light' : 'text-red-400')}>
                    {d.result}
                  </span>
                  <span className="text-cream-dim/60 text-[10px]">{d.opponent}</span>
                  <span className="text-cream text-[10px]">{d.myScore}–{d.oppScore}</span>
                </div>
              ))}
              {trendData.length === 0 && (
                <p className="text-cream-dim/40 text-xs font-mono">No games yet</p>
              )}
            </div>
          </Panel>

          {/* Team Sabermetrics */}
          {teamBatting.pa > 0 && (
            <Panel title="Team Sabermetrics">
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-[10px] text-gold/60 uppercase tracking-wider mb-2">Batting</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'OPS+', value: opsPlus(teamBatting, leagueCtx.avgObp, leagueCtx.avgSlg).toString(), tip: '100 = league avg' },
                      { label: 'wOBA', value: woba(teamBatting).toFixed(3), tip: 'Weighted On-Base Avg' },
                      { label: 'BABIP', value: babip(teamBatting).toFixed(3), tip: 'Batting Avg on Balls in Play' },
                      { label: 'ISO', value: iso(teamBatting).toFixed(3), tip: 'Isolated Power (SLG - AVG)' },
                    ].map(s => (
                      <div key={s.label} className="bg-navy-lighter/30 rounded-lg px-3 py-2" title={s.tip}>
                        <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider">{s.label}</p>
                        <p className="font-mono text-lg font-bold text-cream">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-gold/60 uppercase tracking-wider mb-2">Pitching</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'ERA+', value: eraPlus(teamPitching, leagueCtx.avgEra).toString(), tip: '100 = league avg, higher = better' },
                      { label: 'FIP', value: fip(teamPitching).toFixed(2), tip: 'Fielding Independent Pitching' },
                      { label: 'K/9', value: k9(teamPitching).toFixed(1), tip: 'Strikeouts per 9 innings' },
                      { label: 'BB/9', value: bb9(teamPitching).toFixed(1), tip: 'Walks per 9 innings' },
                    ].map(s => (
                      <div key={s.label} className="bg-navy-lighter/30 rounded-lg px-3 py-2" title={s.tip}>
                        <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider">{s.label}</p>
                        <p className="font-mono text-lg font-bold text-cream">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-gold/60 uppercase tracking-wider mb-2">Expected</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="bg-navy-lighter/30 rounded-lg px-3 py-2" title="Expected W-L from run differential (Pythagorean)">
                      <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider">Pyth W-L</p>
                      <p className="font-mono text-lg font-bold text-cream">{pythW}-{pythL}</p>
                    </div>
                    <div className="bg-navy-lighter/30 rounded-lg px-3 py-2" title="Actual minus expected wins">
                      <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider">Luck</p>
                      <p className={cn('font-mono text-lg font-bold', (userRecord ? userRecord.wins - pythW : 0) >= 0 ? 'text-green-light' : 'text-red-400')}>
                        {userRecord ? (userRecord.wins - pythW >= 0 ? '+' : '') + (userRecord.wins - pythW) : '—'}
                      </p>
                    </div>
                    <div className="bg-navy-lighter/30 rounded-lg px-3 py-2" title="Run differential per game">
                      <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider">RD/G</p>
                      <p className={cn('font-mono text-lg font-bold', (avgRS - avgRA) >= 0 ? 'text-green-light' : 'text-red-400')}>
                        {(avgRS - avgRA >= 0 ? '+' : '')}{(avgRS - avgRA).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}

      {hasData && tab === 'h2h' && (
        <Panel title={`Head-to-Head Records (${h2hWins}-${h2hLosses} overall)`}>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider">Opponent</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">Opp Record</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">GP</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">W</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">L</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">PCT</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">RS/G</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">RA/G</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">R/D</th>
                </tr>
              </thead>
              <tbody>
                {h2hData.map((r, i) => {
                  const rsPerG = r.gp > 0 ? r.rs / r.gp : 0;
                  const raPerG = r.gp > 0 ? r.ra / r.gp : 0;
                  const winning = r.wPct > 0.5;
                  const losing = r.wPct < 0.5;
                  return (
                    <tr
                      key={r.teamId}
                      onClick={() => navigate(`/franchise/team-stats/${r.teamId}`)}
                      className={cn(
                        'border-b border-navy-lighter/30 hover:bg-navy-lighter/20 transition-colors cursor-pointer',
                        i % 2 === 1 && 'bg-navy-lighter/5',
                      )}
                    >
                      <td className="px-2 py-2">
                        <span className="text-cream font-bold text-xs">{r.abbr}</span>
                        <span className="text-cream-dim/60 text-xs ml-2">{r.teamName}</span>
                      </td>
                      <td className="px-2 py-2 text-center text-cream-dim text-xs">
                        {r.oppWins}-{r.oppLosses}
                      </td>
                      <td className="px-2 py-2 text-right text-cream text-xs">{r.gp}</td>
                      <td className="px-2 py-2 text-right text-xs">
                        <span className={winning ? 'text-green-light font-bold' : 'text-cream'}>{r.wins}</span>
                      </td>
                      <td className="px-2 py-2 text-right text-xs">
                        <span className={losing ? 'text-red-400' : 'text-cream'}>{r.losses}</span>
                      </td>
                      <td className={cn('px-2 py-2 text-right text-xs font-bold', winning ? 'text-green-light' : losing ? 'text-red-400' : 'text-cream-dim')}>
                        {r.gp > 0 ? r.wPct.toFixed(3).replace(/^0/, '') : '—'}
                      </td>
                      <td className="px-2 py-2 text-right text-cream text-xs">{rsPerG.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right text-cream text-xs">{raPerG.toFixed(1)}</td>
                      <td className={cn('px-2 py-2 text-right text-xs font-bold', r.rdPerGame > 0 ? 'text-green-light' : r.rdPerGame < 0 ? 'text-red-400' : 'text-cream-dim')}>
                        {r.rdPerGame > 0 ? '+' : ''}{r.rdPerGame.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-[10px] text-cream-dim/30 mt-3 text-right">
            Click any row to view that team's full stats
          </p>
        </Panel>
      )}

      {hasData && tab === 'splits' && (
        <div className="space-y-4">
          {/* Period table */}
          <Panel title="Performance by Period">
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-navy-lighter">
                    <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider">Period</th>
                    <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">GP</th>
                    <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">W</th>
                    <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">L</th>
                    <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">PCT</th>
                    <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">RS/G</th>
                    <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">RA/G</th>
                    <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">R/D</th>
                  </tr>
                </thead>
                <tbody>
                  {splitData.map((period, i) => {
                    const wPct = period.gp > 0 ? period.wins / period.gp : 0;
                    const rsPerG = period.gp > 0 ? period.rs / period.gp : 0;
                    const raPerG = period.gp > 0 ? period.ra / period.gp : 0;
                    const rdPerG = rsPerG - raPerG;
                    const winning = wPct > 0.5;
                    const losing = wPct < 0.5;
                    return (
                      <tr
                        key={period.label + i}
                        className={cn(
                          'border-b border-navy-lighter/30',
                          i % 2 === 1 && 'bg-navy-lighter/5',
                        )}
                      >
                        <td className="px-2 py-2 text-cream font-bold text-xs">{period.label}</td>
                        <td className="px-2 py-2 text-right text-cream text-xs">{period.gp}</td>
                        <td className="px-2 py-2 text-right text-xs">
                          <span className={winning ? 'text-green-light font-bold' : 'text-cream'}>{period.wins}</span>
                        </td>
                        <td className="px-2 py-2 text-right text-xs">
                          <span className={losing ? 'text-red-400' : 'text-cream'}>{period.losses}</span>
                        </td>
                        <td className={cn('px-2 py-2 text-right text-xs font-bold', winning ? 'text-green-light' : losing ? 'text-red-400' : 'text-cream-dim')}>
                          {wPct.toFixed(3).replace(/^0/, '')}
                        </td>
                        <td className="px-2 py-2 text-right text-cream text-xs">{rsPerG.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right text-cream text-xs">{raPerG.toFixed(2)}</td>
                        <td className={cn('px-2 py-2 text-right text-xs font-bold', rdPerG > 0 ? 'text-green-light' : rdPerG < 0 ? 'text-red-400' : 'text-cream-dim')}>
                          {rdPerG > 0 ? '+' : ''}{rdPerG.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-navy-lighter bg-navy-lighter/10">
                    <td className="px-2 py-2 text-gold font-bold text-xs">SEASON</td>
                    <td className="px-2 py-2 text-right text-cream text-xs font-bold">{gamesPlayed}</td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-green-light">{userRecord?.wins ?? 0}</td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-red-400">{userRecord?.losses ?? 0}</td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-gold">
                      {userRecord ? winPct(userRecord) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right text-cream text-xs font-bold">{avgRS.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right text-cream text-xs font-bold">{avgRA.toFixed(2)}</td>
                    <td className={cn('px-2 py-2 text-right text-xs font-bold', avgRS >= avgRA ? 'text-green-light' : 'text-red-400')}>
                      {avgRS >= avgRA ? '+' : ''}{(avgRS - avgRA).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          {/* Home vs Away split */}
          <Panel title="Home / Away Split">
            {(() => {
              const home = userGames.filter(g => g.homeId === userTeamId);
              const away = userGames.filter(g => g.awayId === userTeamId);
              const calcSplit = (games: typeof userGames, isHome: boolean) => {
                let w = 0, l = 0, rs = 0, ra = 0;
                for (const g of games) {
                  const my = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
                  const opp = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
                  if (my > opp) w++; else l++;
                  rs += my; ra += opp;
                }
                const gp = w + l;
                return { w, l, gp, rs, ra, pct: gp > 0 ? w / gp : 0, rsG: gp > 0 ? rs / gp : 0, raG: gp > 0 ? ra / gp : 0 };
              };
              const h = calcSplit(home, true);
              const a = calcSplit(away, false);
              return (
                <div className="grid grid-cols-2 gap-4">
                  {[{ label: 'Home', data: h }, { label: 'Away', data: a }].map(({ label, data }) => (
                    <div key={label} className="bg-navy-lighter/10 border border-navy-lighter/30 rounded-lg p-4">
                      <p className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-3">{label}</p>
                      <p className={cn('font-mono text-3xl font-bold mb-1', data.pct > 0.5 ? 'text-green-light' : data.pct < 0.5 ? 'text-red-400' : 'text-cream')}>
                        {data.w}-{data.l}
                      </p>
                      <p className="font-mono text-xs text-cream-dim">{data.gp > 0 ? data.pct.toFixed(3).replace(/^0/, '') : '—'}</p>
                      <div className="mt-3 space-y-1 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-cream-dim">RS/G</span>
                          <span className="text-cream">{data.rsG.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cream-dim">RA/G</span>
                          <span className="text-cream">{data.raG.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cream-dim">Run Diff</span>
                          <span className={cn('font-bold', data.rsG >= data.raG ? 'text-green-light' : 'text-red-400')}>
                            {data.rsG >= data.raG ? '+' : ''}{(data.rsG - data.raG).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Panel>

          {/* Win/Loss streak calendar — last 30 games */}
          <Panel title="Results — Last 30 Games">
            <div className="flex flex-wrap gap-1">
              {trendData.slice(-30).map(d => (
                <div
                  key={d.game}
                  title={`Game ${d.game} · Day ${d.day} · ${d.result} vs ${d.opponent} ${d.myScore}-${d.oppScore} · ${d.wl}`}
                  className={cn(
                    'w-6 h-6 rounded text-[9px] font-mono font-bold flex items-center justify-center transition-all',
                    d.result === 'W'
                      ? 'bg-green-light/20 text-green-light border border-green-light/30'
                      : 'bg-red-400/15 text-red-400 border border-red-400/25',
                  )}
                >
                  {d.result}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
