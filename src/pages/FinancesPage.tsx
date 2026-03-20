import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { Panel } from '@/components/ui/Panel.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { ScheduledGame } from '@/engine/season/ScheduleGenerator.ts';

// ── Constants ─────────────────────────────────────────────────────────────────
const GOLD = '#d4a843';
const CREAM_DIM = '#a09880';
const GREEN = '#22c55e';
const RED = '#ef4444';
const ORANGE = '#f97316';

const CAPACITY = 34_000;         // nominal stadium capacity (MLB avg ~34K)
const REVENUE_PER_FAN = 42;      // avg spend in dollars
const TV_REVENUE = 80_000;       // $80M annual TV deal (thousands)
const SPONSOR_REVENUE = 15_000;  // $15M sponsorships/merchandise (thousands)
const OPS_EXPENSES = 20_000;     // $20M operations (thousands)
const MINOR_EXPENSES = 8_000;    // $8M minor leagues + scouting (thousands)

// ── Deterministic per-game variation ─────────────────────────────────────────
function hashGame(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function computeAttendance(
  game: ScheduledGame,
  userTeamId: string,
  userWinPct: number,
  divRivals: Set<string>,
  divRank: number,
): number {
  if (!game.played || game.homeId !== userTeamId) return 0;

  let att = 20_000;
  att += Math.round((userWinPct - 0.400) * 20_000);

  // Weekend bonus (rough weekday approximation from season day)
  const dow = game.date % 7;
  if (dow <= 1 || dow === 6) att += 2_500;

  // Division rival bonus
  if (divRivals.has(game.awayId)) att += 2_000;

  // Playoff contender bonus
  if (divRank <= 2) att += 3_000;

  // Blowout game penalty
  if (game.homeScore !== undefined && game.awayScore !== undefined) {
    if (Math.abs(game.homeScore - game.awayScore) >= 7) att -= 1_500;
  }

  // Deterministic per-game noise ±2,500
  att += (hashGame(game.id) % 5_001) - 2_500;

  return Math.min(42_000, Math.max(10_000, Math.round(att)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

function rankLabel(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = 'text-cream' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-navy-lighter/20 border border-navy-lighter rounded-xl p-4">
      <p className="font-mono text-xs text-cream-dim/50 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('font-display text-2xl font-bold', color)}>{value}</p>
      {sub && <p className="font-mono text-xs text-cream-dim/50 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Owner satisfaction gauge (semicircle SVG) ─────────────────────────────────
function SatisfactionGauge({ pct }: { pct: number }) {
  const r = 56;
  const arc = Math.PI * r; // half-circle length ≈ 175.9
  const offset = arc * (1 - Math.min(1, Math.max(0, pct) / 100));
  const color = pct >= 70 ? GREEN : pct >= 45 ? GOLD : RED;
  const label =
    pct >= 75 ? 'Owner Pleased' :
    pct >= 55 ? 'Owner Watching' :
    pct >= 35 ? 'Owner Frustrated' :
    'Hot Seat';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="140" height="82" viewBox="0 0 140 82">
        {/* Background track */}
        <path d="M 14 72 A 56 56 0 0 1 126 72" fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth="12" strokeLinecap="round" />
        {/* Filled arc */}
        <path d="M 14 72 A 56 56 0 0 1 126 72" fill="none"
          stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${arc}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
        <text x="70" y="64" textAnchor="middle" fill={color}
          fontSize="24" fontFamily="Oswald, sans-serif" fontWeight="bold">{Math.round(pct)}</text>
        <text x="70" y="78" textAnchor="middle" fill="rgba(232,224,212,0.35)"
          fontSize="10" fontFamily="IBM Plex Mono, monospace">/100</text>
      </svg>
      <p className="font-mono text-xs uppercase tracking-widest" style={{ color }}>{label}</p>
    </div>
  );
}

// ── Revenue bar row ───────────────────────────────────────────────────────────
function BreakdownRow({ name, value, total, color }: {
  name: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="font-mono text-xs text-cream-dim/70 w-20 shrink-0">{name}</span>
      <div className="flex-1 h-2 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-xs font-bold text-cream w-14 text-right">
        ${(value / 1000).toFixed(0)}M
      </span>
      <span className="font-mono text-[10px] text-cream-dim/40 w-7 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function FinancesPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId, teams, teamBudgets, getTeamPayroll } = useFranchiseStore();

  const analysis = useMemo(() => {
    if (!engine || !season || !userTeamId) return null;

    const ls = engine.getLeagueStructure();
    const rec = season.standings.getRecord(userTeamId);
    const gp = rec ? rec.wins + rec.losses : 0;
    const winPct = gp > 0 ? rec!.wins / gp : 0.500;

    // Division context
    const divRivals = new Set<string>();
    let userDiv = '';
    for (const [, divisions] of Object.entries(ls)) {
      for (const [division, ids] of Object.entries(divisions)) {
        if (ids.includes(userTeamId)) {
          userDiv = division;
          ids.forEach(id => { if (id !== userTeamId) divRivals.add(id); });
        }
      }
    }

    const divStandings = season.standings.getDivisionStandings();
    const myDiv = divStandings.find(d => d.teams.some(t => t.teamId === userTeamId));
    const divRank = myDiv ? myDiv.teams.findIndex(t => t.teamId === userTeamId) + 1 : 5;

    // Per-game attendance
    const homeGames = season.schedule
      .filter(g => g.homeId === userTeamId && g.played)
      .sort((a, b) => a.date - b.date);

    const gameData = homeGames.map((g, i) => {
      const att = computeAttendance(g, userTeamId, winPct, divRivals, divRank);
      const opp = engine.getTeam(g.awayId);
      return {
        game: i + 1,
        attendance: att,
        capacity: CAPACITY,
        label: opp ? `vs ${opp.abbreviation}` : `Game ${i + 1}`,
        win: g.homeScore !== undefined && g.awayScore !== undefined
          ? g.homeScore > g.awayScore
          : undefined,
      };
    });

    const totalAttendance = gameData.reduce((s, g) => s + g.attendance, 0);
    const avgAttendance = gameData.length > 0 ? totalAttendance / gameData.length : 0;
    const occupancy = (avgAttendance / CAPACITY) * 100;

    // Revenue (in thousands = "M" display)
    const gateRevM = (totalAttendance * REVENUE_PER_FAN) / 1000;
    const totalRevM = gateRevM + TV_REVENUE + SPONSOR_REVENUE;

    // Projected full-season gate (scale by 81 home games)
    // Use neutral avg attendance projection when fewer than 5 games played (avoids Day 1 panic)
    const NEUTRAL_GATE_M = (22_000 * REVENUE_PER_FAN * 81) / 1000;
    const projGateM = homeGames.length >= 5
      ? (gateRevM / homeGames.length) * 81
      : NEUTRAL_GATE_M;
    const projTotalM = projGateM + TV_REVENUE + SPONSOR_REVENUE;

    // Expenses
    const payroll = getTeamPayroll(userTeamId);
    const totalExp = payroll + OPS_EXPENSES + MINOR_EXPENSES;
    const netIncome = totalRevM - totalExp;
    const projNet = projTotalM - totalExp;
    const budget = teamBudgets[userTeamId] ?? 150_000;

    // Owner satisfaction score
    const payrollRank = [...teams]
      .sort((a, b) => getTeamPayroll(b.id) - getTeamPayroll(a.id))
      .findIndex(t => t.id === userTeamId) + 1;
    const payrollTier = payrollRank / teams.length;
    const expectedWP = 0.550 - payrollTier * 0.200;
    const satisfaction = gp < 5 ? 65 : Math.min(100, Math.max(0,
      Math.round(50 + (winPct - expectedWP) * 200 + Math.min(1, occupancy / 100) * 20)
    ));

    // Monthly attendance (month 1-6 = Apr-Sep)
    const monthBuckets: Record<number, { total: number; games: number }> = {};
    for (const g of gameData) {
      const m = Math.min(6, Math.ceil((g.game / Math.max(1, homeGames.length)) * 6));
      if (!monthBuckets[m]) monthBuckets[m] = { total: 0, games: 0 };
      monthBuckets[m].total += g.attendance;
      monthBuckets[m].games += 1;
    }
    const MONTH_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const monthlyData = Object.entries(monthBuckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([m, d]) => ({
        month: MONTH_LABELS[Number(m) - 1] ?? `M${m}`,
        avg: d.games > 0 ? Math.round(d.total / d.games) : 0,
      }));

    return {
      gp, winPct, divRank, userDiv,
      gameData, totalAttendance, avgAttendance, occupancy,
      gateRevM, totalRevM, projTotalM,
      payroll, totalExp, netIncome, projNet, budget,
      satisfaction, payrollRank,
      monthlyData,
      homeGamesPlayed: homeGames.length,
    };
  }, [engine, season, userTeamId, teams, teamBudgets, getTeamPayroll]);

  if (!engine || !season || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Finances</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Manage your team budget, revenue streams, and financial health across the season.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  if (!analysis) return null;

  const team = engine.getTeam(userTeamId);
  const {
    gameData, totalAttendance, avgAttendance, occupancy,
    gateRevM, totalRevM, projTotalM,
    payroll, totalExp, netIncome, projNet, budget,
    satisfaction, payrollRank,
    monthlyData, homeGamesPlayed,
  } = analysis;

  const netColor = netIncome >= 0 ? 'text-green-light' : 'text-red-400';
  const cappedOcc = Math.min(100, occupancy);
  const occColor = cappedOcc >= 75 ? 'text-green-light' : cappedOcc >= 55 ? 'text-gold' : 'text-red-400';

  const revenueBreakdown = [
    { name: 'Gate Revenue', value: gateRevM, color: GOLD },
    { name: 'TV Deal', value: TV_REVENUE, color: '#3b82f6' },
    { name: 'Sponsorships', value: SPONSOR_REVENUE, color: GREEN },
  ];

  const expenseBreakdown = [
    { name: 'Player Payroll', value: payroll, color: RED },
    { name: 'Operations', value: OPS_EXPENSES, color: ORANGE },
    { name: 'Minor Leagues', value: MINOR_EXPENSES, color: '#a855f7' },
  ];

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
          Franchise Finances
        </h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {team?.city} {team?.name} — {season.year} Season ·{' '}
          {homeGamesPlayed} home game{homeGamesPlayed !== 1 ? 's' : ''} · Day {season.currentDay}/{season.totalDays}
        </p>
      </div>

      {/* Action bar */}
      <div className="flex gap-3 mb-5">
        <Button onClick={() => navigate('/franchise/payroll')}>Manage Payroll →</Button>
        <Button variant="ghost" onClick={() => navigate('/franchise/war-room')}>GM War Room →</Button>
        <Button variant="ghost" onClick={() => navigate('/franchise/free-agency')}>Free Agency →</Button>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Season Attendance"
          value={fmtK(totalAttendance)}
          sub={`Avg ${fmtK(Math.round(avgAttendance))} / game · ${cappedOcc.toFixed(0)}% cap`}
          color={occColor}
        />
        <MetricCard
          label="Gate Revenue"
          value={`$${(gateRevM / 1000).toFixed(0)}M`}
          sub={`+ $${(TV_REVENUE / 1000).toFixed(0)}M TV deal`}
          color="text-gold"
        />
        <MetricCard
          label="Total Payroll"
          value={`$${(payroll / 1000).toFixed(0)}M`}
          sub={`Budget: $${(budget / 1000).toFixed(0)}M · #${payrollRank} in league`}
          color={payroll > budget ? 'text-red-400' : 'text-cream'}
        />
        <MetricCard
          label={homeGamesPlayed > 0 && homeGamesPlayed < 81 ? 'Net Income (YTD)' : 'Net Income'}
          value={homeGamesPlayed === 0 ? '—' : `${netIncome >= 0 ? '+' : ''}$${(netIncome / 1000).toFixed(0)}M`}
          sub={homeGamesPlayed === 0
            ? `Proj. ${projNet >= 0 ? '+' : ''}$${(projNet / 1000).toFixed(0)}M · builds with home games`
            : homeGamesPlayed < 81
              ? `Proj. full season: ${projNet >= 0 ? '+' : ''}$${(projNet / 1000).toFixed(0)}M`
              : 'Final'}
          color={homeGamesPlayed === 0 ? 'text-cream-dim' : homeGamesPlayed < 81 && netIncome < 0 ? 'text-gold' : netColor}
        />
      </div>

      {/* Main grid: Attendance chart + Owner satisfaction */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Attendance trend */}
        <div className="lg:col-span-2">
          <Panel title={`Home Attendance — ${homeGamesPlayed} Game${homeGamesPlayed !== 1 ? 's' : ''} Played`}>
            {gameData.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="text-3xl opacity-20">🏟</div>
                <p className="font-mono text-cream-dim text-sm">No home games played yet.</p>
                <p className="font-mono text-cream-dim/40 text-xs">
                  Attendance data builds as the season progresses.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={gameData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="finAttGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="game"
                      stroke={CREAM_DIM}
                      tick={{ fontSize: 9, fill: CREAM_DIM }}
                      label={{ value: 'Home Game #', position: 'insideBottomRight', offset: -4, fill: CREAM_DIM, fontSize: 9 }}
                    />
                    <YAxis
                      stroke={CREAM_DIM}
                      tick={{ fontSize: 9, fill: CREAM_DIM }}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                      domain={[0, 50000]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0d1525',
                        border: '1px solid rgba(212,168,67,0.3)',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      labelFormatter={(v) => `Game ${v}`}
                      formatter={(v) => [`${(Number(v) / 1000).toFixed(1)}K fans`]}
                    />
                    {/* Capacity reference line via dashed area */}
                    <Area
                      type="monotone"
                      dataKey="capacity"
                      stroke="rgba(232,224,212,0.12)"
                      fill="none"
                      strokeDasharray="4 3"
                      dot={false}
                      name="Capacity"
                    />
                    <Area
                      type="monotone"
                      dataKey="attendance"
                      stroke={GOLD}
                      fill="url(#finAttGrad)"
                      strokeWidth={2}
                      dot={false}
                      name="Attendance"
                      activeDot={{ r: 4, fill: GOLD }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 pt-2 border-t border-navy-lighter/50">
                  <span className="font-mono text-[10px] text-cream-dim/50">
                    <span style={{ color: GOLD }}>━</span> Attendance
                  </span>
                  <span className="font-mono text-[10px] text-cream-dim/50">
                    <span style={{ color: 'rgba(232,224,212,0.25)' }}>╌</span> Avg capacity (~{fmtK(CAPACITY)})
                  </span>
                  <span className="font-mono text-[10px] text-cream-dim/50 ml-auto">
                    Avg occupancy: {Math.min(100, occupancy).toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* Owner satisfaction + monthly bars */}
        <div className="flex flex-col gap-3">
          <Panel title="Owner Satisfaction">
            <div className="flex justify-center py-2">
              <SatisfactionGauge pct={satisfaction} />
            </div>
            <div className="mt-2 space-y-1.5 font-mono text-xs">
              {[
                {
                  key: 'Win%',
                  val: (() => {
                    const r = season.standings.getRecord(userTeamId);
                    if (!r) return '—';
                    const gp2 = r.wins + r.losses;
                    return gp2 > 0 ? (r.wins / gp2).toFixed(3).replace('0.', '.') : '.000';
                  })(),
                  good: (() => {
                    const r = season.standings.getRecord(userTeamId);
                    if (!r) return false;
                    const gp2 = r.wins + r.losses;
                    return gp2 > 0 && r.wins / gp2 >= 0.500;
                  })(),
                },
                {
                  key: 'Attendance',
                  val: `${cappedOcc.toFixed(0)}% cap`,
                  good: cappedOcc >= 65,
                },
                {
                  key: 'Payroll Flex',
                  val: `${budget - payroll >= 0 ? '+' : ''}$${((budget - payroll) / 1000).toFixed(0)}M`,
                  good: budget - payroll >= 0,
                },
              ].map(({ key, val, good }) => (
                <div key={key} className="flex justify-between">
                  <span className="text-cream-dim/50">{key}</span>
                  <span className={good ? 'text-green-light' : 'text-red-400'}>{val}</span>
                </div>
              ))}
              <p className="text-cream-dim/30 text-[10px] pt-2 border-t border-navy-lighter mt-1">
                {satisfaction >= 75 ? 'Ownership is happy. Budget may increase next season.' :
                 satisfaction >= 55 ? 'Management pressure building — win more.' :
                 satisfaction >= 35 ? 'Job security at risk. Major improvements needed.' :
                 'Ownership is furious. Changes demanded immediately.'}
              </p>
            </div>
          </Panel>

          {monthlyData.length > 0 && (
            <Panel title="Monthly Avg Attendance">
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: CREAM_DIM }} stroke="transparent" />
                  <YAxis tick={{ fontSize: 8, fill: CREAM_DIM }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} stroke="transparent" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 6, fontSize: 11 }}
                    formatter={(v) => [`${(Number(v) / 1000).toFixed(1)}K avg`]}
                  />
                  <Bar dataKey="avg" fill={GOLD} radius={[2, 2, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          )}
        </div>
      </div>

      {/* Revenue & Expenses breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="Revenue Sources">
          <div className="space-y-2.5">
            {revenueBreakdown.map(item => (
              <BreakdownRow key={item.name} {...item} total={totalRevM} />
            ))}
            <div className="flex items-center gap-3 pt-2 border-t border-navy-lighter mt-1">
              <span className="font-mono text-xs text-cream-dim/80 w-20 shrink-0 font-bold">TOTAL</span>
              <div className="flex-1" />
              <span className="font-mono text-sm font-bold text-gold">${(totalRevM / 1000).toFixed(0)}M</span>
              <span className="w-7" />
            </div>
            {homeGamesPlayed < 81 && (
              <p className="font-mono text-[10px] text-cream-dim/40 pt-1">
                Projected full season: ${(projTotalM / 1000).toFixed(0)}M
                ({homeGamesPlayed}/81 home games played)
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Operating Expenses">
          <div className="space-y-2.5">
            {expenseBreakdown.map(item => (
              <BreakdownRow key={item.name} {...item} total={totalExp} />
            ))}
            <div className="flex items-center gap-3 pt-2 border-t border-navy-lighter mt-1">
              <span className="font-mono text-xs text-cream-dim/80 w-20 shrink-0 font-bold">TOTAL</span>
              <div className="flex-1" />
              <span className="font-mono text-sm font-bold text-red-400">${(totalExp / 1000).toFixed(0)}M</span>
              <span className="w-7" />
            </div>
          </div>

          {/* Net income highlight */}
          <div className={cn(
            'mt-4 p-3 rounded-lg border font-mono',
            netIncome >= 0
              ? 'border-green-light/20 bg-green-light/5'
              : 'border-red-400/20 bg-red-400/5',
          )}>
            <div className="flex justify-between items-center">
              <span className="text-xs text-cream-dim/60 uppercase tracking-wider">Net Operating Income</span>
              <span className={cn('text-lg font-bold', netColor)}>
                {netIncome >= 0 ? '+' : ''}${(netIncome / 1000).toFixed(0)}M
              </span>
            </div>
            {homeGamesPlayed < 81 && (
              <p className="text-[10px] text-cream-dim/40 mt-1">
                Projected season total: {projNet >= 0 ? '+' : ''}${(projNet / 1000).toFixed(0)}M
              </p>
            )}
          </div>
        </Panel>
      </div>

      {/* League payroll comparison */}
      <Panel title="League Payroll Rankings">
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-navy-lighter">
                {['#', 'Team', 'Payroll', 'Budget', 'Flexibility', 'Utilization'].map(h => (
                  <th
                    key={h}
                    className={cn(
                      'py-2 text-xs text-cream-dim/50 uppercase tracking-wider',
                      h === 'Team' ? 'text-left' : 'text-right',
                      h === 'Utilization' ? 'text-left pl-4' : '',
                    )}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams
                .map(t => ({
                  team: t,
                  payroll: getTeamPayroll(t.id),
                  budget: teamBudgets[t.id] ?? 130_000,
                }))
                .sort((a, b) => b.payroll - a.payroll)
                .slice(0, 10)
                .map(({ team, payroll: tp, budget: tb }, i) => {
                  const isUser = team.id === userTeamId;
                  const flex = tb - tp;
                  const util = tb > 0 ? (tp / tb) * 100 : 0;
                  return (
                    <tr key={team.id} className={cn(
                      'border-b border-navy-lighter/20',
                      isUser && 'bg-gold/5',
                    )}>
                      <td className="py-1.5 text-right text-cream-dim/40 pr-3">{i + 1}</td>
                      <td className={cn('py-1.5', isUser ? 'text-gold font-bold' : 'text-cream')}>
                        {team.city} {team.name}
                        {isUser && (
                          <span className="text-[10px] text-gold/60 ml-1.5 font-normal">You</span>
                        )}
                      </td>
                      <td className="text-right text-cream py-1.5">${(tp / 1000).toFixed(0)}M</td>
                      <td className="text-right text-cream-dim py-1.5">${(tb / 1000).toFixed(0)}M</td>
                      <td className={cn('text-right py-1.5', flex >= 0 ? 'text-green-light' : 'text-red-400')}>
                        {flex >= 0 ? '+' : ''}${(flex / 1000).toFixed(0)}M
                      </td>
                      <td className="py-1.5 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, util)}%`,
                                backgroundColor: util > 100 ? RED : util > 85 ? GOLD : GREEN,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-cream-dim/40">{util.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <p className="font-mono text-[10px] text-cream-dim/30 mt-2">Top 10 teams by payroll shown.</p>
        </div>
      </Panel>
    </div>
  );
}
