import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useHistoryStore } from '@/stores/historyStore.ts';
import { useScoutingStore } from '@/stores/scoutingStore.ts';
import {
  battingAvg, onBasePct, slugging, era, whip, formatIP,
} from '@/engine/types/stats.ts';
import {
  calcBattingAdvanced, calcPitchingAdvanced, deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT,
  fmtAvg, fmtStat, POSITION_ADJ,
} from '@/engine/stats/AdvancedStats.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { cn } from '@/lib/cn.ts';
import type { ReactElement } from 'react';

// ─── Career Arc Projection ──────────────────────────────────────────────────

function ovrDeltaForAge(age: number, workEthic: number): number {
  const ethics = workEthic / 100;
  if (age <= 26) {
    const growthBase = 6 - (age - 20) * 0.5;
    return Math.max(0.5, growthBase * 0.7 * ethics + 1);
  }
  if (age <= 31) return 0; // peak — flat
  if (age <= 36) {
    const declineBase = 1 + (age - 31) * 0.3;
    return -(declineBase * (1 - ethics * 0.25));
  }
  const steep = 2 + (age - 36) * 0.5;
  return -(steep + 1);
}

function buildCareerArc(
  currentAge: number, currentOvr: number, workEthic: number,
): Array<{ age: number; ovr: number; phase: string }> {
  const MIN_AGE = Math.max(18, currentAge - 5);
  const MAX_AGE = Math.min(42, currentAge + 15);
  const points: Array<{ age: number; ovr: number; phase: string }> = [];

  function phaseFor(age: number): string {
    if (age <= 26) return 'growth';
    if (age <= 31) return 'peak';
    if (age <= 36) return 'decline';
    return 'steep';
  }

  // Build forward from current age
  let ovr = currentOvr;
  for (let age = currentAge; age <= MAX_AGE; age++) {
    points.push({ age, ovr: Math.max(20, Math.min(99, Math.round(ovr))), phase: phaseFor(age) });
    ovr += ovrDeltaForAge(age, workEthic);
  }

  // Build backward from current age (reverse the deltas)
  ovr = currentOvr;
  for (let age = currentAge - 1; age >= MIN_AGE; age--) {
    ovr -= ovrDeltaForAge(age, workEthic);
    points.unshift({ age, ovr: Math.max(20, Math.min(99, Math.round(ovr))), phase: phaseFor(age) });
  }

  return points;
}

