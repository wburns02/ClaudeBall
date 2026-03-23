import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerModal } from '@/stores/playerModalStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useScoutingStore } from '@/stores/scoutingStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { battingAvg, onBasePct, slugging, era, whip, formatIP } from '@/engine/types/stats.ts';
import { calcBattingAdvanced, calcPitchingAdvanced, deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT, POSITION_ADJ } from '@/engine/stats/AdvancedStats.ts';
import { cn } from '@/lib/cn.ts';

function gradeColor(v: number) {
  return v >= 70 ? 'text-gold' : v >= 60 ? 'text-green-light' : v >= 50 ? 'text-cream' : v >= 40 ? 'text-cream-dim' : 'text-red-400';
}

function gradeLabel(v: number) {
  return v >= 80 ? 'ELITE' : v >= 70 ? 'PLUS+' : v >= 60 ? 'PLUS' : v >= 50 ? 'AVG' : v >= 40 ? 'BLW' : 'POOR';
}

function barColor(v: number) {
  return v >= 70 ? 'bg-gold' : v >= 60 ? 'bg-green-light' : v >= 50 ? 'bg-cream-dim' : v >= 40 ? 'bg-cream-dim/50' : 'bg-red-400/60';
}

function ovrLetterColor(v: number) {
  return v >= 75 ? 'text-gold border-gold/40 bg-gold/10'
    : v >= 60 ? 'text-green-light border-green-light/40 bg-green-light/10'
    : v >= 45 ? 'text-cream border-cream/20 bg-cream/5'
    : 'text-red-400 border-red-400/40 bg-red-400/10';
}

function GradeRow({ label, val }: { label: string; val: number }) {
  const pct = Math.max(0, Math.min(100, ((val - 20) / 60) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-cream-dim/50 w-12 shrink-0 uppercase">{label}</span>
      <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-300', barColor(val))} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-mono font-bold w-5 text-right', gradeColor(val))}>{val}</span>
      <span className="text-[9px] font-mono text-cream-dim/30 w-7">{gradeLabel(val)}</span>
    </div>
  );
}

