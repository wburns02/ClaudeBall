/**
 * ProspectCard — a beautiful baseball-card-style scouting report.
 * Shows 20-80 grades, ceiling/floor projections, development trajectory,
 * risk assessment, and player comparables.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';

// ── 20-80 Scale ─────────────────────────────────────────────────
function to80(val: number): number {
  return Math.round(Math.max(20, Math.min(80, 20 + (val / 100) * 60)) / 5) * 5;
}

function gradeColor(g: number): string {
  if (g >= 70) return '#d4a843';
  if (g >= 60) return '#22c55e';
  if (g >= 50) return '#e8e0d4';
  if (g >= 40) return '#f59e0b';
  return '#ef4444';
}

function gradeLabel(g: number): string {
  if (g >= 80) return 'Elite';
  if (g >= 70) return 'Plus+';
  if (g >= 60) return 'Plus';
  if (g >= 50) return 'Average';
  if (g >= 40) return 'Below';
  return 'Poor';
}

// ── Risk Assessment ─────────────────────────────────────────────
function assessRisk(player: Player): { level: 'Low' | 'Medium' | 'High'; reason: string } {
  const age = player.age;
  const mental = player.mental;
  const consistency = mental.consistency;
  const durability = mental.durability;

  if (age >= 30 && durability < 50) return { level: 'High', reason: 'Age + injury risk' };
  if (consistency < 40) return { level: 'High', reason: 'Inconsistent performer' };
  if (age <= 23 && consistency >= 60 && durability >= 60) return { level: 'Low', reason: 'Young + durable + consistent' };
  if (durability < 45) return { level: 'Medium', reason: 'Durability concerns' };
  if (mental.work_ethic < 40) return { level: 'Medium', reason: 'Work ethic questions' };
  return { level: 'Low', reason: 'Solid across the board' };
}

// ── Player Comparables ──────────────────────────────────────────
const BATTER_COMPS = [
  { min: 80, name: 'Mike Trout', desc: 'Generational five-tool talent' },
  { min: 70, name: 'Ronald Acuna Jr.', desc: 'Elite power-speed combo' },
  { min: 65, name: 'Juan Soto', desc: 'Exceptional plate discipline' },
  { min: 60, name: 'Mookie Betts', desc: 'Complete player, plus defense' },
  { min: 55, name: 'Marcus Semien', desc: 'Steady two-way contributor' },
  { min: 50, name: 'Whit Merrifield', desc: 'Versatile contact hitter' },
  { min: 40, name: 'Adam Frazier', desc: 'Solid everyday player' },
  { min: 0, name: 'Minor league journeyman', desc: 'Organizational depth' },
];

const PITCHER_COMPS = [
  { min: 80, name: 'Jacob deGrom', desc: 'Dominant ace, elite stuff' },
  { min: 70, name: 'Gerrit Cole', desc: 'Power pitcher, high strikeouts' },
  { min: 65, name: 'Corbin Burnes', desc: 'Nasty pitch mix, elite command' },
  { min: 60, name: 'Logan Webb', desc: 'Ground-ball machine, durable' },
  { min: 55, name: 'Marcus Stroman', desc: 'Competitive mid-rotation arm' },
  { min: 50, name: 'Patrick Corbin', desc: 'Solid back-end starter' },
  { min: 40, name: 'Bullpen arm', desc: 'Relief role ceiling' },
  { min: 0, name: 'Minor league depth', desc: 'Organizational arm' },
];

function getComp(ovr: number, isPitcher: boolean) {
  const comps = isPitcher ? PITCHER_COMPS : BATTER_COMPS;
  return comps.find(c => ovr >= c.min) ?? comps[comps.length - 1]!;
}

// ── Tool Bar ────────────────────────────────────────────────────
function ToolBar({ label, current, potential, delay }: { label: string; current: number; potential: number; delay?: number }) {
  const curColor = gradeColor(current);
  const potColor = gradeColor(potential);
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="font-mono text-[10px] text-cream-dim/60 w-14 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 relative h-2.5 bg-navy-lighter/30 rounded-full overflow-hidden">
        {/* Potential (background) */}
        <div className="absolute inset-y-0 left-0 rounded-full opacity-30 transition-all duration-700" style={{ width: `${(potential / 80) * 100}%`, backgroundColor: potColor, transitionDelay: `${delay ?? 0}ms` }} />
        {/* Current (foreground) */}
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${(current / 80) * 100}%`, backgroundColor: curColor }} />
      </div>
      <div className="flex items-center gap-1 shrink-0 w-16 justify-end">
        <span className="font-mono text-[11px] font-bold" style={{ color: curColor }}>{current}</span>
        <span className="font-mono text-[9px] text-cream-dim/30">/</span>
        <span className="font-mono text-[11px]" style={{ color: potColor }}>{potential}</span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
interface Props {
  player: Player;
  teamName: string;
  teamAbbr: string;
  compact?: boolean;
}

export function ProspectCard({ player, teamName, teamAbbr, compact }: Props) {
  const isPitcher = player.position === 'P';
  const ovr = Math.round(evaluatePlayer(player));
  const ovrGrade = to80(ovr);
  const name = getPlayerName(player);
  const risk = assessRisk(player);
  const comp = getComp(ovr, isPitcher);

  // Generate tools with current/potential grades
  const tools = useMemo(() => {
    if (isPitcher) {
      return [
        { label: 'Fastball', current: to80(player.pitching.velocity), potential: to80(Math.min(100, player.pitching.velocity + (player.age < 27 ? 8 : 0))) },
        { label: 'Stuff', current: to80(player.pitching.stuff), potential: to80(Math.min(100, player.pitching.stuff + (player.age < 27 ? 10 : 0))) },
        { label: 'Movement', current: to80(player.pitching.movement), potential: to80(Math.min(100, player.pitching.movement + (player.age < 27 ? 8 : 0))) },
        { label: 'Control', current: to80(player.pitching.control), potential: to80(Math.min(100, player.pitching.control + (player.age < 27 ? 12 : 0))) },
        { label: 'Stamina', current: to80(player.pitching.stamina), potential: to80(player.pitching.stamina) },
      ];
    }
    return [
      { label: 'Hit', current: to80(Math.round((player.batting.contact_L + player.batting.contact_R) / 2)), potential: to80(Math.min(100, Math.round((player.batting.contact_L + player.batting.contact_R) / 2) + (player.age < 27 ? 10 : 0))) },
      { label: 'Power', current: to80(Math.round((player.batting.power_L + player.batting.power_R) / 2)), potential: to80(Math.min(100, Math.round((player.batting.power_L + player.batting.power_R) / 2) + (player.age < 27 ? 12 : 0))) },
      { label: 'Eye', current: to80(player.batting.eye), potential: to80(Math.min(100, player.batting.eye + (player.age < 27 ? 8 : 0))) },
      { label: 'Speed', current: to80(player.batting.speed), potential: to80(Math.max(20, player.batting.speed - (player.age > 30 ? 5 : 0))) },
      { label: 'Field', current: to80(player.batting.gap_power), potential: to80(Math.min(100, player.batting.gap_power + (player.age < 27 ? 5 : 0))) },
    ];
  }, [player, isPitcher]);

  // Ceiling/Floor projections
  const ceiling = Math.min(80, ovrGrade + (player.age < 27 ? 10 : player.age < 30 ? 5 : 0));
  const floor = Math.max(20, ovrGrade - (risk.level === 'High' ? 15 : risk.level === 'Medium' ? 10 : 5));

  // Development phase
  const devPhase = player.age <= 26 ? 'Growth' : player.age <= 31 ? 'Peak' : player.age <= 36 ? 'Decline' : 'Late Career';
  const devColor = devPhase === 'Growth' ? 'text-green-light' : devPhase === 'Peak' ? 'text-gold' : devPhase === 'Decline' ? 'text-orange-400' : 'text-red-400';

  const riskColor = risk.level === 'Low' ? 'text-green-light border-green-light/30 bg-green-900/15' : risk.level === 'Medium' ? 'text-gold border-gold/30 bg-gold/10' : 'text-red-400 border-red-400/30 bg-red-900/15';

  return (
    <div className={cn(
      'rounded-xl border border-navy-lighter/60 bg-gradient-to-b from-navy-light to-navy overflow-hidden',
      'shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]',
      compact ? 'max-w-xs' : 'max-w-sm',
    )}>
      {/* Header */}
      <div className="bg-gradient-to-r from-gold/15 to-transparent px-4 py-3 border-b border-navy-lighter/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[9px] text-gold/50 uppercase tracking-widest">{teamAbbr} · {player.position} · Age {player.age}</p>
            <h3 className="font-display text-xl text-gold uppercase tracking-wide truncate">{name}</h3>
            <p className="font-mono text-[10px] text-cream-dim/50">{teamName}</p>
          </div>
          <div className="text-center shrink-0">
            <div className="w-14 h-14 rounded-lg border-2 flex items-center justify-center" style={{ borderColor: `${gradeColor(ovrGrade)}60`, backgroundColor: `${gradeColor(ovrGrade)}15` }}>
              <span className="font-display text-2xl font-bold" style={{ color: gradeColor(ovrGrade) }}>{ovrGrade}</span>
            </div>
            <p className="font-mono text-[8px] mt-0.5" style={{ color: gradeColor(ovrGrade) }}>{gradeLabel(ovrGrade)}</p>
          </div>
        </div>
      </div>

      {/* Tools / 20-80 Grades */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[9px] text-cream-dim/40 uppercase tracking-widest">20-80 Tool Grades</p>
          <p className="font-mono text-[8px] text-cream-dim/30">NOW / PROJ</p>
        </div>
        {tools.map((t, i) => <ToolBar key={t.label} {...t} delay={i * 80} />)}
      </div>

      {/* Projection + Risk */}
      <div className="grid grid-cols-3 divide-x divide-navy-lighter/30 border-t border-navy-lighter/30">
        <div className="px-3 py-2.5 text-center">
          <p className="font-mono text-[8px] text-cream-dim/40 uppercase tracking-wider">Ceiling</p>
          <p className="font-display text-lg font-bold" style={{ color: gradeColor(ceiling) }}>{ceiling}</p>
          <p className="font-mono text-[8px]" style={{ color: gradeColor(ceiling) }}>{gradeLabel(ceiling)}</p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="font-mono text-[8px] text-cream-dim/40 uppercase tracking-wider">Floor</p>
          <p className="font-display text-lg font-bold" style={{ color: gradeColor(floor) }}>{floor}</p>
          <p className="font-mono text-[8px]" style={{ color: gradeColor(floor) }}>{gradeLabel(floor)}</p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="font-mono text-[8px] text-cream-dim/40 uppercase tracking-wider">Phase</p>
          <p className={cn('font-display text-sm font-bold', devColor)}>{devPhase}</p>
        </div>
      </div>

      {/* Risk + Comparable */}
      <div className="px-4 py-3 border-t border-navy-lighter/30 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border', riskColor)}>
            {risk.level} Risk
          </span>
          <span className="font-mono text-[9px] text-cream-dim/40">{risk.reason}</span>
        </div>
        <div className="rounded-md bg-navy-lighter/15 border border-navy-lighter/25 px-3 py-2">
          <p className="font-mono text-[8px] text-cream-dim/40 uppercase tracking-wider mb-0.5">Player Comp</p>
          <p className="font-display text-sm text-cream">{comp.name}</p>
          <p className="font-mono text-[9px] text-cream-dim/50">{comp.desc}</p>
        </div>
      </div>

      {/* Mental Ratings */}
      <div className="px-4 py-2.5 border-t border-navy-lighter/30 bg-navy/40">
        <p className="font-mono text-[8px] text-cream-dim/30 uppercase tracking-wider mb-1.5">Intangibles</p>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'IQ', val: player.mental.intelligence },
            { label: 'Work', val: player.mental.work_ethic },
            { label: 'Dur', val: player.mental.durability },
            { label: 'Poise', val: player.mental.composure },
            { label: 'Lead', val: player.mental.leadership },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className="font-mono text-[9px] font-bold" style={{ color: gradeColor(to80(m.val)) }}>{to80(m.val)}</p>
              <p className="font-mono text-[7px] text-cream-dim/30 uppercase">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
