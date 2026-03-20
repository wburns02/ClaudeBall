import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useScoutingStore } from '@/stores/scoutingStore.ts';
import { addToast } from '@/stores/toastStore.ts';
import { usePlayerModal } from '@/stores/playerModalStore.ts';
import { STAFF_TIERS } from '@/engine/gm/ScoutingEngine.ts';
import type { GradeReport, PlayerScoutingReport } from '@/engine/gm/ScoutingEngine.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Team } from '@/engine/types/index.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────
function to80(val: number): number {
  return Math.round(Math.max(20, Math.min(80, 20 + (val / 100) * 60)) / 5) * 5;
}

function gradeLabel(g: number): string {
  if (g >= 80) return 'ELITE';
  if (g >= 70) return 'PLUS+';
  if (g >= 60) return 'PLUS';
  if (g >= 50) return 'AVG';
  if (g >= 45) return 'BLW';
  if (g >= 40) return 'FRG';
  if (g >= 30) return 'POOR';
  return 'N/A';
}

function gradeColor(g: number): string {
  if (g >= 70) return 'text-gold';
  if (g >= 60) return 'text-green-light';
  if (g >= 50) return 'text-cream';
  if (g >= 45) return 'text-cream-dim';
  return 'text-red-400';
}

function gradeBarColor(g: number): string {
  if (g >= 70) return 'bg-gold';
  if (g >= 60) return 'bg-green-light';
  if (g >= 50) return 'bg-cream-dim';
  if (g >= 45) return 'bg-cream-dim/50';
  return 'bg-red-400/60';
}

function letterGrade(overall: number): string {
  if (overall >= 70) return 'A+';
  if (overall >= 65) return 'A';
  if (overall >= 60) return 'A-';
  if (overall >= 57) return 'B+';
  if (overall >= 54) return 'B';
  if (overall >= 51) return 'B-';
  if (overall >= 48) return 'C+';
  if (overall >= 45) return 'C';
  if (overall >= 42) return 'C-';
  if (overall >= 39) return 'D+';
  if (overall >= 36) return 'D';
  return 'F';
}

function letterGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-gold';
  if (grade.startsWith('B')) return 'text-green-light';
  if (grade.startsWith('C')) return 'text-cream';
  return 'text-red-400';
}

function isPitcherPos(pos: string): boolean {
  return pos === 'P';
}

function overallFromPlayer(p: Player): number {
  if (isPitcherPos(p.position)) {
    const pi = p.pitching;
    const veloGrade = Math.max(20, Math.min(80, Math.round(((pi.velocity - 85) / 15) * 60 + 20)));
    return Math.round((veloGrade + to80(pi.stuff) + to80(pi.movement) + to80(pi.control) + to80(pi.stamina)) / 5);
  }
  const b = p.batting;
  const fld = p.fielding[0];
  return Math.round((
    to80((b.contact_L + b.contact_R) / 2) +
    to80((b.power_L + b.power_R) / 2) +
    to80(b.speed) +
    (fld ? to80(fld.range) : 40) +
    (fld ? to80(fld.arm_strength) : 40) +
    to80(b.eye)
  ) / 6);
}

function projFromPlayer(p: Player): string {
  const overall = overallFromPlayer(p);
  const isP = isPitcherPos(p.position);
  if (isP) {
    if (overall >= 70) return p.age <= 25 ? 'Future Ace' : 'Ace';
    if (overall >= 60) return p.age <= 25 ? 'Future #2' : '#2 Starter';
    if (overall >= 52) return 'Back-of-Rotation';
    if (overall >= 44) return 'Swingman';
    return 'Bullpen Arm';
  }
  if (overall >= 70) return p.age <= 25 ? 'Future Star' : 'All-Star';
  if (overall >= 62) return p.age <= 25 ? 'High Upside' : 'Solid Starter';
  if (overall >= 52) return 'Regular Starter';
  if (overall >= 44) return 'Platoon Player';
  return 'Bench / 4A';
}

function riskBadge(risk: 'LOW' | 'MED' | 'HIGH') {
  const cls = risk === 'LOW'
    ? 'text-green-light border-green-light/30 bg-green-light/5'
    : risk === 'MED'
    ? 'text-gold border-gold/30 bg-gold/5'
    : 'text-red-400 border-red-400/30 bg-red-400/5';
  return (
    <span className={cn('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border', cls)}>
      {risk} RISK
    </span>
  );
}

// ── Grade Bars ────────────────────────────────────────────────────────────────
function GradeBar({ label, grade, note }: { label: string; grade: number; note?: string }) {
  const pct = ((grade - 20) / 60) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-cream-dim/50 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', gradeBarColor(grade))} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-mono font-bold w-5 text-right', gradeColor(grade))}>{grade}</span>
      <span className="text-[9px] font-mono text-cream-dim/30 w-8">{note ?? gradeLabel(grade)}</span>
    </div>
  );
}