export function PlayerQuickView() {
  const { openPlayerId, closePlayer } = usePlayerModal();
  const navigate = useNavigate();
  const { engine, userTeamId } = useFranchiseStore();
  const getPlayerStats = useStatsStore(s => s.getPlayerStats);
  const getReport = useScoutingStore(s => s.getReport);

  useEffect(() => {
    if (!openPlayerId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePlayer(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openPlayerId, closePlayer]);

  if (!openPlayerId || !engine) return null;

  const player = engine.getAllTeams().flatMap(t => t.roster.players).find(p => p.id === openPlayerId);
  if (!player) return null;

  const team = engine.getAllTeams().find(t => t.roster.players.some(p => p.id === openPlayerId));
  const isOwnPlayer = team?.id === userTeamId;
  const contract = engine.contractEngine.getContract(openPlayerId);
  const ps = getPlayerStats(openPlayerId);
  const scoutReport = getReport(openPlayerId);

  const isPitcher = player.position === 'P';
  const ovr = Math.round(evaluatePlayer(player));
  const name = getPlayerName(player);

  const phaseLabel = player.age <= 26 ? 'Growth' : player.age <= 31 ? 'Peak' : player.age <= 36 ? 'Decline' : 'Steep Decline';
  const phaseColor = player.age <= 26 ? 'text-green-light' : player.age <= 31 ? 'text-gold' : player.age <= 36 ? 'text-orange-400' : 'text-red-400';

  const grades = isPitcher ? [
    { label: 'Velocity', val: scoutReport?.grades['Velocity']?.scoutedGrade ?? player.pitching.velocity },
    { label: 'Stuff', val: scoutReport?.grades['Stuff']?.scoutedGrade ?? player.pitching.stuff },
    { label: 'Movement', val: scoutReport?.grades['Movement']?.scoutedGrade ?? player.pitching.movement },
    { label: 'Control', val: scoutReport?.grades['Control']?.scoutedGrade ?? player.pitching.control },
    { label: 'Stamina', val: scoutReport?.grades['Stamina']?.scoutedGrade ?? player.pitching.stamina },
  ] : [
    { label: 'Contact', val: scoutReport?.grades['Contact']?.scoutedGrade ?? Math.round((player.batting.contact_L + player.batting.contact_R) / 2) },
    { label: 'Power', val: scoutReport?.grades['Power']?.scoutedGrade ?? Math.round((player.batting.power_L + player.batting.power_R) / 2) },
    { label: 'Eye', val: scoutReport?.grades['Eye']?.scoutedGrade ?? player.batting.eye },
    { label: 'Speed', val: scoutReport?.grades['Speed']?.scoutedGrade ?? player.batting.speed },
    { label: 'Fielding', val: scoutReport?.grades['Field']?.scoutedGrade ?? player.batting.gap_power },
  ];

  // Compute WAR using league context
  const leagueCtx = (() => {
    if (!engine) return DEFAULT_LEAGUE_CONTEXT;
    const allStats = Object.values(useStatsStore.getState().playerStats);
    if (allStats.length === 0) return DEFAULT_LEAGUE_CONTEXT;
    let totalAB = 0, totalPA = 0, totalH = 0, totalDoubles = 0, totalTriples = 0;
    let totalHR = 0, totalBB = 0, totalHBP = 0, totalSF = 0, totalSO = 0, totalRuns = 0;
    let totalER = 0, totalIP = 0;
    for (const p of allStats) {
      const b = p.batting;
      totalAB += b.ab; totalPA += b.pa; totalH += b.h;
      totalDoubles += b.doubles; totalTriples += b.triples; totalHR += b.hr;
      totalBB += b.bb; totalHBP += b.hbp; totalSF += b.sf; totalSO += b.so; totalRuns += b.r;
      totalER += p.pitching.er; totalIP += p.pitching.ip;
    }
    return deriveLeagueContext(totalAB, totalPA, totalH, totalDoubles, totalTriples, totalHR, totalBB, totalHBP, totalSF, totalSO, totalRuns, 0, totalER, totalIP);
  })();

  const playerWar = (() => {
    if (!ps) return null;
    if (isPitcher && ps.pitching.ip > 0) {
      return calcPitchingAdvanced(ps.pitching, leagueCtx).war;
    }
    if (!isPitcher && ps.batting.ab > 0) {
      return calcBattingAdvanced(ps.batting, leagueCtx, player.position).war;
    }
    return null;
  })();

  const statsLine = (() => {
    if (!ps) return null;
    if (isPitcher && ps.pitching.ip > 0) {
      const eraVal = era(ps.pitching);
      return [
        { label: 'ERA', val: eraVal.toFixed(2), hi: eraVal < 3.0 },
        { label: 'IP', val: formatIP(ps.pitching.ip), hi: false },
        { label: 'K', val: String(ps.pitching.so), hi: false },
        { label: 'WAR', val: playerWar !== null ? playerWar.toFixed(1) : '—', hi: (playerWar ?? 0) >= 2.0 },
      ];
    }
    if (!isPitcher && ps.batting.ab > 0) {
      const avg = battingAvg(ps.batting);
      return [
        { label: 'AVG', val: avg === 0 ? '.000' : `.${Math.round(avg * 1000).toString().padStart(3, '0')}`, hi: avg > 0.300 },
        { label: 'HR', val: String(ps.batting.hr), hi: false },
        { label: 'RBI', val: String(ps.batting.rbi ?? 0), hi: false },
        { label: 'WAR', val: playerWar !== null ? playerWar.toFixed(1) : '—', hi: (playerWar ?? 0) >= 2.0 },
      ];
    }
    return null;
  })();

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={closePlayer}
        aria-hidden="true"
      />
      <div
        className="fixed right-0 top-0 h-full w-[380px] max-w-[95vw] bg-navy z-50 shadow-2xl overflow-y-auto border-l border-navy-lighter animate-[slideInRight_0.2s_ease-out]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-navy z-10 px-5 pt-5 pb-3 border-b border-navy-lighter">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-widest mb-0.5">
                {team ? `${team.city} ${team.name}` : 'Free Agent'}
                {isOwnPlayer && <span className="text-gold/60 ml-1.5">· YOUR TEAM</span>}
              </p>
              <h2 className="font-display text-xl text-gold tracking-wide truncate">{name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs text-cream bg-navy-lighter px-1.5 py-0.5 rounded">{player.position}</span>
                <span className="font-mono text-xs text-cream-dim">Age {player.age}</span>
                <span className="font-mono text-xs text-cream-dim">{player.bats}/{player.throws}</span>
                <span className={cn('font-mono text-[10px] font-semibold', phaseColor)}>{phaseLabel}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={closePlayer}
                className="text-cream-dim/40 hover:text-cream-dim transition-colors text-lg leading-none -mt-0.5"
                aria-label="Close"
              >
                ✕
              </button>
              <span className={cn('font-mono text-sm font-bold border rounded px-2 py-0.5', ovrLetterColor(ovr))}>
                {ovr}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Tool Grades */}
          <div>
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-2.5">
              Tool Grades
              {scoutReport
                ? <span className="text-gold/40 ml-1.5 normal-case">· scouted</span>
                : <span className="text-cream-dim/30 ml-1.5 normal-case">· estimated</span>}
            </p>
            <div className="space-y-1.5">
              {grades.map(g => <GradeRow key={g.label} label={g.label} val={g.val} />)}
            </div>
          </div>

          {/* Season Stats */}
          {statsLine && (
            <div>
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-2">2026 Season</p>
              <div className="grid grid-cols-5 gap-1">
                {statsLine.map(s => (
                  <div key={s.label} className={cn(
                    'text-center py-1.5 rounded border',
                    s.hi ? 'bg-gold/10 border-gold/30' : 'bg-navy-lighter/20 border-navy-lighter/40',
                  )}>
                    <p className="font-mono text-[9px] text-cream-dim/40 uppercase">{s.label}</p>
                    <p className={cn('font-mono text-xs font-bold mt-0.5', s.hi ? 'text-gold' : 'text-cream')}>{s.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contract */}
          {contract && !contract.isFreeAgent && (
            <div>
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-2">Contract</p>
              <div className="flex items-center justify-between bg-navy-lighter/20 rounded-lg px-3 py-2.5 border border-navy-lighter/40">
                <div>
                  <p className="font-mono text-gold font-bold text-sm">${(contract.salaryPerYear / 1000).toFixed(1)}M/yr</p>
                  <p className="font-mono text-xs text-cream-dim/50">${((contract.salaryPerYear * contract.yearsRemaining) / 1000).toFixed(1)}M remaining</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-cream text-sm font-bold">{contract.yearsRemaining}yr</p>
                  {contract.yearsRemaining <= 1 && (
                    <p className="font-mono text-[10px] text-gold/60">Expiring</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scout notes */}
          {scoutReport?.scoutNotes && scoutReport.scoutNotes.length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-1.5">Scout Notes</p>
              <div className="space-y-1">
                {scoutReport.scoutNotes.slice(0, 2).map((note, i) => (
                  <p key={i} className="font-mono text-[11px] text-cream-dim/60 italic">{note}</p>
                ))}
              </div>
            </div>
          )}

          {/* Pitch repertoire */}
          {isPitcher && player.pitching.repertoire.length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-1.5">Repertoire</p>
              <div className="flex flex-wrap gap-1.5">
                {player.pitching.repertoire.map(pt => (
                  <span key={pt} className="px-2 py-0.5 bg-navy-lighter rounded text-[11px] font-mono text-cream capitalize">{pt}</span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-navy-lighter">
            <button
              onClick={() => { navigate(`/franchise/player-stats/${openPlayerId}`); closePlayer(); }}
              className="w-full py-2.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-xs font-mono font-semibold hover:bg-gold/25 active:bg-gold/35 transition-colors cursor-pointer"
            >
              View Full Stats & Career →
            </button>
            {isOwnPlayer && (
              <button
                onClick={() => { navigate('/franchise/training'); closePlayer(); }}
                className="w-full py-2 rounded-lg bg-navy-lighter/30 border border-navy-lighter/60 text-cream-dim text-xs font-mono hover:bg-navy-lighter/50 transition-colors cursor-pointer"
              >
                Set Training Focus →
              </button>
            )}
            {!isOwnPlayer && (
              <button
                onClick={() => { navigate(`/franchise/trade?targetPlayer=${openPlayerId}`); closePlayer(); }}
                className="w-full py-2 rounded-lg bg-navy-lighter/30 border border-navy-lighter/60 text-cream-dim text-xs font-mono hover:bg-navy-lighter/50 transition-colors cursor-pointer"
              >
                Explore Trade →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
