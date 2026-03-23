import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { battingAvg, era } from '@/engine/types/stats.ts';
import {
  calcBattingAdvanced, calcPitchingAdvanced,
  deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT,
} from '@/engine/stats/AdvancedStats.ts';
import { winPct } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

// ── Grading ──────────────────────────────────────────────────────────────────

interface GradeInfo {
  grade: string;
  score: number; // 0-100
  color: string;
  bgColor: string;
  borderColor: string;
}

function toGrade(score: number): GradeInfo {
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' :
    score >= 50 ? 'C+' : score >= 40 ? 'C' : score >= 30 ? 'D' : 'F';
  const color = score >= 80 ? 'text-gold' : score >= 60 ? 'text-green-light' : score >= 40 ? 'text-cream' : score >= 25 ? 'text-orange-400' : 'text-red-400';
  const bgColor = score >= 80 ? 'bg-gold/10' : score >= 60 ? 'bg-green-light/5' : score >= 40 ? 'bg-cream/5' : 'bg-red-400/5';
  const borderColor = score >= 80 ? 'border-gold/40' : score >= 60 ? 'border-green-light/30' : score >= 40 ? 'border-cream/20' : 'border-red-400/30';
  return { grade, score, color, bgColor, borderColor };
}

function GradeRing({ info, label, sublabel, size = 'lg' }: { info: GradeInfo; label: string; sublabel?: string; size?: 'sm' | 'lg' }) {
  const radius = size === 'lg' ? 38 : 24;
  const stroke = size === 'lg' ? 4 : 3;
  const circumference = 2 * Math.PI * radius;
  const progress = (info.score / 100) * circumference;
  const dim = (radius + stroke) * 2;

  const ringColor = info.score >= 80 ? '#d4a843' : info.score >= 60 ? '#4ade80' : info.score >= 40 ? '#e8e0d4' : info.score >= 25 ? '#fb923c' : '#f87171';

  return (
    <div className="text-center">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="mx-auto">
        <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke={ringColor} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          className="transition-all duration-700"
        />
        <text x={dim / 2} y={dim / 2 + (size === 'lg' ? 8 : 5)} textAnchor="middle"
          className={cn('font-display font-bold', info.color)}
          style={{ fontSize: size === 'lg' ? 22 : 14 }}
        >
          {info.grade}
        </text>
      </svg>
      <p className="font-mono text-xs text-cream mt-1">{label}</p>
      {sublabel && <p className="font-mono text-[10px] text-cream-dim/40">{sublabel}</p>}
    </div>
  );
}

