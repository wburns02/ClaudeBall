import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import {
  useGoalsStore,
  ownerConfidenceLabel,
  goalProgressPct,
  PERSONALITY_LABELS_MAP,
} from '@/stores/goalsStore.ts';
import type { SeasonGoal, FranchiseOwner } from '@/stores/goalsStore.ts';
import { winPct, gamesBehind } from '@/engine/season/index.ts';
import { era } from '@/engine/types/stats.ts';
import { cn } from '@/lib/cn.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeColor(g: string): string {
  if (g === 'A+' || g === 'A') return 'text-gold';
  if (g === 'B+' || g === 'B') return 'text-green-light';
  if (g === 'C+' || g === 'C') return 'text-cream';
  if (g === 'D') return 'text-orange-400';
  return 'text-red-400';
}

// ── Confidence Meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const { label, color } = ownerConfidenceLabel(confidence);
  const segments = [
    { max: 25, bg: 'bg-red-600' },
    { max: 40, bg: 'bg-red-400' },
    { max: 55, bg: 'bg-orange-400' },
    { max: 70, bg: 'bg-cream' },
    { max: 85, bg: 'bg-green-light' },
    { max: 100, bg: 'bg-gold' },
  ];
  const activeSeg = segments.find(s => confidence <= s.max) ?? segments[segments.length - 1]!;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-cream-dim/60 uppercase tracking-wider">Owner Confidence</span>
        <span className={cn('font-mono text-sm font-bold', color)}>{label}</span>
      </div>
      <div className="relative h-3 bg-navy-lighter/40 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', activeSeg.bg)}
          style={{ width: `${confidence}%` }}
        />
        {[25, 40, 55, 70, 85].map(mark => (
          <div
            key={mark}
            className="absolute top-0 bottom-0 w-px bg-navy-light/60"
            style={{ left: `${mark}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-cream-dim/30">
        <span>Furious</span>
        <span className={cn('font-bold', color)}>{confidence}/100</span>
        <span>Thrilled</span>
      </div>
    </div>
  );
}

// ── Goal Progress Bar ─────────────────────────────────────────────────────────

function GoalProgressBar({ goal }: { goal: SeasonGoal }) {
  const pct = goalProgressPct(goal);
  const isERA = goal.type === 'TEAM_ERA';
  const isAvoidLast = goal.type === 'AVOID_LAST';
  const isBinary = goal.type === 'PLAYOFF_BERTH' || goal.type === 'DIVISION_TITLE';

  let barColor = 'bg-gold/60';
  if (goal.met) barColor = 'bg-green-light';
  else if (goal.failed) barColor = 'bg-red-400/60';
  else if (pct >= 80) barColor = 'bg-green-light/60';
  else if (pct >= 50) barColor = 'bg-gold/60';
  else barColor = 'bg-orange-400/60';

  if (isBinary) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <div className={cn(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 transition-all',
          goal.met ? 'border-green-light bg-green-light/20 text-green-light' : 'border-navy-lighter text-cream-dim/30',
        )}>
          {goal.met ? '✓' : '·'}
        </div>
        <span className={cn('font-mono text-xs', goal.met ? 'text-green-light' : 'text-cream-dim/50')}>
          {goal.met ? 'Achieved' : 'In progress'}
        </span>
      </div>
    );
  }

  let currentDisplay: string;
  let targetDisplay: string;
  if (goal.type === 'TEAM_ERA') {
    currentDisplay = goal.current > 0 ? (goal.current / 100).toFixed(2) : '—';
    targetDisplay = `< ${(goal.target / 100).toFixed(2)}`;
  } else if (goal.type === 'TEAM_BA') {
    currentDisplay = goal.current > 0 ? `.${String(goal.current).padStart(3, '0')}` : '—';
    targetDisplay = `.${String(goal.target).padStart(3, '0')}`;
  } else if (isAvoidLast) {
    currentDisplay = goal.current > 0 ? `Rank ${goal.current}` : '—';
    targetDisplay = `Not Last`;
  } else {
    currentDisplay = String(goal.current);
    targetDisplay = String(goal.target);
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="h-2 bg-navy-lighter/40 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-cream-dim/50">
        <span className={cn(goal.met ? 'text-green-light font-bold' : 'text-cream')}>
          {currentDisplay}
        </span>
        <span>Target: {targetDisplay}</span>
      </div>
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, compact = false }: { goal: SeasonGoal; compact?: boolean }) {
  const statusColor = goal.met
    ? 'border-green-light/40 bg-green-light/5'
    : goal.failed
      ? 'border-red-400/30 bg-red-900/5'
      : goal.priority === 'primary'
        ? 'border-gold/40 bg-gold/5'
        : 'border-navy-lighter bg-navy-light/20';

  const statusBadge = goal.met
    ? { text: 'MET', color: 'text-green-light bg-green-light/10 border-green-light/30' }
    : goal.failed
      ? { text: 'MISSED', color: 'text-red-400 bg-red-900/20 border-red-500/30' }
      : { text: 'IN PROGRESS', color: 'text-gold/70 bg-gold/5 border-gold/20' };

  if (compact) {
    return (
      <div className={cn('p-3 rounded-lg border transition-all', statusColor)}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base leading-none">{goal.icon}</span>
          <span className="font-body text-sm text-cream font-semibold flex-1 truncate">{goal.description}</span>
          <span className={cn('font-mono text-[10px] px-1.5 py-0.5 rounded border', statusBadge.color)}>
            {statusBadge.text}
          </span>
        </div>
        <GoalProgressBar goal={goal} />
      </div>
    );
  }

  return (
    <div className={cn('p-5 rounded-xl border transition-all', statusColor)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-3xl leading-none mt-0.5 shrink-0">{goal.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-cream-dim/50">
                {goal.priority === 'primary' ? 'Primary Goal' : goal.priority === 'secondary' ? 'Secondary Goal' : 'Bonus Goal'}
              </span>
            </div>
            <h3 className="font-display text-cream text-lg tracking-wide">{goal.description}</h3>
            <p className="font-mono text-xs text-cream-dim/60 mt-0.5 leading-relaxed">{goal.detail}</p>
          </div>
        </div>
        <span className={cn('font-mono text-xs px-2 py-1 rounded-full border shrink-0', statusBadge.color)}>
          {statusBadge.text}
        </span>
      </div>

      <GoalProgressBar goal={goal} />

      {/* Reward / Penalty */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-green-light/5 border border-green-light/15">
          <p className="font-mono text-[10px] text-green-light/70 uppercase tracking-wider mb-0.5">Reward</p>
          <p className="font-mono text-xs text-cream-dim">{goal.reward}</p>
        </div>
        <div className="p-2 rounded bg-red-900/10 border border-red-500/15">
          <p className="font-mono text-[10px] text-red-400/70 uppercase tracking-wider mb-0.5">Penalty</p>
          <p className="font-mono text-xs text-cream-dim">{goal.penalty}</p>
        </div>
      </div>
    </div>
  );
}

// ── Owner Portrait ────────────────────────────────────────────────────────────

function OwnerPanel({ owner }: { owner: FranchiseOwner }) {
  const { label, color } = ownerConfidenceLabel(owner.confidence);
  const initials = owner.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="p-5 rounded-xl border border-navy-lighter bg-navy-light/30">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-navy-lighter/60 border-2 border-gold/30 flex items-center justify-center shrink-0">
          <span className="font-display text-xl text-gold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-cream text-lg tracking-wide">{owner.name}</p>
          <p className="font-mono text-xs text-cream-dim/60 uppercase tracking-wider mb-2">
            {PERSONALITY_LABELS_MAP[owner.personality]} Owner
          </p>
          <ConfidenceMeter confidence={owner.confidence} />
        </div>
      </div>

      {/* Owner message based on confidence */}
      <div className={cn(
        'mt-4 p-3 rounded-lg border font-mono text-xs leading-relaxed italic',
        owner.confidence >= 70
          ? 'border-gold/20 bg-gold/5 text-gold/80'
          : owner.confidence >= 45
            ? 'border-cream-dim/20 bg-navy-lighter/20 text-cream-dim/70'
            : 'border-red-500/20 bg-red-900/10 text-red-400/80',
      )}>
        &ldquo;{ownerMessage(owner)}&rdquo;
      </div>
    </div>
  );
}

function ownerMessage(owner: FranchiseOwner): string {
  const { confidence, personality } = owner;
  if (confidence >= 85) {
    return personality === 'DEVELOPER'
      ? 'The prospects are developing beautifully. Keep up the excellent work.'
      : 'This team is firing on all cylinders. I could not be prouder of this organization.';
  }
  if (confidence >= 70) {
    return personality === 'FINANCIER'
      ? 'Good progress so far. Stay on budget and keep delivering results.'
      : 'We\'re on the right track. Keep building and I\'ll keep the checkbook open.';
  }
  if (confidence >= 55) {
    return 'The season is going reasonably well, but I expect more. Stay focused on the goals.';
  }
  if (confidence >= 40) {
    return 'I\'m watching the standings closely. We need to pick it up before it\'s too late.';
  }
  if (confidence >= 25) {
    return 'This is not good enough. I need to see significant improvement, or changes will be made.';
  }
  return 'I am extremely disappointed. If things don\'t turn around immediately, roster moves will happen.';
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel() {
  const { history } = useGoalsStore();

  if (history.length === 0) return null;

  return (
    <Panel title="Season History">
      <div className="space-y-3">
        {history.map(entry => (
          <div key={entry.year} className="flex items-start gap-3 py-2 border-b border-navy-lighter/20 last:border-0">
            <div className="text-center shrink-0">
              <p className="font-display text-sm text-cream-dim">{entry.year}</p>
              <p className={cn('font-display text-2xl font-bold', gradeColor(entry.ownerGrade))}>
                {entry.ownerGrade}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-cream-dim/60 italic mb-1">&ldquo;{entry.ownerNote}&rdquo;</p>
              <div className="flex flex-wrap gap-2">
                {entry.goals.map(g => (
                  <span
                    key={g.id}
                    className={cn(
                      'font-mono text-[10px] px-1.5 py-0.5 rounded border',
                      g.met
                        ? 'text-green-light border-green-light/30 bg-green-light/5'
                        : 'text-red-400/70 border-red-500/20 bg-red-900/5',
                    )}
                  >
                    {g.met ? '✓' : '✗'} {g.description}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GoalsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();
  const { playerStats } = useStatsStore();
  const { goals, owner, initSeason, updateProgress } = useGoalsStore();

  // Auto-initialize goals if not set for current season
  useEffect(() => {
    if (!season || !engine || !userTeamId) return;
    if (goals.length === 0) {
      const team = engine.getTeam(userTeamId);
      if (!team) return;
      const rec = season.standings.getRecord(userTeamId) ?? { wins: 0, losses: 0 };
      const divStandings = season.standings.getDivisionStandings();
      let divisionRank = 1;
      let totalTeamsInDiv = 5;
      for (const div of divStandings) {
        const idx = div.teams.findIndex(t => t.teamId === userTeamId);
        if (idx >= 0) {
          divisionRank = idx + 1;
          totalTeamsInDiv = div.teams.length;
          break;
        }
      }
      initSeason({
        year: season.year,
        teamCity: team.city,
        teamName: team.name,
        lastSeasonWins: rec.wins || 72,
        lastSeasonLosses: rec.losses || 90,
        divisionRank,
        totalTeamsInDiv,
      });
    }
  }, [season, engine, userTeamId, goals.length, initSeason]);

  // Update progress whenever standings change
  useEffect(() => {
    if (!season || !engine || !userTeamId || goals.length === 0) return;

    const rec = season.standings.getRecord(userTeamId) ?? { wins: 0, losses: 0 };
    const gamesPlayed = rec.wins + rec.losses;

    // Determine division rank and if in playoffs/division lead
    const divStandings = season.standings.getDivisionStandings();
    let divisionRank = 1;
    let totalTeamsInDiv = 5;
    let wonDivision = false;
    for (const div of divStandings) {
      const idx = div.teams.findIndex(t => t.teamId === userTeamId);
      if (idx >= 0) {
        divisionRank = idx + 1;
        totalTeamsInDiv = div.teams.length;
        wonDivision = idx === 0;
        break;
      }
    }

    // Simple "in playoffs" check — use leagueRankings, top 4
    const leagueStructure = engine.getLeagueStructure();
    let inPlayoffs = false;
    for (const [leagueName] of Object.entries(leagueStructure)) {
      const rankings = season.standings.getLeagueRankings(leagueName);
      if (rankings.some(r => r.teamId === userTeamId)) {
        inPlayoffs = rankings.slice(0, 4).some(r => r.teamId === userTeamId);
        break;
      }
    }

    // Team ERA from pitcher stats
    const pitcherStats = Object.values(playerStats).filter(ps =>
      ps.position === 'P' && ps.teamId === userTeamId && ps.pitching.ip > 0
    );
    const totalER = pitcherStats.reduce((s, ps) => s + ps.pitching.er, 0);
    const totalIP = pitcherStats.reduce((s, ps) => s + ps.pitching.ip, 0);
    const teamERA = totalIP > 0 ? (totalER / (totalIP / 3)) * 9 : 0;

    // Team BA
    const batterStats = Object.values(playerStats).filter(ps =>
      ps.position !== 'P' && ps.teamId === userTeamId && ps.batting.ab > 0
    );
    const totalH = batterStats.reduce((s, ps) => s + ps.batting.h, 0);
    const totalAB = batterStats.reduce((s, ps) => s + ps.batting.ab, 0);
    const teamBA = totalAB > 0 ? totalH / totalAB : 0;

    // Streak
    const gameLog = season.schedule
      .filter(g => g.played && (g.awayId === userTeamId || g.homeId === userTeamId))
      .sort((a, b) => a.date - b.date);
    let maxStreak = 0;
    let currentStreak = 0;
    for (const g of gameLog) {
      const isHome = g.homeId === userTeamId;
      const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      if (myScore > oppScore) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Top prospect OVR from minors
    const allMinorPlayers = engine.getAllTeams().flatMap(t => t.roster.players).filter(p =>
      p.age <= 25
    );
    const topProspectOvr = allMinorPlayers.length > 0
      ? Math.max(...allMinorPlayers.map(p => {
          // Use batting composite for position players, pitching for pitchers
          const b = p.batting;
          const pi = p.pitching;
          if (p.position === 'P') return Math.round((pi.stuff + pi.movement + pi.control + pi.stamina) / 4);
          return Math.round((b.contact_L + b.contact_R + b.power_L + b.power_R + b.eye + b.speed) / 6);
        }))
      : 0;

    updateProgress({
      currentWins: rec.wins,
      currentLosses: rec.losses,
      gamesPlayed,
      totalGames: season.totalDays,
      inPlayoffs,
      wonDivision,
      divisionRank,
      totalTeamsInDiv,
      teamERA,
      teamBA,
      currentStreak,
      maxStreak,
      topProspectOvr,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.standings, season?.currentDay]);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Owner's Office</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Track your season goals, manage ownership expectations, and review your annual performance grade.
        </p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const team = engine.getTeam(userTeamId);
  const rec = season.standings.getRecord(userTeamId) ?? { wins: 0, losses: 0 };
  const gamesPlayed = rec.wins + rec.losses;
  const gamesRemaining = season.totalDays - season.currentDay;
  const seasonPct = Math.round((gamesPlayed / season.totalDays) * 100);

  const primaryGoal = goals.find(g => g.priority === 'primary');
  const secondaryGoal = goals.find(g => g.priority === 'secondary');
  const bonusGoal = goals.find(g => g.priority === 'bonus');
  const metCount = goals.filter(g => g.met).length;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Owner's Office</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {season.year} Season Goals — {team ? `${team.city} ${team.name}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-cream">{rec.wins}–{rec.losses}</p>
          <p className="font-mono text-xs text-cream-dim/60">{gamesPlayed}G played · {gamesRemaining} remaining</p>
        </div>
      </div>

      {/* Season progress */}
      <div className="mb-6">
        <div className="flex justify-between font-mono text-xs text-cream-dim/50 mb-1">
          <span>Season Progress</span>
          <span>{seasonPct}% complete</span>
        </div>
        <div className="h-1.5 bg-navy-lighter/40 rounded-full overflow-hidden">
          <div className="h-full bg-gold/40 rounded-full transition-all" style={{ width: `${seasonPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Owner + quick status */}
        <div className="space-y-4">
          {owner && <OwnerPanel owner={owner} />}

          {/* Goals summary badge */}
          <div className="p-4 rounded-xl border border-navy-lighter bg-navy-light/30 space-y-2">
            <p className="font-mono text-xs uppercase tracking-widest text-cream-dim/50">Season Summary</p>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-display font-bold text-gold">{metCount}</div>
              <div>
                <p className="font-mono text-cream text-sm">of {goals.length} goals met</p>
                <p className="font-mono text-cream-dim/50 text-xs">{goals.length - metCount} remaining</p>
              </div>
            </div>
            <div className="flex gap-1">
              {goals.map(g => (
                <div
                  key={g.id}
                  title={g.description}
                  className={cn(
                    'flex-1 h-2 rounded-full transition-all',
                    g.met ? 'bg-green-light' : g.failed ? 'bg-red-400/60' : 'bg-navy-lighter',
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Goals */}
        <div className="lg:col-span-2 space-y-4">
          {primaryGoal && <GoalCard goal={primaryGoal} />}
          {secondaryGoal && <GoalCard goal={secondaryGoal} />}
          {bonusGoal && <GoalCard goal={bonusGoal} />}

          {goals.length === 0 && (
            <Panel>
              <div className="text-center py-10">
                <p className="font-display text-gold text-lg mb-2">No Goals Set</p>
                <p className="font-mono text-cream-dim text-sm">
                  Start the season to receive your owner's goals.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: '📊', label: 'Standings', path: '/franchise/standings' },
          { icon: '👥', label: 'Manage Roster', path: '/franchise/roster' },
          { icon: '💰', label: 'Payroll', path: '/franchise/payroll' },
          { icon: '📈', label: 'Analytics', path: '/franchise/team-analytics' },
        ].map(({ icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-navy-lighter hover:border-gold/40 bg-navy-light/30 hover:bg-navy-light/60 transition-all cursor-pointer"
          >
            <span className="text-xl">{icon}</span>
            <span className="font-mono text-xs text-cream-dim">{label}</span>
          </button>
        ))}
      </div>

      {/* History */}
      <div className="mt-6">
        <HistoryPanel />
      </div>
    </div>
  );
}