function FogGradeBar({ label, report }: { label: string; report: GradeReport | undefined }) {
  if (!report) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-cream-dim/25 w-14 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-navy-lighter/10 rounded-full overflow-hidden">
          <div className="h-full w-full bg-cream-dim/8 rounded-full" style={{ background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(232,224,212,0.04) 4px, rgba(232,224,212,0.04) 8px)' }} />
        </div>
        <span className="text-[10px] font-mono w-5 text-right text-cream-dim/20">—</span>
        <span className="text-[9px] font-mono text-cream-dim/15 w-8">?</span>
      </div>
    );
  }
  const { scoutedGrade, margin, confidence } = report;
  const pct = ((scoutedGrade - 20) / 60) * 100;
  const opacity = Math.max(0.45, confidence / 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-cream-dim/50 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', gradeBarColor(scoutedGrade))}
          style={{ width: `${pct}%`, opacity }}
        />
      </div>
      <span className={cn('text-xs font-mono font-bold w-5 text-right', gradeColor(scoutedGrade))}>{scoutedGrade}</span>
      <span className="text-[9px] font-mono text-cream-dim/30 w-8">±{margin}</span>
    </div>
  );
}

// ── Team Needs Panel ──────────────────────────────────────────────────────────
function TeamNeedsPanel({ userTeam }: { userTeam: Team }) {
  const POS_LIST = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'] as const;
  const posStrength = POS_LIST.map(pos => {
    const players = userTeam.roster.players.filter(p => p.position === pos);
    if (players.length === 0) return { pos, grade: 20, count: 0 };
    const best = Math.max(...players.map(overallFromPlayer));
    return { pos, grade: best, count: players.length };
  });
  return (
    <Panel title="Team Needs Analysis" className="mb-0">
      <p className="text-xs font-mono text-cream-dim/50 mb-3">Best player grade at each position. Red = upgrade needed.</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
        {posStrength.map(({ pos, grade, count }) => {
          const letter = count === 0 ? '—' : letterGrade(grade);
          return (
            <div key={pos} className={cn(
              'rounded-lg px-2 py-1.5 border text-center',
              count === 0 ? 'border-red-400/30 bg-red-400/5' :
              grade >= 60 ? 'border-green-light/30 bg-green-light/5' :
              grade >= 50 ? 'border-navy-lighter/50 bg-navy-lighter/10' :
              grade >= 42 ? 'border-gold/20 bg-gold/5' :
              'border-red-400/30 bg-red-400/5',
            )}>
              <div className="text-[10px] font-mono text-cream-dim/60 mb-0.5">{pos}</div>
              <div className={cn('text-base font-display font-bold', letterGradeColor(letter))}>{letter}</div>
              {(count === 0 || grade < 45) && <div className="text-[8px] text-gold mt-0.5">NEED</div>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Staff Panel ───────────────────────────────────────────────────────────────
function StaffPanel() {
  const { staff, upgradeStaff } = useScoutingStore();
  const handleUpgrade = (level: (typeof STAFF_TIERS)[number]['level'], label: string) => {
    const ok = upgradeStaff(level);
    if (ok) addToast(`Scouting upgraded → ${label}`, 'success');
  };
  const currentIdx = STAFF_TIERS.findIndex(t => t.level === staff.level);
  const currentTier = STAFF_TIERS[currentIdx];
  const nextTier = STAFF_TIERS[currentIdx + 1];

  return (
    <div className="rounded-xl border border-navy-lighter bg-navy-light/20 p-4">
      <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider mb-3">Scouting Staff</p>
      <div className="mb-4 rounded-lg border border-gold/20 bg-gold/5 p-3">
        <div className="flex justify-between items-start mb-1">
          <span className="font-display text-sm text-gold">{currentTier?.label}</span>
          <span className="text-[10px] font-mono text-cream-dim/50">${(staff.budget / 1000).toFixed(1)}M/yr</span>
        </div>
        <p className="text-[10px] font-mono text-cream-dim/50 mb-2">{currentTier?.description}</p>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-cream-dim/40 w-14 shrink-0">Accuracy</span>
          <div className="flex-1 h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
            <div className="h-full bg-gold/60 rounded-full transition-all" style={{ width: `${(staff.accuracy / 90) * 100}%` }} />
          </div>
          <span className="text-[10px] font-mono text-gold">{staff.accuracy}%</span>
        </div>
      </div>

      <div className="space-y-1 mb-4">
        {STAFF_TIERS.map((tier, i) => {
          const isActive = tier.level === staff.level;
          const isUnlocked = i <= currentIdx;
          return (
            <div key={tier.level} className={cn('flex items-center gap-2 px-2 py-1 rounded', isActive && 'bg-gold/10')}>
              <span className={cn('text-[9px]', isActive ? 'text-gold' : isUnlocked ? 'text-green-light/60' : 'text-cream-dim/20')}>
                {isActive ? '▶' : isUnlocked ? '✓' : '○'}
              </span>
              <span className={cn('text-[10px] font-mono flex-1', isActive ? 'text-cream' : isUnlocked ? 'text-cream-dim/60' : 'text-cream-dim/25')}>
                {tier.label}
              </span>
              <span className={cn('text-[9px] font-mono', isActive ? 'text-gold/80' : isUnlocked ? 'text-cream-dim/40' : 'text-cream-dim/20')}>
                {tier.accuracy}%
              </span>
            </div>
          );
        })}
      </div>

      {nextTier ? (
        <button
          onClick={() => handleUpgrade(nextTier.level, nextTier.label)}
          className="w-full py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-xs font-mono hover:bg-gold/25 active:bg-gold/35 transition-colors"
        >
          ↑ Upgrade → {nextTier.label}
          <span className="text-gold/50 ml-1.5">(${(nextTier.budget / 1000).toFixed(1)}M/yr)</span>
        </button>
      ) : (
        <div className="text-center text-[10px] font-mono text-gold/40 py-1">✦ Maximum scouting capability</div>
      )}
    </div>
  );
}

// ── Scout Card ────────────────────────────────────────────────────────────────
function ScoutCard({
  player, team, isOwnTeam, report, isPending, onSelect, selected, onScout,
}: {
  player: Player; team: Team; isOwnTeam: boolean; report: PlayerScoutingReport | null;
  isPending: boolean; onSelect: (p: Player) => void; selected: boolean; onScout: () => void;
}) {
  const isP = isPitcherPos(player.position);
  const posColor = isP ? 'bg-blue-400/20 text-blue-400' : 'bg-green-light/20 text-green-light';

  // Compute own-team true grades
  const b = player.batting;
  const pi = player.pitching;
  const fld = player.fielding[0];
  const veloGrade = Math.max(20, Math.min(80, Math.round(((pi.velocity - 85) / 15) * 60 + 20)));

  const ownGrades: Record<string, number> = isP
    ? { VELO: veloGrade, STF: to80(pi.stuff), MOV: to80(pi.movement), CTL: to80(pi.control) }
    : { HIT: to80((b.contact_L + b.contact_R) / 2), PWR: to80((b.power_L + b.power_R) / 2), SPD: to80(b.speed), FLD: fld ? to80(fld.range) : 40, EYE: to80(b.eye) };

  const pillLabels = isP ? ['VELO', 'STF', 'MOV', 'CTL'] : ['HIT', 'PWR', 'SPD', 'FLD', 'EYE'];
  const gradeKeyMap: Record<string, string> = {
    VELO: 'Velocity', STF: 'Stuff', MOV: 'Movement', CTL: 'Control',
    HIT: 'Hit', PWR: 'Power', SPD: 'Run', FLD: 'Field', EYE: 'Eye',
  };

  // Display overall
  const trueOverall = overallFromPlayer(player);
  const scoutedOverall = report?.overallGrade.scoutedGrade ?? null;
  const displayOverall = isOwnTeam ? trueOverall : scoutedOverall;
  const displayLetter = displayOverall !== null ? letterGrade(displayOverall) : null;

  const projLabel = isOwnTeam ? projFromPlayer(player) : (report?.projectedRole ?? 'Unscouted');

  // ── Unscouted opponent ──────────────────────────────────────────────────────
  if (!isOwnTeam && !report && !isPending) {
    return (
      <div
        onClick={() => onSelect(player)}
        className={cn(
          'rounded-xl border cursor-pointer transition-all duration-200',
          selected ? 'border-gold/40 bg-navy-lighter/15' : 'border-navy-lighter/40 bg-navy-lighter/5',
          'hover:border-navy-lighter hover:bg-navy-lighter/10',
        )}
      >
        <div className="px-3 pt-3 pb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={cn('inline-block px-1.5 py-px rounded text-[9px] font-bold font-mono uppercase', posColor)}>{player.position}</span>
              <span className="text-[10px] font-mono text-cream-dim/40">Age {player.age} · {team.abbreviation}</span>
            </div>
            <p className="font-display text-cream text-sm tracking-wide leading-tight">{player.firstName} {player.lastName}</p>
            <p className="text-[10px] font-mono text-cream-dim/30 mt-0.5">🔒 Unscouted</p>
          </div>
          <div className="text-center ml-2 shrink-0">
            <div className="text-xl font-display font-bold text-cream-dim/20">??</div>
            <div className="text-[8px] font-mono text-cream-dim/15 uppercase tracking-wider">grade</div>
          </div>
        </div>
        <div className="px-3 pb-2 space-y-1">
          {pillLabels.map(lbl => <FogGradeBar key={lbl} label={lbl} report={undefined} />)}
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={e => { e.stopPropagation(); onScout(); }}
            className="w-full py-1.5 rounded-lg bg-gold text-navy text-xs font-mono font-bold hover:bg-gold/90 active:bg-gold/80 transition-colors"
          >
            🔭 Scout Player
          </button>
        </div>
      </div>
    );
  }

  // ── Pending ─────────────────────────────────────────────────────────────────
  if (!isOwnTeam && isPending) {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/5 animate-pulse">
        <div className="px-3 pt-3 pb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn('inline-block px-1.5 py-px rounded text-[9px] font-bold font-mono uppercase', posColor)}>{player.position}</span>
              <span className="text-[10px] font-mono text-cream-dim/40">Age {player.age} · {team.abbreviation}</span>
            </div>
            <p className="font-display text-cream text-sm tracking-wide">{player.firstName} {player.lastName}</p>
            <p className="text-[10px] font-mono text-gold/60 mt-0.5">Scouting…</p>
          </div>
          <div className="text-2xl text-gold/30 ml-2">⏳</div>
        </div>
        <div className="px-3 pb-3 text-center">
          <span className="text-[10px] font-mono text-gold/40">Generating report…</span>
        </div>
      </div>
    );
  }

  // ── Own team or scouted ─────────────────────────────────────────────────────
  return (
    <div
      onClick={() => onSelect(player)}
      className={cn(
        'rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01]',
        'hover:border-gold/40 hover:bg-navy-lighter/20',
        selected ? 'border-gold bg-gold/5 shadow-[0_0_20px_rgba(212,168,67,0.12)]' : 'border-navy-lighter bg-navy-light/20',
      )}
    >
      <div className="px-3 pt-3 pb-2 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={cn('inline-block px-1.5 py-px rounded text-[9px] font-bold font-mono uppercase', posColor)}>{player.position}</span>
            <span className="text-[10px] font-mono text-cream-dim/40">Age {player.age} · {team.abbreviation}</span>
            {!isOwnTeam && report?.riskLevel && riskBadge(report.riskLevel)}
          </div>
          <p className="font-display text-cream text-sm tracking-wide leading-tight">{player.firstName} {player.lastName}</p>
          <p className="text-[10px] font-mono text-cream-dim/40 mt-0.5 truncate">{projLabel}</p>
        </div>
        <div className="text-center shrink-0 ml-2">
          <div className={cn('text-2xl font-display font-bold leading-none', displayLetter ? letterGradeColor(displayLetter) : 'text-cream-dim/20')}>
            {displayLetter ?? '??'}
          </div>
          <div className="text-[9px] font-mono text-cream-dim/40">{displayOverall ?? '—'}</div>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-1">
        {pillLabels.map(lbl => {
          if (isOwnTeam) return <GradeBar key={lbl} label={lbl} grade={ownGrades[lbl] ?? 40} />;
          const key = gradeKeyMap[lbl];
          return <FogGradeBar key={lbl} label={lbl} report={key ? report?.grades[key] : undefined} />;
        })}
      </div>
      {!isOwnTeam && report && (
        <div className="px-3 pb-2 pt-1 border-t border-navy-lighter/20">
          <button
            onClick={e => { e.stopPropagation(); onScout(); }}
            className="w-full py-0.5 text-[10px] font-mono text-cream-dim/25 hover:text-cream-dim/50 transition-colors"
          >
            ↻ Re-scout
          </button>
        </div>
      )}
    </div>
  );
}

// ── Detailed Report ───────────────────────────────────────────────────────────
function DetailedReport({
  player, team, isOwnTeam, report, onScout, isPending,
}: {
  player: Player; team: Team; isOwnTeam: boolean; report: PlayerScoutingReport | null;
  onScout: () => void; isPending: boolean;
}) {
  const isP = isPitcherPos(player.position);
  const batsThrows = `${player.bats === 'S' ? 'S' : player.bats} / ${player.throws}`;

  const trueOverall = overallFromPlayer(player);
  const trueLetter = letterGrade(trueOverall);
  const displayOverall = isOwnTeam ? trueOverall : (report?.overallGrade.scoutedGrade ?? null);
  const displayLetter = isOwnTeam ? trueLetter : (displayOverall !== null ? letterGrade(displayOverall) : null);

  const b = player.batting;
  const pi = player.pitching;
  const fld = player.fielding[0];
  const veloGrade = Math.max(20, Math.min(80, Math.round(((pi.velocity - 85) / 15) * 60 + 20)));

  const posColor = isP ? 'bg-blue-400/20 text-blue-400' : 'bg-green-light/20 text-green-light';

  if (!isOwnTeam && !report && !isPending) {
    return (
      <div className="text-center py-10 px-4 space-y-4">
        <div className="text-4xl">🔭</div>
        <p className="font-display text-gold text-lg tracking-wide">{player.firstName} {player.lastName}</p>
        <p className="font-mono text-cream-dim/50 text-xs">{player.position} · Age {player.age} · {team.city} {team.name}</p>
        <p className="font-mono text-cream-dim/40 text-xs leading-relaxed">
          No scouting report available. Scout this player to reveal grades, projected role, and risk assessment.
        </p>
        <button
          onClick={onScout}
          className="mt-2 px-4 py-2 rounded-lg bg-gold text-navy text-sm font-mono font-bold hover:bg-gold/90 transition-colors"
        >
          🔭 Scout Player
        </button>
      </div>
    );
  }

  if (!isOwnTeam && isPending) {
    return (
      <div className="text-center py-10 px-4 space-y-3 animate-pulse">
        <div className="text-4xl">⏳</div>
        <p className="font-display text-gold/70 text-lg">Scouting in progress…</p>
        <p className="font-mono text-cream-dim/40 text-xs">Generating report for {player.firstName} {player.lastName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase', posColor)}>
              {player.position}
            </span>
            <span className="text-xs font-mono text-cream-dim/50">#{player.number} · Age {player.age} · B/T: {batsThrows}</span>
            {!isOwnTeam && report?.riskLevel && riskBadge(report.riskLevel)}
          </div>
          <h2 className="font-display text-2xl text-gold tracking-wide leading-tight">{player.firstName} {player.lastName}</h2>
          <p className="font-mono text-cream-dim/60 text-xs mt-0.5">{team.city} {team.name}</p>
        </div>
        <div className="text-center shrink-0">
          <div className={cn('text-5xl font-display font-bold leading-none', displayLetter ? letterGradeColor(displayLetter) : 'text-cream-dim/20')}>
            {displayLetter ?? '??'}
          </div>
          <div className="text-xs font-mono text-cream-dim/40 mt-0.5">{displayOverall ?? '—'}/80</div>
          {!isOwnTeam && report && (
            <div className="text-[9px] font-mono text-cream-dim/30">±{report.overallGrade.margin}</div>
          )}
        </div>
      </div>

      {/* Projection bar */}
      <div className="rounded-lg border border-navy-lighter bg-navy-light/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider">Projected Role</span>
          <span className="text-xs font-mono font-bold text-gold">
            {isOwnTeam ? projFromPlayer(player) : (report?.projectedRole ?? '—')}
          </span>
        </div>
        {isOwnTeam && (
          <div className="flex items-center gap-3 justify-around mt-1">
            {[
              { label: 'Floor', g: Math.max(20, trueOverall - 10) },
              { label: 'Current', g: trueOverall },
              { label: 'Ceiling', g: Math.min(80, trueOverall + (player.age <= 25 ? 15 : player.age <= 28 ? 8 : 4)) },
            ].map(({ label, g }, i, arr) => (
              <div key={label} className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[10px] font-mono text-cream-dim/40 mb-1">{label}</div>
                  <div className={cn('text-xl font-display font-bold', letterGradeColor(letterGrade(g)))}>{letterGrade(g)}</div>
                  <div className="text-[10px] font-mono text-cream-dim/40">{g}</div>
                </div>
                {i < arr.length - 1 && <div className="w-px h-10 bg-navy-lighter" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tool grades */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider">20-80 Tool Grades</p>
        {isOwnTeam ? (
          isP ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1"><GradeBar label="VELOCITY" grade={veloGrade} /></div>
                <span className="text-[10px] font-mono text-cream-dim/40 shrink-0">{pi.velocity} mph</span>
              </div>
              <GradeBar label="STUFF" grade={to80(pi.stuff)} />
              <GradeBar label="MOVEMENT" grade={to80(pi.movement)} />
              <GradeBar label="CONTROL" grade={to80(pi.control)} />
              <GradeBar label="STAMINA" grade={to80(pi.stamina)} />
            </>
          ) : (
            <>
              <GradeBar label="HIT" grade={to80((b.contact_L + b.contact_R) / 2)} />
              <GradeBar label="POWER" grade={to80((b.power_L + b.power_R) / 2)} />
              <GradeBar label="RUN" grade={to80(b.speed)} />
              <GradeBar label="FIELD" grade={fld ? to80(fld.range) : 40} />
              <GradeBar label="ARM" grade={fld ? to80(fld.arm_strength) : 40} />
              <GradeBar label="EYE" grade={to80(b.eye)} />
            </>
          )
        ) : (
          report && (isP ? (
            <>
              <FogGradeBar label="VELOCITY" report={report.grades['Velocity']} />
              <FogGradeBar label="STUFF" report={report.grades['Stuff']} />
              <FogGradeBar label="MOVEMENT" report={report.grades['Movement']} />
              <FogGradeBar label="CONTROL" report={report.grades['Control']} />
              <FogGradeBar label="STAMINA" report={report.grades['Stamina']} />
            </>
          ) : (
            <>
              <FogGradeBar label="HIT" report={report.grades['Hit']} />
              <FogGradeBar label="POWER" report={report.grades['Power']} />
              <FogGradeBar label="RUN" report={report.grades['Run']} />
              <FogGradeBar label="FIELD" report={report.grades['Field']} />
              <FogGradeBar label="ARM" report={report.grades['Arm']} />
              <FogGradeBar label="EYE" report={report.grades['Eye']} />
            </>
          ))
        )}
      </div>

      {/* Scout notes (opponent) */}
      {!isOwnTeam && report && report.scoutNotes.length > 0 && (
        <div className="rounded-lg border border-navy-lighter bg-navy-light/20 p-3">
          <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider mb-2">Scout Notes</p>
          <div className="space-y-1.5">
            {report.scoutNotes.map((note, i) => (
              <p key={i} className="text-sm font-mono text-cream-dim/70 leading-relaxed">• {note}</p>
            ))}
          </div>
          {report.isFoggy && (
            <p className="text-[10px] font-mono text-gold/40 mt-2 border-t border-navy-lighter/30 pt-2">
              ⚠ Low-confidence report — upgrade staff or re-scout to improve accuracy
            </p>
          )}
        </div>
      )}

      {/* Intangibles (own team only) */}
      {isOwnTeam && (
        <div className="rounded-lg border border-navy-lighter bg-navy-light/20 p-3">
          <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider mb-2">Intangibles</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Work Ethic', val: player.mental.work_ethic },
              { label: 'Composure', val: player.mental.composure },
              { label: 'Leadership', val: player.mental.leadership },
              { label: 'Durability', val: player.mental.durability },
              { label: 'Consistency', val: player.mental.consistency },
              { label: 'Intel', val: player.mental.intelligence },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className={cn('text-lg font-mono font-bold', gradeColor(to80(val)))}>{to80(val)}</div>
                <div className="text-[9px] font-mono text-cream-dim/40">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report accuracy meter (opponent) */}
      {!isOwnTeam && report && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[9px] font-mono text-cream-dim/30 uppercase shrink-0">Report accuracy</span>
          <div className="flex-1 h-1 bg-navy-lighter/20 rounded-full overflow-hidden">
            <div className="h-full bg-cream-dim/25 rounded-full transition-all" style={{ width: `${(report.accuracy / 90) * 100}%` }} />
          </div>
          <span className="text-[9px] font-mono text-cream-dim/30">{report.accuracy}%</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type ViewMode = 'roster' | 'league' | 'prospects';
type SortMode = 'overall' | 'age' | 'position' | 'name';

export function ScoutingPage() {
  const navigate = useNavigate();
  const openPlayer = usePlayerModal(s => s.openPlayer);
  const { season, engine, userTeamId } = useFranchiseStore();
  const { getReport, isPending, scoutPlayer, scoutOwnRoster } = useScoutingStore();

  const [view, setView] = useState<ViewMode>('roster');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState<Team | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('overall');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(36);

  // All hooks must be before any conditional return (Rules of Hooks)
  useEffect(() => {
    if (userTeamId) scoutOwnRoster(userTeamId);
  }, [userTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use optional chaining so these run unconditionally even before franchise is loaded
  const allTeams = useMemo(() => engine?.getAllTeams() ?? [], [engine]);
  const userTeam = useMemo(() => engine?.getTeam(userTeamId ?? '') ?? null, [engine, userTeamId]);

  const allLeaguePlayers = useMemo((): { player: Player; team: Team }[] => {
    const result: { player: Player; team: Team }[] = [];
    for (const team of allTeams) {
      for (const player of team.roster.players) result.push({ player, team });
    }
    return result;
  }, [allTeams]);

  const topProspects = useMemo(() =>
    allLeaguePlayers
      .filter(({ team }) => team.id !== userTeamId)
      .filter(({ player }) => player.age <= 27)
      .map(({ player, team }) => ({ player, team, score: overallFromPlayer(player) + Math.max(0, 27 - player.age) * 0.5 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15),
  [allLeaguePlayers, userTeamId]);

  const playerPool = useMemo((): { player: Player; team: Team }[] => {
    if (view === 'roster') return userTeam ? userTeam.roster.players.map(p => ({ player: p, team: userTeam })) : [];
    if (view === 'prospects') return topProspects.map(({ player, team }) => ({ player, team }));
    return allLeaguePlayers;
  }, [view, userTeam, allLeaguePlayers, topProspects]);

  const displayedPlayers = useMemo(() => {
    let filtered = playerPool;
    if (posFilter !== 'ALL') filtered = filtered.filter(({ player }) => player.position === posFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(({ player }) =>
        `${player.firstName} ${player.lastName}`.toLowerCase().includes(q) || player.position.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      if (sortMode === 'overall') return overallFromPlayer(b.player) - overallFromPlayer(a.player);
      if (sortMode === 'age') return a.player.age - b.player.age;
      if (sortMode === 'position') return a.player.position.localeCompare(b.player.position);
      return a.player.lastName.localeCompare(b.player.lastName);
    });
  }, [playerPool, posFilter, searchQuery, sortMode]);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Scouting Hub</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Generate detailed scouting reports on any player in the league using 20–80 grades.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  function handleSelect(p: Player) {
    setSelectedPlayer(p);
    const found = allLeaguePlayers.find(({ player }) => player.id === p.id);
    setSelectedPlayerTeam(found?.team ?? null);
  }

  function handleScout(playerId: string, teamId: string, playerName: string) {
    const alreadyScouted = getReport(playerId) !== null;
    if (alreadyScouted) {
      addToast(`${playerName} is already scouted`, 'info');
      return;
    }
    scoutPlayer(playerId, teamId);
    // Toast after 550ms (slightly after the 500ms scouting delay)
    setTimeout(() => {
      const report = useScoutingStore.getState().getReport(playerId);
      if (report) {
        addToast(`Scouting complete: ${playerName} — ${report.overallGrade.scoutedGrade ?? '?'} OVR`, 'success');
      }
    }, 550);
  }

  const POSITIONS = ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  const avgGrade = displayedPlayers.length > 0
    ? Math.round(displayedPlayers.reduce((s, { player }) => s + overallFromPlayer(player), 0) / displayedPlayers.length) : 0;
  const scoutedCount = displayedPlayers.filter(({ player }) => getReport(player.id) !== null).length;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Scouting Hub</h1>
          <p className="font-mono text-cream-dim text-sm mt-0.5">20-80 Tool Grades · Fog of War · Needs Analysis</p>
        </div>
        <div className="flex items-center gap-1 bg-navy-lighter/30 rounded-xl p-1">
          {(['roster', 'league', 'prospects'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => { setView(v); setSelectedPlayer(null); setVisibleCount(36); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all',
                view === v ? 'bg-gold text-navy shadow-[0_1px_3px_rgba(0,0,0,0.3)]' : 'text-cream-dim hover:text-cream',
              )}
            >
              {v === 'roster' ? 'My Roster' : v === 'league' ? 'League' : 'Prospects'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        {/* Left column */}
        <div className="space-y-4 min-w-0">
          {view === 'roster' && userTeam && <TeamNeedsPanel userTeam={userTeam} />}

          {/* Stats bar */}
          {displayedPlayers.length > 0 && (
            <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-navy-lighter/20 border border-navy-lighter/30 flex-wrap">
              <div>
                <span className="text-[10px] font-mono text-cream-dim/50 uppercase">Players</span>
                <div className="text-lg font-mono font-bold text-cream">{displayedPlayers.length}</div>
              </div>
              <div className="w-px h-8 bg-navy-lighter/50" />
              <div>
                <span className="text-[10px] font-mono text-cream-dim/50 uppercase">Avg Grade</span>
                <div className={cn('text-lg font-mono font-bold', gradeColor(avgGrade))}>{avgGrade}</div>
              </div>
              {view !== 'roster' && (
                <>
                  <div className="w-px h-8 bg-navy-lighter/50" />
                  <div>
                    <span className="text-[10px] font-mono text-cream-dim/50 uppercase">Scouted</span>
                    <div className="text-lg font-mono font-bold text-cream-dim">
                      {scoutedCount}<span className="text-cream-dim/30 text-sm">/{displayedPlayers.length}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search player..."
              className="px-3 py-1.5 rounded-lg bg-navy-lighter/30 border border-navy-lighter text-sm font-mono text-cream placeholder-cream-dim/25 focus:outline-none focus:border-gold/40 flex-1 min-w-[120px]"
            />
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="px-2 py-1.5 rounded-lg bg-navy-lighter/30 border border-navy-lighter text-xs font-mono text-cream focus:outline-none focus:border-gold/40"
            >
              <option value="overall">↓ Overall</option>
              <option value="age">Age ↑</option>
              <option value="position">Position</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map(pos => (
              <button
                key={pos}
                onClick={() => { setPosFilter(pos); setVisibleCount(36); }}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all',
                  posFilter === pos
                    ? 'bg-gold/20 text-gold border border-gold/40'
                    : 'bg-navy-lighter/20 text-cream-dim/50 border border-transparent hover:text-cream hover:bg-navy-lighter/40',
                )}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Player grid */}
          {displayedPlayers.length === 0 ? (
            <Panel>
              <p className="font-mono text-cream-dim text-sm text-center py-8">No players match your filters.</p>
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedPlayers.slice(0, visibleCount).map(({ player, team }) => {
                  const isOwnTeam = team.id === userTeamId;
                  return (
                    <ScoutCard
                      key={player.id}
                      player={player}
                      team={team}
                      isOwnTeam={isOwnTeam}
                      report={getReport(player.id)}
                      isPending={isPending(player.id)}
                      onSelect={handleSelect}
                      selected={selectedPlayer?.id === player.id}
                      onScout={() => handleScout(player.id, team.id, `${player.firstName} ${player.lastName}`)}
                    />
                  );
                })}
              </div>
              {displayedPlayers.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(c => c + 36)}
                  className="w-full mt-3 py-2 font-mono text-xs text-cream-dim/50 hover:text-cream-dim border border-dashed border-navy-lighter/60 hover:border-navy-lighter rounded-lg transition-all"
                >
                  ▼ Show more ({displayedPlayers.length - visibleCount} remaining)
                </button>
              )}
              {visibleCount > 36 && (
                <button
                  onClick={() => setVisibleCount(36)}
                  className="w-full py-1 font-mono text-xs text-cream-dim/30 hover:text-cream-dim/50 transition-colors"
                >
                  ▲ Collapse
                </button>
              )}
            </>
          )}
        </div>

        {/* Right column */}
        <div className="xl:sticky xl:top-6 xl:self-start space-y-4">
          {selectedPlayer && selectedPlayerTeam ? (
            <Panel className="transition-all">
              <DetailedReport
                player={selectedPlayer}
                team={selectedPlayerTeam}
                isOwnTeam={selectedPlayerTeam.id === userTeamId}
                report={getReport(selectedPlayer.id)}
                onScout={() => handleScout(selectedPlayer.id, selectedPlayerTeam.id, `${selectedPlayer.firstName} ${selectedPlayer.lastName}`)}
                isPending={isPending(selectedPlayer.id)}
              />
              <div className="mt-4 pt-3 border-t border-navy-lighter/30 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => { openPlayer(selectedPlayer.id); setSelectedPlayer(null); }}
                >
                  View Full Profile
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setSelectedPlayer(null)}>
                  Dismiss
                </Button>
              </div>
            </Panel>
          ) : (
            <Panel>
              <div className="text-center py-10 px-4 space-y-3">
                <div className="text-4xl">🔭</div>
                <p className="font-display text-gold text-lg tracking-wide">Scout Report</p>
                <p className="font-mono text-cream-dim/60 text-xs leading-relaxed">
                  Your roster is fully scouted. Browse the League or Prospects tabs and click Scout to reveal opponent grades through the fog of war.
                </p>
              </div>
            </Panel>
          )}

          <StaffPanel />

          <div className="rounded-xl border border-navy-lighter bg-navy-light/20 p-4">
            <p className="text-[10px] font-mono text-cream-dim/50 uppercase tracking-wider mb-3">20-80 Scale</p>
            <div className="space-y-1">
              {[
                { g: 80, label: 'Elite / Hall of Fame' },
                { g: 70, label: 'Plus Plus / All-Star' },
                { g: 60, label: 'Plus / Solid Regular' },
                { g: 50, label: 'Average MLB Player' },
                { g: 45, label: 'Below Average' },
                { g: 40, label: 'Fringe MLB' },
                { g: 30, label: 'Below Replacement' },
                { g: 20, label: 'Non-Prospect' },
              ].map(({ g, label }) => (
                <div key={g} className="flex items-center gap-2">
                  <div className={cn('w-6 h-4 rounded flex items-center justify-center text-[10px] font-bold font-mono', gradeColor(g))}>
                    {g}
                  </div>
                  <span className="text-[10px] font-mono text-cream-dim/50">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