function CareerArcChart({
  currentAge, currentOvr, workEthic,
}: { currentAge: number; currentOvr: number; workEthic: number }): ReactElement {
  const points = useMemo(
    () => buildCareerArc(currentAge, currentOvr, workEthic),
    [currentAge, currentOvr, workEthic],
  );

  const peakPoint = points.reduce((best, p) => p.ovr > best.ovr ? p : best, points[0]);
  const minOvr = Math.min(...points.map(p => p.ovr));
  const maxOvr = Math.max(...points.map(p => p.ovr));
  const ovrRange = Math.max(20, maxOvr - minOvr + 10);
  const ovrMin = Math.max(20, minOvr - 5);

  // SVG dimensions
  const W = 280; const H = 130;
  const PAD = { l: 28, r: 8, t: 8, b: 18 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const ages = points.map(p => p.age);
  const ageMin = ages[0]; const ageMax = ages[ages.length - 1];
  const ageRange = ageMax - ageMin || 1;

  const xOf = (age: number) => PAD.l + ((age - ageMin) / ageRange) * innerW;
  const yOf = (ovr: number) => PAD.t + innerH - ((ovr - ovrMin) / ovrRange) * innerH;

  const currentX = xOf(currentAge);
  const currentY = yOf(currentOvr);
  const peakX = xOf(peakPoint.age);
  const peakY = yOf(peakPoint.ovr);

  // Build SVG polyline points
  const linePoints = points.map(p => `${xOf(p.age).toFixed(1)},${yOf(p.ovr).toFixed(1)}`).join(' ');
  // Build area fill path (line + bottom)
  const areaPath = [
    `M ${xOf(points[0].age).toFixed(1)},${yOf(points[0].ovr).toFixed(1)}`,
    ...points.slice(1).map(p => `L ${xOf(p.age).toFixed(1)},${yOf(p.ovr).toFixed(1)}`),
    `L ${xOf(points[points.length - 1].age).toFixed(1)},${(PAD.t + innerH).toFixed(1)}`,
    `L ${xOf(points[0].age).toFixed(1)},${(PAD.t + innerH).toFixed(1)}`,
    'Z',
  ].join(' ');

  // Phase background bands
  const phaseBands: Array<{ x1: number; x2: number; color: string }> = [];
  let bandStart = ageMin;
  let bandPhase = points[0].phase;
  for (const p of points) {
    if (p.phase !== bandPhase || p.age === ageMax) {
      const endAge = p.phase !== bandPhase ? p.age : ageMax + 1;
      const color = bandPhase === 'growth' ? '#22c55e18' : bandPhase === 'peak' ? '#d4a84318' : bandPhase === 'decline' ? '#f9731618' : '#ef444418';
      phaseBands.push({ x1: xOf(bandStart), x2: xOf(Math.min(endAge, ageMax + 1)), color });
      bandStart = p.age;
      bandPhase = p.phase;
    }
  }

  const isCurrentPeak = peakPoint.age === currentAge;
  const yearsToRetire = 40 - currentAge;
  const phase = currentAge <= 26 ? 'growth' : currentAge <= 31 ? 'peak' : currentAge <= 36 ? 'decline' : 'steep';
  const phaseColor = phase === 'growth' ? 'text-green-light' : phase === 'peak' ? 'text-gold' : phase === 'decline' ? 'text-orange-400' : 'text-red-400';
  const phaseLabel = phase === 'growth' ? 'Growth' : phase === 'peak' ? 'Prime' : phase === 'decline' ? 'Decline' : 'Steep Decline';

  return (
    <div>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center font-mono">
        <div className="bg-navy-lighter/30 rounded p-2">
          <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Age</p>
          <p className="text-cream text-sm font-bold">{currentAge}</p>
          <p className={cn('text-[9px] uppercase font-bold', phaseColor)}>{phaseLabel}</p>
        </div>
        <div className="bg-navy-lighter/30 rounded p-2">
          <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Peak OVR</p>
          <p className={cn('text-sm font-bold', isCurrentPeak ? 'text-gold' : 'text-green-light')}>
            {peakPoint.ovr}
          </p>
          <p className="text-[9px] text-cream-dim/50">Age {peakPoint.age}</p>
        </div>
        <div className="bg-navy-lighter/30 rounded p-2">
          <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Prime Yrs</p>
          <p className="text-cream text-sm font-bold">
            {Math.max(0, 32 - Math.max(27, currentAge))}
          </p>
          <p className="text-[9px] text-cream-dim/50">{yearsToRetire > 0 ? `~${yearsToRetire}y left` : 'Late career'}</p>
        </div>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        style={{ maxHeight: 130 }}
      >
        {/* Phase background bands */}
        {phaseBands.map((band, i) => (
          <rect
            key={i}
            x={band.x1}
            y={PAD.t}
            width={Math.max(0, band.x2 - band.x1)}
            height={innerH}
            fill={band.color}
          />
        ))}

        {/* Grid lines */}
        {[50, 60, 70, 80].map(ov => {
          if (ov < ovrMin || ov > ovrMin + ovrRange) return null;
          const y = yOf(ov);
          return (
            <g key={ov}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#ffffff12" strokeWidth="1" />
              <text x={PAD.l - 2} y={y + 3} fontSize="8" fill="#ffffff50" textAnchor="end">{ov}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="#d4a84308" />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#d4a843"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current age vertical line */}
        <line
          x1={currentX} y1={PAD.t}
          x2={currentX} y2={PAD.t + innerH}
          stroke="#d4a843"
          strokeWidth="1"
          strokeDasharray="2,2"
          opacity="0.5"
        />

        {/* Current position dot */}
        <circle cx={currentX} cy={currentY} r="3" fill="#d4a843" />

        {/* Peak marker (only if different from current) */}
        {!isCurrentPeak && peakPoint.age <= ageMax && (
          <>
            <circle cx={peakX} cy={peakY} r="2.5" fill="#22c55e" />
            <text x={peakX} y={peakY - 5} fontSize="6" fill="#22c55e80" textAnchor="middle">↑{peakPoint.ovr}</text>
          </>
        )}

        {/* Age axis labels */}
        {points
          .filter(p => p.age % 5 === 0)
          .map(p => (
            <text key={p.age} x={xOf(p.age)} y={H - 4} fontSize="8" fill="#ffffff55" textAnchor="middle">
              {p.age}
            </text>
          ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        {[
          { label: 'Growth', color: 'bg-green-light/40' },
          { label: 'Prime', color: 'bg-gold/40' },
          { label: 'Decline', color: 'bg-orange-400/40' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-sm', color)} />
            <span className="text-[9px] font-mono text-cream-dim/40">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gold" />
          <span className="text-[9px] font-mono text-cream-dim/40">Now</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-light" />
          <span className="text-[9px] font-mono text-cream-dim/40">Peak</span>
        </div>
      </div>
    </div>
  );
}

function RatingBar({ label, value, max = 100 }: { label: string; value: number; max?: number }): ReactElement {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color =
    value >= 75 ? 'bg-gold' :
    value >= 60 ? 'bg-green-light' :
    value >= 45 ? 'bg-cream-dim' :
    'bg-red';
  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      <span className="w-28 text-cream-dim text-xs text-right">{label}</span>
      <div className="flex-1 h-2 bg-navy-lighter rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-cream text-xs">{value}</span>
    </div>
  );
}

function GradeBar80({ label, grade, confidence }: { label: string; grade: number; confidence?: number }): ReactElement {
  const pct = ((grade - 20) / 60) * 100;
  const color = grade >= 70 ? 'bg-gold' : grade >= 60 ? 'bg-green-light' : grade >= 50 ? 'bg-cream-dim' : grade >= 40 ? 'bg-cream-dim/50' : 'bg-red/60';
  const textColor = grade >= 70 ? 'text-gold' : grade >= 60 ? 'text-green-light' : grade >= 50 ? 'text-cream' : grade >= 40 ? 'text-cream-dim' : 'text-red-400';
  const lbl = grade >= 80 ? 'ELITE' : grade >= 70 ? 'PLUS+' : grade >= 60 ? 'PLUS' : grade >= 50 ? 'AVG' : grade >= 40 ? 'BLW' : 'POOR';
  const opacity = confidence !== undefined ? Math.max(0.45, confidence / 100) : 1;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-cream-dim/50 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%`, opacity }} />
      </div>
      <span className={cn('text-xs font-mono font-bold w-5 text-right', textColor)}>{grade}</span>
      <span className="text-[9px] font-mono text-cream-dim/30 w-8">{lbl}</span>
    </div>
  );
}

function StatBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }): ReactElement {
  return (
    <div className={cn('text-center p-2 rounded', highlight ? 'bg-gold/10 border border-gold/30' : 'bg-navy-lighter/30')}>
      <p className="text-cream-dim text-xs uppercase tracking-wider font-mono">{label}</p>
      <p className={cn('text-lg font-mono font-bold mt-0.5', highlight ? 'text-gold' : 'text-cream')}>{value}</p>
    </div>
  );
}

export function PlayerStatsPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { getPlayerStats, leagueTotals } = useStatsStore();
  const { engine } = useFranchiseStore();
  const franchisePlayerHistory = useHistoryStore(s => s.franchisePlayerHistory);
  const hasCareerHistory = playerId ? franchisePlayerHistory.some(r => r.playerId === playerId) : false;

  const ps = useMemo(() => playerId ? getPlayerStats(playerId) : null, [playerId, getPlayerStats]);

  // Find player in engine for ratings
  const player = useMemo(() => {
    if (!playerId || !engine) return null;
    return engine.getAllTeams().flatMap(t => t.roster.players).find(p => p.id === playerId) ?? null;
  }, [playerId, engine]);

  const team = useMemo(() => {
    if (!ps || !engine) return null;
    return engine.getTeam(ps.teamId) ?? null;
  }, [ps, engine]);

  const leagueCtx = useMemo(() => {
    const lt = leagueTotals;
    if (lt.gamesPlayed === 0) return DEFAULT_LEAGUE_CONTEXT;
    return deriveLeagueContext(
      lt.totalAB, lt.totalPA, lt.totalH, lt.totalDoubles, lt.totalTriples,
      lt.totalHR, lt.totalBB, lt.totalHBP, lt.totalSF, lt.totalSO,
      lt.totalRuns, lt.gamesPlayed, lt.totalER, lt.totalIP,
      (lt as typeof lt & { totalGameRuns?: number }).totalGameRuns
    );
  }, [leagueTotals]);

  const isPitcher = player?.position === 'P' || (ps?.position === 'P');
  const posAdj = POSITION_ADJ[ps?.position ?? 'DH'] ?? 0;

  const battAdv = useMemo(() => {
    if (!ps) return null;
    return calcBattingAdvanced(ps.batting, leagueCtx, ps.position);
  }, [ps, leagueCtx]);

  const pitchAdv = useMemo(() => {
    if (!ps) return null;
    return calcPitchingAdvanced(ps.pitching, leagueCtx);
  }, [ps, leagueCtx]);

  const ovr = player ? Math.round(evaluatePlayer(player)) : null;

  const { getReport, scoutPlayer } = useScoutingStore();
  const { userTeamId } = useFranchiseStore();

  // Auto-scout own players so grades are always available on their profile
  useEffect(() => {
    if (!playerId || !player) return;
    // When ps is null (no stats yet), find team from engine
    const teamId = ps?.teamId ?? engine?.getAllTeams().find(t =>
      t.roster.players.some(p => p.id === playerId)
    )?.id ?? '';
    const isOwnPlayer = !!(userTeamId && teamId && teamId === userTeamId);
    if (isOwnPlayer && !getReport(playerId)) {
      scoutPlayer(playerId, teamId, true);
    }
  }, [playerId, player, ps?.teamId, userTeamId, getReport, scoutPlayer, engine]);

  const scoutReport = playerId ? getReport(playerId) : null;

  const contract = useMemo(() => {
    if (!playerId || !engine) return null;
    return engine.contractEngine.getContract(playerId) ?? null;
  }, [playerId, engine]);

  if (!ps) {
    // No in-game stats yet — show full ratings + scouting + contract if available
    if (player) {
      const isPitcherRatings = player.position === 'P';
      const ovrRatings = Math.round(evaluatePlayer(player));
      return (
        <div className="min-h-screen p-6 max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
                {player.firstName} {player.lastName}
              </h1>
              <div className="flex items-center gap-3 mt-1 font-mono text-sm">
                <span className="text-gold px-1.5 py-0.5 bg-gold/10 rounded text-xs">{player.position}</span>
                <span className="text-cream-dim">Age {player.age}</span>
                <span className="text-cream-dim">{player.bats}/{player.throws}</span>
                <span className="text-cream font-bold">OVR {ovrRatings}</span>
                <span className="text-cream-dim/40 text-[10px]">overall</span>
              </div>
            </div>
            <div className="flex gap-2">
              {hasCareerHistory && (
                <Button size="sm" variant="secondary" onClick={() => navigate(`/franchise/player-history?player=${playerId}`)}>
                  Career History
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => navigate(`/franchise/compare?p1=${playerId}`)}>Compare</Button>
              <Button size="sm" variant="ghost" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/franchise/roster')}>← Back</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: ratings */}
            <div className="lg:col-span-2 space-y-4">
              <Panel title="Player Ratings">
                <p className="font-mono text-xs text-cream-dim/70 mb-4 bg-navy-lighter/20 px-3 py-2 rounded border-l-2 border-gold/30">
                  No in-game stats yet — play games to unlock season statistics.
                </p>
                <div className="space-y-2">
                  {isPitcherRatings ? (
                    <>
                      <RatingBar label="Stuff" value={player.pitching.stuff} />
                      <RatingBar label="Movement" value={player.pitching.movement} />
                      <RatingBar label="Control" value={player.pitching.control} />
                      <RatingBar label="Stamina" value={player.pitching.stamina} />
                      <RatingBar label="Velocity" value={player.pitching.velocity} />
                      <RatingBar label="Hold Runners" value={player.pitching.hold_runners} />
                      <RatingBar label="GB Tendency" value={player.pitching.groundball_pct} />
                    </>
                  ) : (
                    <>
                      <RatingBar label="Contact (R)" value={player.batting.contact_R} />
                      <RatingBar label="Contact (L)" value={player.batting.contact_L} />
                      <RatingBar label="Power (R)" value={player.batting.power_R} />
                      <RatingBar label="Power (L)" value={player.batting.power_L} />
                      <RatingBar label="Eye / Discipline" value={player.batting.eye} />
                      <RatingBar label="Avoid K" value={player.batting.avoid_k} />
                      <RatingBar label="Gap Power" value={player.batting.gap_power} />
                      <RatingBar label="Speed" value={player.batting.speed} />
                    </>
                  )}
                  <div className="pt-2 border-t border-navy-lighter mt-3">
                    <p className="font-mono text-xs text-cream-dim/50 mb-2">Mental</p>
                    <RatingBar label="Intelligence" value={player.mental.intelligence} />
                    <RatingBar label="Work Ethic" value={player.mental.work_ethic} />
                    <RatingBar label="Durability" value={player.mental.durability} />
                    <RatingBar label="Consistency" value={player.mental.consistency} />
                    <RatingBar label="Composure" value={player.mental.composure} />
                  </div>
                </div>
              </Panel>
              {/* Fielding */}
              {player.fielding.length > 0 && (
                <Panel title="Fielding Ratings">
                  <div className="space-y-4">
                    {player.fielding.map(fi => (
                      <div key={fi.position}>
                        <p className="text-gold text-xs font-mono uppercase tracking-wider mb-2">{fi.position}</p>
                        <div className="space-y-1.5">
                          <RatingBar label="Range" value={fi.range} />
                          <RatingBar label="Arm Strength" value={fi.arm_strength} />
                          <RatingBar label="Arm Accuracy" value={fi.arm_accuracy} />
                          <RatingBar label="Error Rate" value={100 - fi.error_rate} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
            {/* Right: career arc + scouting + contract */}
            <div className="space-y-4">
              {/* Career Arc — shown first for at-a-glance trajectory */}
              <Panel title="Career Arc">
                <CareerArcChart
                  currentAge={player.age}
                  currentOvr={ovrRatings}
                  workEthic={player.mental.work_ethic}
                />
              </Panel>
              {scoutReport && (
                <Panel title="Scouting Report">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest">
                      {scoutReport.projectedRole}
                    </span>
                    <span className={cn(
                      'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
                      scoutReport.riskLevel === 'LOW' ? 'text-green-light border-green-light/30 bg-green-light/5'
                      : scoutReport.riskLevel === 'MED' ? 'text-gold border-gold/30 bg-gold/5'
                      : 'text-red-400 border-red-400/30 bg-red-400/5'
                    )}>
                      {scoutReport.riskLevel} RISK
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(scoutReport.grades).map(([key, grade]) => (
                      <GradeBar80 key={key} label={key} grade={grade.scoutedGrade} confidence={grade.confidence} />
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-navy-lighter flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cream-dim/40 uppercase tracking-widest">Overall</span>
                    <span className={cn('text-sm font-mono font-bold',
                      scoutReport.overallGrade.scoutedGrade >= 70 ? 'text-gold'
                      : scoutReport.overallGrade.scoutedGrade >= 60 ? 'text-green-light'
                      : 'text-cream'
                    )}>
                      {scoutReport.overallGrade.scoutedGrade}
                    </span>
                  </div>
                  {scoutReport.scoutNotes.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-navy-lighter space-y-1">
                      {scoutReport.scoutNotes.slice(0, 2).map((note, i) => (
                        <p key={i} className="text-[10px] font-mono text-cream-dim/50 italic">{note}</p>
                      ))}
                    </div>
                  )}
                </Panel>
              )}
              {contract && !contract.isFreeAgent && (
                <Panel title="Contract">
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-cream-dim text-xs">Salary</span>
                      <span className="text-gold font-bold">${(contract.salaryPerYear / 1000).toFixed(1)}M / yr</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-cream-dim text-xs">Years Left</span>
                      <span className="text-cream text-xs">{contract.yearsRemaining} yr{contract.yearsRemaining !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-cream-dim text-xs">Total Remaining</span>
                      <span className="text-cream-dim text-xs">${((contract.salaryPerYear * contract.yearsRemaining) / 1000).toFixed(1)}M</span>
                    </div>
                    {contract.yearsRemaining <= 1 && (
                      <p className="text-gold/60 text-[10px] text-center pt-1 border-t border-navy-lighter">
                        Extension candidate — expiring after this season
                      </p>
                    )}
                  </div>
                </Panel>
              )}
              {isPitcherRatings && player.pitching.repertoire.length > 0 && (
                <Panel title="Pitch Repertoire">
                  <div className="flex flex-wrap gap-1">
                    {player.pitching.repertoire.map(pt => (
                      <span key={pt} className="px-2 py-0.5 bg-navy-lighter rounded text-xs text-cream font-mono capitalize">
                        {pt}
                      </span>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-cream-dim text-lg">Player not found.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  const recentGames = [...ps.gameLog].reverse().slice(0, 10);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">{ps.playerName}</h1>
          <div className="flex items-center gap-3 mt-1 font-mono text-sm">
            <span className="text-cream-dim">
              {team ? `${team.city} ${team.name}` : ps.teamId}
            </span>
            <span className="text-gold px-1.5 py-0.5 bg-gold/10 rounded text-xs">{ps.position}</span>
            {player && (
              <>
                <span className="text-cream-dim">Age {player.age}</span>
                <span className="text-cream-dim">{player.bats}/{player.throws}</span>
              </>
            )}
            {ovr !== null && (
              <span className="text-cream font-bold">OVR {ovr}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {player && (
            <Button size="sm" variant="secondary" onClick={() => navigate(`/franchise/player/${playerId}`)}>
              Edit Player
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => navigate(`/franchise/compare?p1=${playerId}`)}>
            Compare
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/leaders')}>
            Leaders
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: stats */}
        <div className="lg:col-span-2 space-y-4">

          {/* Batting stats */}
          {!isPitcher && battAdv && (
            <Panel title="Batting Statistics">
              <p className="text-cream-dim text-xs font-mono mb-3">{ps.gamesPlayed} G — {ps.batting.pa} PA</p>

              {/* Traditional */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
                <StatBox label="AVG" value={fmtAvg(battingAvg(ps.batting))} />
                <StatBox label="OBP" value={fmtAvg(onBasePct(ps.batting))} />
                <StatBox label="SLG" value={fmtAvg(slugging(ps.batting))} />
                <StatBox label="OPS" value={fmtAvg(battAdv.ops)} highlight />
                <StatBox label="HR" value={ps.batting.hr.toString()} />
                <StatBox label="RBI" value={ps.batting.rbi.toString()} />
                <StatBox label="R" value={ps.batting.r.toString()} />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
                <StatBox label="H" value={ps.batting.h.toString()} />
                <StatBox label="2B" value={ps.batting.doubles.toString()} />
                <StatBox label="3B" value={ps.batting.triples.toString()} />
                <StatBox label="BB" value={ps.batting.bb.toString()} />
                <StatBox label="SO" value={ps.batting.so.toString()} />
                <StatBox label="SB" value={ps.batting.sb.toString()} />
                <StatBox label="AB" value={ps.batting.ab.toString()} />
              </div>

              {/* Advanced */}
              <div className="border-t border-navy-lighter pt-3">
                <p className="text-gold-dim text-xs uppercase tracking-wider font-mono mb-2">Advanced</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <StatBox label="wOBA" value={fmtAvg(battAdv.woba)} highlight />
                  <StatBox label="wRC+" value={battAdv.wrcPlus.toString()} highlight />
                  <StatBox label="OPS+" value={battAdv.opsPlus.toString()} />
                  <StatBox label="BABIP" value={fmtAvg(battAdv.babip)} />
                  <StatBox label="ISO" value={fmtAvg(battAdv.iso)} />
                  <StatBox label="WAR" value={battAdv.war.toFixed(1)} highlight />
                </div>
              </div>
            </Panel>
          )}

          {/* Pitching stats */}
          {isPitcher && pitchAdv && (
            <Panel title="Pitching Statistics">
              <p className="text-cream-dim text-xs font-mono mb-3">
                {ps.gamesPlayed} G — {formatIP(ps.pitching.ip)} IP
              </p>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
                <StatBox label="ERA" value={era(ps.pitching).toFixed(2)} highlight />
                <StatBox label="WHIP" value={whip(ps.pitching).toFixed(3)} />
                <StatBox label="W" value={ps.pitching.wins.toString()} />
                <StatBox label="L" value={ps.pitching.losses.toString()} />
                <StatBox label="SV" value={ps.pitching.saves.toString()} />
                <StatBox label="K" value={ps.pitching.so.toString()} />
                <StatBox label="BB" value={ps.pitching.bb.toString()} />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-4">
                <StatBox label="H" value={ps.pitching.h.toString()} />
                <StatBox label="HR" value={ps.pitching.hr.toString()} />
                <StatBox label="ER" value={ps.pitching.er.toString()} />
                <StatBox label="IP" value={formatIP(ps.pitching.ip)} />
                <StatBox label="BF" value={ps.pitching.bf.toString()} />
              </div>

              <div className="border-t border-navy-lighter pt-3">
                <p className="text-gold-dim text-xs uppercase tracking-wider font-mono mb-2">Advanced</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <StatBox label="FIP" value={pitchAdv.fip.toFixed(2)} highlight />
                  <StatBox label="ERA+" value={pitchAdv.eraPlus.toString()} />
                  <StatBox label="K/9" value={pitchAdv.k9.toFixed(1)} />
                  <StatBox label="BB/9" value={pitchAdv.bb9.toFixed(1)} />
                  <StatBox label="HR/9" value={pitchAdv.hr9.toFixed(1)} />
                  <StatBox label="WAR" value={pitchAdv.war.toFixed(1)} highlight />
                </div>
              </div>
            </Panel>
          )}

          {/* Game log */}
          <Panel title={`Last ${recentGames.length} Games`}>
            {recentGames.length === 0 ? (
              <p className="text-cream-dim text-sm font-mono">No games played yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-navy-lighter">
                      <th className="px-2 py-1.5 text-left text-gold-dim uppercase tracking-wider">Day</th>
                      <th className="px-2 py-1.5 text-left text-gold-dim uppercase tracking-wider">Opp</th>
                      {!isPitcher && (
                        <>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">AB</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">H</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">2B</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">3B</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">R</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">RBI</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">HR</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">BB</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">SO</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">AVG</th>
                        </>
                      )}
                      {isPitcher && (
                        <>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">IP</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">ER</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">K</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">BB</th>
                          <th className="px-2 py-1.5 text-right text-gold-dim uppercase tracking-wider">Dec</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {recentGames.map((g, i) => {
                      const oppTeam = engine?.getTeam(g.opponent);
                      const oppLabel = (g.isHome ? 'vs ' : '@ ') + (oppTeam?.abbreviation ?? g.opponent.slice(0, 3).toUpperCase());
                      return (
                        <tr
                          key={`${g.gameId}-${i}`}
                          className={cn(
                            'border-b border-navy-lighter/40 hover:bg-navy-lighter/20 transition-colors',
                            i % 2 === 1 && 'bg-navy-lighter/10'
                          )}
                        >
                          <td className="px-2 py-1 text-cream-dim">Day {g.date}</td>
                          <td className="px-2 py-1 text-cream">{oppLabel}</td>
                          {!isPitcher && (
                            <>
                              <td className="px-2 py-1 text-right text-cream">{g.ab}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.h}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.doubles ?? 0}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.triples ?? 0}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.r}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.rbi}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.hr > 0 ? <span className="text-gold font-bold">{g.hr}</span> : 0}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.bb}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.so}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.ab > 0 ? fmtAvg(g.h / g.ab) : '---'}</td>
                            </>
                          )}
                          {isPitcher && (
                            <>
                              <td className="px-2 py-1 text-right text-cream">{g.ip || '0.0'}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.er}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.kPitching}</td>
                              <td className="px-2 py-1 text-right text-cream">{g.bbPitching}</td>
                              <td className={cn('px-2 py-1 text-right font-bold',
                                g.decision === 'W' ? 'text-green-light' :
                                g.decision === 'L' ? 'text-red' :
                                g.decision === 'S' ? 'text-gold' : 'text-cream-dim'
                              )}>
                                {g.decision || '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Right column: ratings */}
        {player && (
          <div className="space-y-4">

            {/* Career Arc — top of right column for at-a-glance trajectory */}
            <Panel title="Career Arc">
              <CareerArcChart
                currentAge={player.age}
                currentOvr={ovr ?? Math.round(evaluatePlayer(player))}
                workEthic={player.mental.work_ethic}
              />
            </Panel>

            {/* Scouting Report — 20-80 grades */}
            {scoutReport && (
              <Panel title="Scouting Report">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest">
                    {scoutReport.projectedRole}
                  </span>
                  <span className={cn(
                    'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
                    scoutReport.riskLevel === 'LOW' ? 'text-green-light border-green-light/30 bg-green-light/5'
                    : scoutReport.riskLevel === 'MED' ? 'text-gold border-gold/30 bg-gold/5'
                    : 'text-red-400 border-red-400/30 bg-red-400/5'
                  )}>
                    {scoutReport.riskLevel} RISK
                  </span>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(scoutReport.grades).map(([key, grade]) => (
                    <GradeBar80
                      key={key}
                      label={key}
                      grade={grade.scoutedGrade}
                      confidence={grade.confidence}
                    />
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-navy-lighter flex items-center justify-between">
                  <span className="text-[10px] font-mono text-cream-dim/40 uppercase tracking-widest">Overall</span>
                  <span className={cn(
                    'text-sm font-mono font-bold',
                    scoutReport.overallGrade.scoutedGrade >= 70 ? 'text-gold'
                    : scoutReport.overallGrade.scoutedGrade >= 60 ? 'text-green-light'
                    : 'text-cream'
                  )}>
                    {scoutReport.overallGrade.scoutedGrade}
                  </span>
                </div>
                {scoutReport.scoutNotes.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-navy-lighter space-y-1">
                    {scoutReport.scoutNotes.slice(0, 2).map((note, i) => (
                      <p key={i} className="text-[10px] font-mono text-cream-dim/50 italic">{note}</p>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {/* Contract */}
            {contract && !contract.isFreeAgent && (
              <Panel title="Contract">
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-cream-dim text-xs">Salary</span>
                    <span className="text-gold font-bold">${(contract.salaryPerYear / 1000).toFixed(1)}M / yr</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-cream-dim text-xs">Years Left</span>
                    <span className="text-cream text-xs">{contract.yearsRemaining} yr{contract.yearsRemaining !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-cream-dim text-xs">Total Remaining</span>
                    <span className="text-cream-dim text-xs">${((contract.salaryPerYear * contract.yearsRemaining) / 1000).toFixed(1)}M</span>
                  </div>
                  {contract.yearsRemaining <= 1 && (
                    <p className="text-gold/60 text-[10px] text-center pt-1 border-t border-navy-lighter">
                      Extension candidate — expiring after this season
                    </p>
                  )}
                </div>
              </Panel>
            )}

            {/* Batting Ratings */}
            {!isPitcher && (
              <Panel title="Batting Ratings">
                <div className="space-y-2">
                  <RatingBar label="Contact (R)" value={player.batting.contact_R} />
                  <RatingBar label="Contact (L)" value={player.batting.contact_L} />
                  <RatingBar label="Power (R)" value={player.batting.power_R} />
                  <RatingBar label="Power (L)" value={player.batting.power_L} />
                  <RatingBar label="Eye / Discipline" value={player.batting.eye} />
                  <RatingBar label="Avoid K" value={player.batting.avoid_k} />
                  <RatingBar label="Gap Power" value={player.batting.gap_power} />
                  <RatingBar label="Speed" value={player.batting.speed} />
                  <RatingBar label="Steal" value={player.batting.steal} />
                  <RatingBar label="Bunt" value={player.batting.bunt} />
                  <RatingBar label="Clutch" value={player.batting.clutch} />
                </div>
              </Panel>
            )}

            {/* Pitching Ratings */}
            {isPitcher && (
              <Panel title="Pitching Ratings">
                <div className="space-y-2">
                  <RatingBar label="Stuff" value={player.pitching.stuff} />
                  <RatingBar label="Movement" value={player.pitching.movement} />
                  <RatingBar label="Control" value={player.pitching.control} />
                  <RatingBar label="Stamina" value={player.pitching.stamina} />
                  <RatingBar label="Velocity" value={player.pitching.velocity} max={102} />
                  <RatingBar label="Hold Runners" value={player.pitching.hold_runners} />
                  <RatingBar label="GB Tendency" value={player.pitching.groundball_pct} />
                </div>
                {player.pitching.repertoire.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-navy-lighter">
                    <p className="text-gold-dim text-xs uppercase tracking-wider mb-2">Repertoire</p>
                    <div className="flex flex-wrap gap-1">
                      {player.pitching.repertoire.map(pt => (
                        <span key={pt} className="px-2 py-0.5 bg-navy-lighter rounded text-xs text-cream font-mono capitalize">
                          {pt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            )}

            {/* Fielding Ratings */}
            <Panel title="Fielding Ratings">
              {player.fielding.length === 0 ? (
                <p className="text-cream-dim text-sm font-mono">No fielding data.</p>
              ) : (
                <div className="space-y-4">
                  {player.fielding.map(fi => (
                    <div key={fi.position}>
                      <p className="text-gold text-xs font-mono uppercase tracking-wider mb-2">{fi.position}</p>
                      <div className="space-y-1.5">
                        <RatingBar label="Range" value={fi.range} />
                        <RatingBar label="Arm Strength" value={fi.arm_strength} />
                        <RatingBar label="Arm Accuracy" value={fi.arm_accuracy} />
                        <RatingBar label="Turn DP" value={fi.turn_dp} />
                        <RatingBar label="Error Rate" value={100 - fi.error_rate} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Mental Ratings */}
            <Panel title="Mental Ratings">
              <div className="space-y-2">
                <RatingBar label="Intelligence" value={player.mental.intelligence} />
                <RatingBar label="Work Ethic" value={player.mental.work_ethic} />
                <RatingBar label="Durability" value={player.mental.durability} />
                <RatingBar label="Consistency" value={player.mental.consistency} />
                <RatingBar label="Composure" value={player.mental.composure} />
                <RatingBar label="Leadership" value={player.mental.leadership} />
              </div>
            </Panel>



            {/* Positional adjustment note */}
            {!isPitcher && (
              <div className="text-xs font-mono text-cream-dim/50 text-center p-2 bg-navy-lighter/10 rounded border border-navy-lighter/20">
                <span className="text-cream-dim/30 uppercase tracking-wider text-[10px]">Position Adj</span>
                <span className="ml-2 text-cream-dim">{posAdj >= 0 ? '+' : ''}{posAdj} runs/162 ({ps.position})</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
