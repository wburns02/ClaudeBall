/**
 * FranchiseOverviewPage — comprehensive "State of the Union" for your franchise.
 * Aggregates data from across all 19 features into one executive summary.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useCoachingStore } from '@/stores/coachingStore.ts';
import { useAchievementStore } from '@/stores/achievementStore.ts';
import { useMoraleStore } from '@/stores/moraleStore.ts';
import { useGoalsStore } from '@/stores/goalsStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';

function StatCard({ label, value, color, subtitle, onClick }: { label: string; value: string | number; color?: string; subtitle?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-center p-3 rounded-xl border transition-all',
        onClick ? 'cursor-pointer hover:border-gold/40 hover:bg-gold/5' : '',
        'border-navy-lighter/30 bg-navy-lighter/10',
      )}
    >
      <p className={cn('font-display text-2xl font-bold', color ?? 'text-cream')}>{value}</p>
      <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider mt-0.5">{label}</p>
      {subtitle && <p className="font-mono text-[8px] text-cream-dim/30 mt-0.5">{subtitle}</p>}
    </button>
  );
}

function GradeBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? '#22c55e' : pct >= 50 ? '#d4a843' : pct >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="font-mono text-[10px] text-cream-dim/60 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[10px] font-bold w-8 text-right" style={{ color }}>{Math.round(value)}</span>
    </div>
  );
}

export function FranchiseOverviewPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId, tradeLog } = useFranchiseStore();
  const getCurrentSeasonStats = useStatsStore(s => s.getCurrentSeasonStats);
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);
  const { staff, staffBonus } = useCoachingStore();
  const { getProgress } = useAchievementStore();
  const moraleData = useMoraleStore(s => s.playerMorales);
  const goals = useGoalsStore(s => s.goals ?? []);

  const team = useMemo(() => {
    if (!engine || !userTeamId) return null;
    return engine.getTeam(userTeamId) ?? null;
  }, [engine, userTeamId]);

  if (!team || !season || !engine) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Franchise Overview</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          A comprehensive snapshot of your entire franchise — record, roster, coaching, finances, and more.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const rec = season.standings.getRecord(userTeamId!);
  const wins = rec?.wins ?? 0;
  const losses = rec?.losses ?? 0;
  const pct = wins + losses > 0 ? (wins / (wins + losses)).toFixed(3) : '.000';

  // Team OVR
  const batters = team.roster.players.filter(p => p.position !== 'P');
  const pitchers = team.roster.players.filter(p => p.position === 'P');
  const offOvr = batters.length > 0 ? Math.round(batters.reduce((s, p) => s + evaluatePlayer(p), 0) / batters.length) : 0;
  const pitOvr = pitchers.length > 0 ? Math.round(pitchers.reduce((s, p) => s + evaluatePlayer(p), 0) / pitchers.length) : 0;
  const teamOvr = Math.round((offOvr + pitOvr) / 2);

  // Best player
  const bestPlayer = team.roster.players.reduce((best, p) => evaluatePlayer(p) > evaluatePlayer(best) ? p : best, team.roster.players[0]!);
  const bestOvr = Math.round(evaluatePlayer(bestPlayer));

  // Coaching
  const coachCount = staff.length;
  const coachOvr = coachCount > 0 ? Math.round(staff.reduce((s, c) => s + (c.ratings.teaching + c.ratings.strategy + c.ratings.motivation + c.ratings.evaluation) / 4, 0) / coachCount) : 0;

  // Achievements
  const achProgress = getProgress();

  // Morale average
  const moraleValues = Object.values(moraleData) as number[];
  const avgMorale = moraleValues.length > 0 ? Math.round(moraleValues.reduce((s: number, v: number) => s + v, 0) / moraleValues.length) : 50;

  // Goals progress
  const completedGoals = goals.filter((g: any) => g.status === 'completed').length;

  // Trade deadline
  const DEADLINE = 120;
  const daysToDeadline = Math.max(0, DEADLINE - season.currentDay);
  const deadlinePassed = season.currentDay > DEADLINE;

  // Stats leaders on your team
  const teamStats = Object.values(playerStats).filter(ps => ps.teamId === userTeamId);
  const hrLeader = teamStats.filter(ps => ps.position !== 'P').sort((a, b) => b.batting.hr - a.batting.hr)[0];
  const eraLeader = teamStats.filter(ps => ps.pitching.ip >= 10).sort((a, b) => {
    const eA = a.pitching.ip > 0 ? (a.pitching.er / a.pitching.ip) * 9 : 99;
    const eB = b.pitching.ip > 0 ? (b.pitching.er / b.pitching.ip) * 9 : 99;
    return eA - eB;
  })[0];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <p className="font-mono text-[10px] text-gold/50 uppercase tracking-[0.3em]">{season.year} Season</p>
        <h1 className="font-display text-4xl text-gold uppercase tracking-wide">{team.city} {team.name}</h1>
        <p className="font-mono text-cream-dim text-sm">
          Day {season.currentDay} of {season.totalDays} · Franchise Overview
        </p>
        <div className="w-24 h-0.5 bg-gold/30 mx-auto" />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Record" value={`${wins}-${losses}`} color="text-gold" subtitle={pct} onClick={() => navigate('/franchise/standings')} />
        <StatCard label="Team OVR" value={teamOvr} color={teamOvr >= 65 ? 'text-green-light' : teamOvr >= 50 ? 'text-cream' : 'text-red-400'} onClick={() => navigate('/franchise/roster')} />
        <StatCard label="Roster" value={team.roster.players.length} subtitle={`${batters.length}B / ${pitchers.length}P`} onClick={() => navigate('/franchise/roster')} />
        <StatCard label="Achievements" value={`${achProgress.unlocked}/${achProgress.total}`} subtitle={`${achProgress.pct}%`} color="text-gold" onClick={() => navigate('/achievements')} />
      </div>

      {/* Ratings Breakdown */}
      <Panel title="Team Ratings">
        <GradeBar label="Offense" value={offOvr} />
        <GradeBar label="Pitching" value={pitOvr} />
        <GradeBar label="Overall" value={teamOvr} />
        <GradeBar label="Morale" value={avgMorale} />
        <GradeBar label="Coaching" value={coachOvr} />
      </Panel>

      {/* Two-column: Stars + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Stars */}
        <Panel title="Team Stars">
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded bg-gold/5 border border-gold/20">
              <span className="font-mono text-xs text-gold font-bold w-8">{bestOvr}</span>
              <span className="font-body text-sm text-gold">{getPlayerName(bestPlayer)}</span>
              <span className="font-mono text-[10px] text-cream-dim/50 ml-auto">{bestPlayer.position} - Best OVR</span>
            </div>
            {hrLeader && hrLeader.batting.hr > 0 && (
              <div className="flex items-center gap-2 p-2 rounded bg-navy-lighter/10 border border-navy-lighter/20">
                <span className="font-mono text-xs text-cream font-bold w-8">{hrLeader.batting.hr}</span>
                <span className="font-body text-sm text-cream">{hrLeader.playerName}</span>
                <span className="font-mono text-[10px] text-cream-dim/50 ml-auto">HR Leader</span>
              </div>
            )}
            {eraLeader && eraLeader.pitching.ip > 0 && (
              <div className="flex items-center gap-2 p-2 rounded bg-navy-lighter/10 border border-navy-lighter/20">
                <span className="font-mono text-xs text-cream font-bold w-8">{(eraLeader.pitching.er / eraLeader.pitching.ip * 9).toFixed(2)}</span>
                <span className="font-body text-sm text-cream">{eraLeader.playerName}</span>
                <span className="font-mono text-[10px] text-cream-dim/50 ml-auto">ERA Leader</span>
              </div>
            )}
          </div>
        </Panel>

        {/* Status Dashboard */}
        <Panel title="Franchise Status">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded bg-navy-lighter/10 border border-navy-lighter/20">
              <span className="font-mono text-xs text-cream-dim">Coaching Staff</span>
              <span className="font-mono text-xs text-cream">{coachCount}/7 hired</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-navy-lighter/10 border border-navy-lighter/20">
              <span className="font-mono text-xs text-cream-dim">Trade Deadline</span>
              <span className={cn('font-mono text-xs', deadlinePassed ? 'text-red-400' : daysToDeadline <= 10 ? 'text-gold' : 'text-cream')}>
                {deadlinePassed ? 'Passed' : `${daysToDeadline} days`}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-navy-lighter/10 border border-navy-lighter/20">
              <span className="font-mono text-xs text-cream-dim">League Trades</span>
              <span className="font-mono text-xs text-cream">{tradeLog.length} this season</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-navy-lighter/10 border border-navy-lighter/20">
              <span className="font-mono text-xs text-cream-dim">Goals Completed</span>
              <span className="font-mono text-xs text-cream">{completedGoals}/{goals.length}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Quick Navigation */}
      <Panel title="Quick Access">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {[
            { label: 'Roster', path: '/franchise/roster' },
            { label: 'Trade Machine', path: '/franchise/trade-machine' },
            { label: 'Trade Deadline', path: '/franchise/trade-deadline' },
            { label: 'Coaching Staff', path: '/franchise/coaching-staff' },
            { label: 'Sim Projection', path: '/franchise/sim-projection' },
            { label: 'Team Compare', path: '/franchise/team-compare' },
            { label: 'Season Story', path: '/franchise/season-story' },
            { label: 'Achievements', path: '/achievements' },
          ].map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="px-3 py-2 rounded-lg border border-navy-lighter/30 text-cream-dim text-xs font-mono hover:border-gold/30 hover:text-gold hover:bg-gold/5 transition-all cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