function StatBar({ label, value, max = 100, color = 'bg-gold' }: { label: string; value: number; max?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-cream-dim/50 w-20 shrink-0 uppercase">{label}</span>
      <div className="flex-1 h-2 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <span className="font-mono text-xs text-cream-dim w-8 text-right shrink-0">{Math.round(value)}</span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function FranchiseReportCard() {
  const navigate = useNavigate();
  const { engine, userTeamId, season, teams } = useFranchiseStore();
  const playerStats = useStatsStore(s => s.playerStats);

  if (!engine || !userTeamId || !season) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Franchise Report Card</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Your GM's comprehensive assessment — grades for every area of your franchise.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  const roster = userTeam?.roster.players ?? [];
  const userRecord = season.standings.getRecord(userTeamId);
  const gamesPlayed = userRecord ? userRecord.wins + userRecord.losses : 0;

  // League context
  const leagueCtx = useMemo(() => {
    const all = Object.values(playerStats);
    if (all.length === 0) return DEFAULT_LEAGUE_CONTEXT;
    let tAB = 0, tPA = 0, tH = 0, tD = 0, tT = 0, tHR = 0, tBB = 0, tHBP = 0, tSF = 0, tSO = 0, tR = 0, tER = 0, tIP = 0;
    for (const p of all) {
      tAB += p.batting.ab; tPA += p.batting.pa; tH += p.batting.h; tD += p.batting.doubles;
      tT += p.batting.triples; tHR += p.batting.hr; tBB += p.batting.bb; tHBP += p.batting.hbp;
      tSF += p.batting.sf; tSO += p.batting.so; tR += p.batting.r; tER += p.pitching.er; tIP += p.pitching.ip;
    }
    return deriveLeagueContext(tAB, tPA, tH, tD, tT, tHR, tBB, tHBP, tSF, tSO, tR, 0, tER, tIP);
  }, [playerStats]);

  // === GRADE CALCULATIONS ===

  // Overall Record Grade
  const overallScore = useMemo(() => {
    if (!userRecord || gamesPlayed < 5) return 50;
    const wpct = userRecord.wins / gamesPlayed;
    return Math.min(100, Math.round(wpct * 150)); // .667 = 100, .500 = 75, .333 = 50
  }, [userRecord, gamesPlayed]);

  // Hitting Grade
  const hittingScore = useMemo(() => {
    const teamBatters = Object.values(playerStats).filter(ps => ps.teamId === userTeamId && ps.position !== 'P' && ps.batting.pa >= 20);
    if (teamBatters.length === 0) return 50;
    const avgWrc = teamBatters.reduce((sum, ps) => sum + calcBattingAdvanced(ps.batting, leagueCtx, ps.position).wrcPlus, 0) / teamBatters.length;
    return Math.min(100, Math.round(avgWrc)); // 100 wRC+ = 100 score
  }, [playerStats, userTeamId, leagueCtx]);

  // Pitching Grade
  const pitchingScore = useMemo(() => {
    const teamPitchers = Object.values(playerStats).filter(ps => ps.teamId === userTeamId && ps.position === 'P' && ps.pitching.ip >= 9);
    if (teamPitchers.length === 0) return 50;
    const avgEraPlus = teamPitchers.reduce((sum, ps) => sum + calcPitchingAdvanced(ps.pitching, leagueCtx).eraPlus, 0) / teamPitchers.length;
    return Math.min(100, Math.round(avgEraPlus)); // 100 ERA+ = 100 score
  }, [playerStats, userTeamId, leagueCtx]);

  // Roster Depth Grade
  const depthScore = useMemo(() => {
    const posPlayers = roster.filter(p => p.position !== 'P');
    const pitchers = roster.filter(p => p.position === 'P');
    const avgOvr = roster.reduce((sum, p) => sum + evaluatePlayer(p), 0) / Math.max(1, roster.length);
    const posCount = new Set(posPlayers.map(p => p.position)).size;
    const score = Math.min(100, Math.round(avgOvr + (posCount >= 8 ? 10 : 0) + (pitchers.length >= 10 ? 10 : 0)));
    return score;
  }, [roster]);

  // Youth/Future Grade
  const youthScore = useMemo(() => {
    const youngPlayers = roster.filter(p => p.age <= 26);
    const youngPct = youngPlayers.length / Math.max(1, roster.length);
    const avgYoungOvr = youngPlayers.length > 0 ? youngPlayers.reduce((sum, p) => sum + evaluatePlayer(p), 0) / youngPlayers.length : 0;
    return Math.min(100, Math.round(youngPct * 80 + avgYoungOvr * 0.3));
  }, [roster]);

  // Financial Health Grade
  const financialScore = useMemo(() => {
    const budget = useFranchiseStore.getState().teamBudgets[userTeamId] ?? 150000;
    const payroll = useFranchiseStore.getState().getTeamPayroll(userTeamId);
    const ratio = payroll > 0 ? payroll / budget : 0;
    if (ratio <= 0.7) return 90; // Under budget
    if (ratio <= 0.85) return 75;
    if (ratio <= 0.95) return 60;
    if (ratio <= 1.0) return 45;
    return 25; // Over budget
  }, [userTeamId]);

  const grades = {
    overall: toGrade(overallScore),
    hitting: toGrade(hittingScore),
    pitching: toGrade(pitchingScore),
    depth: toGrade(depthScore),
    youth: toGrade(youthScore),
    financial: toGrade(financialScore),
  };

  // Combined GPA (weighted average)
  const gpa = Math.round((overallScore * 0.3 + hittingScore * 0.2 + pitchingScore * 0.2 + depthScore * 0.1 + youthScore * 0.1 + financialScore * 0.1));
  const overallGrade = toGrade(gpa);

  // Division ranking
  const divs = season.standings.getDivisionStandings();
  const userDiv = divs.find((d: any) => d.teams.some((t: any) => t.teamId === userTeamId));
  const divRank = userDiv ? userDiv.teams.findIndex((t: any) => t.teamId === userTeamId) + 1 : 0;

  // League ranking (all teams by record)
  const allRecords = teams.map(t => ({
    teamId: t.id,
    abbr: t.abbreviation,
    record: season.standings.getRecord(t.id),
  })).filter(r => r.record).sort((a, b) => {
    const aPct = a.record!.wins / Math.max(1, a.record!.wins + a.record!.losses);
    const bPct = b.record!.wins / Math.max(1, b.record!.wins + b.record!.losses);
    return bPct - aPct;
  });
  const leagueRank = allRecords.findIndex(r => r.teamId === userTeamId) + 1;

  // Strengths and weaknesses
  const areas = [
    { name: 'Hitting', score: hittingScore, link: '/franchise/leaders' },
    { name: 'Pitching', score: pitchingScore, link: '/franchise/leaders' },
    { name: 'Roster Depth', score: depthScore, link: '/franchise/depth-chart' },
    { name: 'Youth & Future', score: youthScore, link: '/franchise/projections' },
    { name: 'Financial Health', score: financialScore, link: '/franchise/finances' },
  ].sort((a, b) => b.score - a.score);

  const strengths = areas.slice(0, 2);
  const weaknesses = areas.slice(-2).reverse();

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="font-mono text-cream-dim/40 text-xs uppercase tracking-widest mb-2">
          {season.year} Franchise Assessment
        </p>
        <h1 className="font-display text-4xl text-gold tracking-wide uppercase mb-1">
          Report Card
        </h1>
        <p className="font-mono text-cream-dim text-sm">
          {userTeam?.city} {userTeam?.name}
          {userRecord && ` · ${userRecord.wins}-${userRecord.losses}`}
          {leagueRank > 0 && ` · #${leagueRank} in league`}
        </p>
      </div>

      {/* Overall Grade */}
      <div className="flex justify-center mb-8">
        <GradeRing info={overallGrade} label="Overall" sublabel={`Score: ${gpa}/100`} />
      </div>

      {/* Grade Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { info: grades.overall, label: 'Record', sub: userRecord ? `${userRecord.wins}-${userRecord.losses}` : '—' },
          { info: grades.hitting, label: 'Hitting', sub: `${hittingScore} wRC+` },
          { info: grades.pitching, label: 'Pitching', sub: `${pitchingScore} ERA+` },
          { info: grades.depth, label: 'Depth', sub: `${roster.length} players` },
          { info: grades.youth, label: 'Youth', sub: `${roster.filter(p => p.age <= 26).length} young` },
          { info: grades.financial, label: 'Finance', sub: `${financialScore >= 60 ? 'Healthy' : 'Tight'}` },
        ].map(({ info, label, sub }) => (
          <div key={label} className={cn('rounded-lg border px-3 py-3 text-center', info.borderColor, info.bgColor)}>
            <p className={cn('font-display text-2xl font-bold', info.color)}>{info.grade}</p>
            <p className="font-mono text-xs text-cream mt-0.5">{label}</p>
            <p className="font-mono text-[9px] text-cream-dim/40">{sub}</p>
          </div>
        ))}
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Panel title="Strengths">
          {strengths.map(s => (
            <button
              key={s.name}
              onClick={() => navigate(s.link)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-green-light/5 transition-colors cursor-pointer mb-1"
            >
              <div className="flex items-center gap-3">
                <span className="text-green-light text-sm">+</span>
                <span className="font-body text-sm text-cream">{s.name}</span>
              </div>
              <span className={cn('font-mono text-sm font-bold', toGrade(s.score).color)}>{toGrade(s.score).grade}</span>
            </button>
          ))}
        </Panel>

        <Panel title="Needs Improvement">
          {weaknesses.map(s => (
            <button
              key={s.name}
              onClick={() => navigate(s.link)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-red-400/5 transition-colors cursor-pointer mb-1"
            >
              <div className="flex items-center gap-3">
                <span className="text-red-400 text-sm">!</span>
                <span className="font-body text-sm text-cream">{s.name}</span>
              </div>
              <span className={cn('font-mono text-sm font-bold', toGrade(s.score).color)}>{toGrade(s.score).grade}</span>
            </button>
          ))}
        </Panel>
      </div>

      {/* Skill Breakdown Bars */}
      <Panel title="Detailed Breakdown" className="mb-6">
        <div className="space-y-2.5">
          <StatBar label="Record" value={overallScore} color={grades.overall.score >= 60 ? 'bg-gold' : 'bg-cream-dim'} />
          <StatBar label="Hitting" value={hittingScore} color={grades.hitting.score >= 60 ? 'bg-green-light' : 'bg-cream-dim'} />
          <StatBar label="Pitching" value={pitchingScore} color={grades.pitching.score >= 60 ? 'bg-blue-400' : 'bg-cream-dim'} />
          <StatBar label="Depth" value={depthScore} color={grades.depth.score >= 60 ? 'bg-cream' : 'bg-cream-dim'} />
          <StatBar label="Youth" value={youthScore} color={grades.youth.score >= 60 ? 'bg-green-light' : 'bg-cream-dim'} />
          <StatBar label="Finance" value={financialScore} color={grades.financial.score >= 60 ? 'bg-gold' : 'bg-cream-dim'} />
        </div>
      </Panel>

      {/* Quick Links */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/franchise/season-review')}>Season Review</Button>
        <Button variant="ghost" onClick={() => navigate('/franchise/war')}>WAR Dashboard</Button>
        <Button variant="ghost" onClick={() => navigate('/franchise/projections')}>Projections</Button>
        <Button variant="ghost" onClick={() => navigate('/franchise/trade-machine')}>Trade Machine</Button>
        <Button onClick={() => navigate('/franchise')}>Dashboard</Button>
      </div>
    </div>
  );
}
