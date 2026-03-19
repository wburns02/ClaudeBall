import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Team } from '@/engine/types/team.ts';
import type { ProspectDevelopmentEvent } from '@/engine/season/MinorLeagues.ts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function grade20to80(raw: number): number {
  // raw is already roughly 20–85 scale from the engine
  return Math.max(20, Math.min(80, Math.round(raw / 5) * 5));
}

function gradeColor(g: number): string {
  if (g >= 75) return 'text-gold';
  if (g >= 65) return 'text-green-light';
  if (g >= 55) return 'text-blue-300';
  if (g >= 45) return 'text-cream';
  if (g >= 35) return 'text-orange-400';
  return 'text-red-400';
}

function gradeBg(g: number): string {
  if (g >= 75) return 'bg-gold';
  if (g >= 65) return 'bg-green-light';
  if (g >= 55) return 'bg-blue-300';
  if (g >= 45) return 'bg-cream/70';
  if (g >= 35) return 'bg-orange-400';
  return 'bg-red-400';
}

function gradeLabel(g: number): string {
  if (g >= 75) return 'Elite';
  if (g >= 65) return 'Plus';
  if (g >= 55) return 'Avg+';
  if (g >= 45) return 'Avg';
  if (g >= 35) return 'Fringe';
  return 'Below';
}

function etaLabel(ovr: number, age: number): { label: string; color: string } {
  if (ovr >= 63) return { label: 'MLB Ready', color: 'text-green-light' };
  if (ovr >= 53) return { label: '~1 yr', color: 'text-blue-300' };
  if (age <= 21) return { label: '3+ yrs', color: 'text-cream-dim' };
  if (ovr >= 43) return { label: '2–3 yrs', color: 'text-cream' };
  return { label: '3+ yrs', color: 'text-cream-dim' };
}

function prospectPotential(ovr: number, age: number): number {
  // Younger players with upside get a potential bonus
  const ageFactor = Math.max(0, 27 - age) * 1.8;
  return Math.min(80, Math.round(ovr + ageFactor));
}

/** Map position + stamina to role label */
function posLabel(p: Player): string {
  if (p.position !== 'P') return p.position;
  return p.pitching.stamina >= 52 ? 'SP' : 'RP';
}

/** Group positions for filter */
type PosFilter = 'All' | 'SP' | 'RP' | 'C' | 'IF' | 'OF';
const POS_FILTERS: PosFilter[] = ['All', 'SP', 'RP', 'C', 'IF', 'OF'];
const IF_POSITIONS = new Set(['1B', '2B', '3B', 'SS', 'DH']);
const OF_POSITIONS = new Set(['LF', 'CF', 'RF']);

function matchesFilter(p: Player, f: PosFilter): boolean {
  if (f === 'All') return true;
  const role = posLabel(p);
  if (f === 'SP') return role === 'SP';
  if (f === 'RP') return role === 'RP';
  if (f === 'C') return p.position === 'C';
  if (f === 'IF') return IF_POSITIONS.has(p.position);
  if (f === 'OF') return OF_POSITIONS.has(p.position);
  return true;
}

type SortKey = 'ovr' | 'potential' | 'age' | 'pos';

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradeBar({ label, value }: { label: string; value: number }) {
  const g = grade20to80(value);
  const pct = ((g - 20) / 60) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-cream-dim/60 w-14 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 bg-navy-lighter/40 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', gradeBg(g))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('font-mono text-[10px] font-bold w-6 text-right', gradeColor(g))}>{g}</span>
    </div>
  );
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  // value 0–80 → star count 0–5
  const stars = Math.round((value / 80) * max);
  return (
    <span className="text-gold text-xs">
      {'★'.repeat(stars)}{'☆'.repeat(max - stars)}
    </span>
  );
}

function ProspectDetailPanel({
  player,
  onCallUp,
  canCallUp,
  onClose,
}: {
  player: Player;
  onCallUp: (id: string) => void;
  canCallUp: boolean;
  onClose: () => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const pot = prospectPotential(ovr, player.age);
  const eta = etaLabel(ovr, player.age);
  const role = posLabel(player);
  const isPitcher = player.position === 'P';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display text-xl text-gold tracking-wide">{getPlayerName(player)}</h2>
          <p className="font-mono text-sm text-cream-dim mt-0.5">
            {role} · Age {player.age} · Bats {player.bats} · Throws {player.throws}
          </p>
        </div>
        <button
          onClick={onClose}
          className="font-mono text-cream-dim/50 hover:text-cream-dim text-lg leading-none mt-0.5"
        >
          ✕
        </button>
      </div>

      {/* OVR / Potential */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-navy-lighter/20 rounded-lg p-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/60 mb-1">CURRENT</p>
          <p className={cn('font-mono text-2xl font-bold', gradeColor(ovr))}>{ovr}</p>
          <p className="font-mono text-[10px] text-cream-dim/40">{gradeLabel(ovr)}</p>
        </div>
        <div className="bg-navy-lighter/20 rounded-lg p-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/60 mb-1">CEILING</p>
          <p className={cn('font-mono text-2xl font-bold', gradeColor(pot))}>{pot}</p>
          <StarRating value={pot} />
        </div>
        <div className="bg-navy-lighter/20 rounded-lg p-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/60 mb-1">ETA</p>
          <p className={cn('font-mono text-sm font-bold mt-1', eta.color)}>{eta.label}</p>
        </div>
      </div>

      {/* Attributes */}
      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
        {isPitcher ? (
          <>
            <div>
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase mb-1.5">Pitching</p>
              <div className="space-y-1.5">
                <GradeBar label="Stuff" value={player.pitching.stuff} />
                <GradeBar label="Movement" value={player.pitching.movement} />
                <GradeBar label="Control" value={player.pitching.control} />
                <GradeBar label="Stamina" value={player.pitching.stamina} />
                <GradeBar label="Hold Run" value={player.pitching.hold_runners} />
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase mb-1">Velocity</p>
              <p className="font-mono text-sm text-cream">{player.pitching.velocity} mph</p>
              <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">
                Repertoire: {player.pitching.repertoire.join(', ')}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase mb-1.5">Batting</p>
              <div className="space-y-1.5">
                <GradeBar label="Contact" value={(player.batting.contact_L + player.batting.contact_R) / 2} />
                <GradeBar label="Power" value={(player.batting.power_L + player.batting.power_R) / 2} />
                <GradeBar label="Eye" value={player.batting.eye} />
                <GradeBar label="Avoid K" value={player.batting.avoid_k} />
                <GradeBar label="Speed" value={player.batting.speed} />
                <GradeBar label="Steal" value={player.batting.steal} />
              </div>
            </div>
            {player.fielding[0] && (
              <div>
                <p className="font-mono text-[10px] text-cream-dim/40 uppercase mb-1.5">Fielding</p>
                <div className="space-y-1.5">
                  <GradeBar label="Range" value={player.fielding[0].range} />
                  <GradeBar label="Arm" value={player.fielding[0].arm_strength} />
                  <GradeBar label="Accuracy" value={player.fielding[0].arm_accuracy} />
                </div>
              </div>
            )}
          </>
        )}

        <div>
          <p className="font-mono text-[10px] text-cream-dim/40 uppercase mb-1.5">Mental</p>
          <div className="space-y-1.5">
            <GradeBar label="Work Eth" value={player.mental.work_ethic} />
            <GradeBar label="Composure" value={player.mental.composure} />
            <GradeBar label="Intel" value={player.mental.intelligence} />
          </div>
        </div>
      </div>

      {/* Actions */}
      {canCallUp && (
        <div className="mt-4 pt-3 border-t border-navy-lighter/30">
          <Button
            className="w-full"
            onClick={() => onCallUp(player.id)}
          >
            ↑ Call Up to MLB
          </Button>
        </div>
      )}
    </div>
  );
}

function DevEventBadge({ delta, type }: { delta: number; type: ProspectDevelopmentEvent['type'] }) {
  if (delta === 0 && type !== 'breakout') return null;
  const isPositive = delta > 0;
  const isBreakout = type === 'breakout';
  return (
    <span className={cn(
      'font-mono text-[9px] font-bold px-1 rounded shrink-0',
      isBreakout ? 'bg-gold/20 text-gold animate-pulse' :
      isPositive ? 'bg-green-900/30 text-green-light' :
      'bg-red-900/30 text-red-400',
    )}>
      {isBreakout ? '⚡' : isPositive ? `▲${delta}` : `▼${Math.abs(delta)}`}
    </span>
  );
}

function ProspectRow({
  player,
  rank,
  isSelected,
  onClick,
  recentDev,
}: {
  player: Player;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
  recentDev?: ProspectDevelopmentEvent;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const pot = prospectPotential(ovr, player.age);
  const eta = etaLabel(ovr, player.age);
  const role = posLabel(player);
  const isPitcher = player.position === 'P';

  // Key attributes to show in the row
  const keyAttrs = isPitcher
    ? [
        { label: 'STF', v: player.pitching.stuff },
        { label: 'MOV', v: player.pitching.movement },
        { label: 'CTL', v: player.pitching.control },
      ]
    : [
        { label: 'CON', v: (player.batting.contact_L + player.batting.contact_R) / 2 },
        { label: 'PWR', v: (player.batting.power_L + player.batting.power_R) / 2 },
        { label: 'SPD', v: player.batting.speed },
      ];

  return (
    <div
      onClick={onClick}
      className={cn(
        'grid items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
        'grid-cols-[28px_1fr_36px_36px_auto_auto]',
        isSelected
          ? 'border-gold/60 bg-gold/10'
          : 'border-navy-lighter/40 bg-navy-lighter/10 hover:border-navy-lighter/70 hover:bg-navy-lighter/20',
      )}
    >
      {/* Rank */}
      <span className="font-mono text-xs text-cream-dim/40 text-right">{rank}</span>

      {/* Name + meta */}
      <div className="min-w-0">
        <p className="font-body text-sm text-cream truncate">{getPlayerName(player)}</p>
        <p className="font-mono text-[10px] text-cream-dim/50">
          {role} · {player.age}y
          {player.state.isInjured && <span className="ml-1 text-red-400">INJ</span>}
        </p>
      </div>

      {/* OVR */}
      <div className="text-center">
        <span className={cn('font-mono text-sm font-bold', gradeColor(ovr))}>{ovr}</span>
      </div>

      {/* Ceiling */}
      <div className="text-center">
        <span className={cn('font-mono text-xs', gradeColor(pot))}>{pot}</span>
      </div>

      {/* Key grades */}
      <div className="flex gap-1.5">
        {keyAttrs.map(a => (
          <div key={a.label} className="text-center hidden sm:block">
            <p className="font-mono text-[9px] text-cream-dim/40">{a.label}</p>
            <p className={cn('font-mono text-[10px] font-bold', gradeColor(grade20to80(a.v)))}>
              {grade20to80(a.v)}
            </p>
          </div>
        ))}
      </div>

      {/* ETA + recent dev badge */}
      <div className="flex items-center gap-1 hidden sm:flex">
        <span className={cn('font-mono text-[10px] whitespace-nowrap', eta.color)}>
          {eta.label}
        </span>
        {recentDev && <DevEventBadge delta={recentDev.ovrDelta} type={recentDev.type} />}
      </div>
    </div>
  );
}

function MLBPlayerRow({
  player,
  onSendDown,
}: {
  player: Player;
  onSendDown: (id: string) => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const role = posLabel(player);

  return (
    <div className={cn(
      'flex items-center justify-between gap-2 px-3 py-2 rounded-md border transition-colors',
      player.state.isInjured
        ? 'border-red-900/40 bg-red-900/10'
        : 'border-navy-lighter/40 bg-navy-lighter/10 hover:border-navy-lighter/70',
    )}>
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm text-cream truncate">{getPlayerName(player)}</p>
        <p className="font-mono text-[10px] text-cream-dim/50">
          {role} · Age {player.age}
          {player.state.isInjured && <span className="ml-1 text-red-400">INJ</span>}
        </p>
      </div>
      <span className={cn('font-mono text-sm font-bold shrink-0', gradeColor(ovr))}>{ovr}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onSendDown(player.id)}
        className="shrink-0 text-xs"
      >
        ↓ AAA
      </Button>
    </div>
  );
}

// ─── Development Tab ──────────────────────────────────────────────────────────

function DevEventRow({ event, isUser }: { event: ProspectDevelopmentEvent; isUser: boolean }) {
  const isBreakout = event.type === 'breakout';
  const isBust = event.type === 'bust';
  const isRegression = event.type === 'regression';
  const isPositive = event.type === 'breakout' || event.type === 'improvement';

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors',
      isBreakout ? 'border-gold/40 bg-gold/8' :
      isBust ? 'border-red-500/30 bg-red-900/10' :
      isRegression ? 'border-red-900/30 bg-red-900/8' :
      isUser ? 'border-green-light/20 bg-green-900/8' :
      'border-navy-lighter/30 bg-navy-lighter/8',
    )}>
      {/* Event icon */}
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-mono text-base',
        isBreakout ? 'bg-gold/20 text-gold' :
        isBust ? 'bg-red-900/40 text-red-400' :
        isRegression ? 'bg-red-900/30 text-red-400' :
        'bg-green-900/30 text-green-light',
      )}>
        {isBreakout ? '⚡' : isBust ? '💀' : isPositive ? '▲' : '▼'}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('font-body text-sm font-semibold', isUser ? 'text-gold' : 'text-cream')}>
            {event.playerName}
          </span>
          <span className="font-mono text-[10px] text-cream-dim/50">
            {event.position} · Age {event.age}
          </span>
          {isUser && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/20">
              YOUR TEAM
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-cream-dim/60 mt-0.5">
          {event.keyAttribute} {event.keyDelta > 0 ? `+${event.keyDelta}` : event.keyDelta}
          {' · '}Day {event.day}
        </p>
      </div>

      {/* OVR change */}
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1.5 justify-end">
          <span className={cn('font-mono text-xs text-cream-dim/50')}>{event.ovrBefore}</span>
          <span className="font-mono text-[10px] text-cream-dim/30">→</span>
          <span className={cn(
            'font-mono text-sm font-bold',
            isPositive ? 'text-green-light' : 'text-red-400',
          )}>
            {event.ovrAfter}
          </span>
        </div>
        <span className={cn(
          'font-mono text-[10px] font-bold',
          isPositive ? 'text-green-light' : 'text-red-400',
        )}>
          {isPositive ? '+' : ''}{event.ovrDelta} OVR
        </span>
      </div>
    </div>
  );
}

function DevelopmentTab({
  prospectDevelopmentLog,
  userTeamId,
  currentDay,
  allTeams,
}: {
  prospectDevelopmentLog: ProspectDevelopmentEvent[];
  userTeamId: string;
  currentDay: number;
  allTeams: Team[];
}) {
  const [devScope, setDevScope] = useState<'mine' | 'league'>('mine');
  const [devTypeFilter, setDevTypeFilter] = useState<'all' | 'breakout' | 'regression'>('all');

  const teamMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of allTeams) m.set(t.id, `${t.city} ${t.name}`);
    return m;
  }, [allTeams]);

  const cutoff = currentDay - 28;

  const filtered = useMemo(() => {
    return prospectDevelopmentLog
      .filter(e => {
        if (e.day < cutoff) return false;
        if (devScope === 'mine' && e.teamId !== userTeamId) return false;
        if (devTypeFilter === 'breakout' && e.type !== 'breakout') return false;
        if (devTypeFilter === 'regression' && e.type !== 'regression' && e.type !== 'bust') return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.day - a.day);
  }, [prospectDevelopmentLog, devScope, devTypeFilter, cutoff, userTeamId]);

  const breakoutCount = prospectDevelopmentLog.filter(e => e.day >= cutoff && e.type === 'breakout' && (devScope === 'league' || e.teamId === userTeamId)).length;
  const improvCount = prospectDevelopmentLog.filter(e => e.day >= cutoff && e.type === 'improvement' && (devScope === 'league' || e.teamId === userTeamId)).length;
  const regCount = prospectDevelopmentLog.filter(e => e.day >= cutoff && (e.type === 'regression' || e.type === 'bust') && (devScope === 'league' || e.teamId === userTeamId)).length;

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gold/8 border border-gold/20 rounded-lg px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">Breakouts</p>
          <p className="font-mono text-2xl font-bold text-gold">{breakoutCount}</p>
          <p className="font-mono text-[10px] text-cream-dim/40">last 28 days</p>
        </div>
        <div className="bg-green-900/10 border border-green-light/15 rounded-lg px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">Improvements</p>
          <p className="font-mono text-2xl font-bold text-green-light">{improvCount}</p>
          <p className="font-mono text-[10px] text-cream-dim/40">last 28 days</p>
        </div>
        <div className="bg-red-900/10 border border-red-900/20 rounded-lg px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">Regressions</p>
          <p className="font-mono text-2xl font-bold text-red-400">{regCount}</p>
          <p className="font-mono text-[10px] text-cream-dim/40">last 28 days</p>
        </div>
      </div>

      {/* Scope + type filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-navy-lighter/20 rounded-lg p-0.5">
          {(['mine', 'league'] as const).map(s => (
            <button
              key={s}
              onClick={() => setDevScope(s)}
              className={cn(
                'font-mono text-xs px-3 py-1.5 rounded-md transition-colors',
                devScope === s ? 'bg-gold/15 text-gold' : 'text-cream-dim/60 hover:text-cream-dim',
              )}
            >
              {s === 'mine' ? 'My Team' : 'League-Wide'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'breakout', 'regression'] as const).map(f => (
            <button
              key={f}
              onClick={() => setDevTypeFilter(f)}
              className={cn(
                'font-mono text-[10px] px-2.5 py-1 rounded-full border transition-colors',
                devTypeFilter === f
                  ? 'border-gold/40 text-gold bg-gold/10'
                  : 'border-navy-lighter/50 text-cream-dim/50 hover:text-cream-dim',
              )}
            >
              {f === 'all' ? 'All Events' : f === 'breakout' ? '⚡ Breakouts' : '▼ Regressions'}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-cream-dim/30 ml-auto">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''} · last 28 days
        </span>
      </div>

      {/* Event feed */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-4xl mb-3">📊</p>
          <p className="font-mono text-cream-dim/50 text-sm">
            {currentDay === 0
              ? 'Season hasn\'t started yet — advance the season to see prospect development.'
              : devScope === 'mine'
                ? 'No development events for your prospects in the last 28 days.'
                : 'No league-wide development events in the last 28 days.'}
          </p>
          <p className="font-mono text-cream-dim/30 text-xs mt-2">
            Development fires every 7 simulated days.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
          {filtered.map((e, i) => (
            <div key={i}>
              {/* Team header when viewing league-wide */}
              {devScope === 'league' && (i === 0 || filtered[i - 1].teamId !== e.teamId) && (
                <p className="font-mono text-[9px] text-cream-dim/30 uppercase px-1 mt-3 mb-1 first:mt-0">
                  {teamMap.get(e.teamId) ?? e.teamId}
                </p>
              )}
              <DevEventRow event={e} isUser={e.teamId === userTeamId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MinorLeaguePage() {
  const navigate = useNavigate();
  const {
    engine, season, userTeamId,
    getAAATeam, callUpSpecificPlayer, sendDownPlayer, callupLog,
    prospectDevelopmentLog, lastProspectDevelopment,
  } = useFranchiseStore();

  const [tab, setTab] = useState<'prospects' | 'mlb' | 'log' | 'dev'>('prospects');
  const [posFilter, setPosFilter] = useState<PosFilter>('All');
  const [sortKey, setSortKey] = useState<SortKey>('ovr');
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [version, setVersion] = useState(0); // force re-render after callup/senddown

  const showFeedback = useCallback((msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  // All hooks before early return
  const userTeam = useMemo(() => engine?.getTeam(userTeamId ?? '') ?? null, [engine, userTeamId, version]);
  const aaaRoster = useMemo(() => getAAATeam(userTeamId ?? ''), [engine, userTeamId, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allTeams = useMemo(() => engine?.getAllTeams() ?? [], [engine, version]);

  const mlbRoster = useMemo(() => [...(userTeam?.roster.players ?? [])]
    .map(p => ({ p, ovr: evaluatePlayer(p) }))
    .sort((a, b) => a.ovr - b.ovr), // lowest OVR first = best send-down candidates
    [userTeam, version]);

  const prospects = useMemo(() => {
    const raw = aaaRoster?.players ?? [];
    return raw
      .filter(p => matchesFilter(p, posFilter))
      .map(p => ({ p, ovr: Math.round(evaluatePlayer(p)), pot: prospectPotential(Math.round(evaluatePlayer(p)), p.age) }))
      .sort((a, b) => {
        if (sortKey === 'ovr') return b.ovr - a.ovr;
        if (sortKey === 'potential') return b.pot - a.pot;
        if (sortKey === 'age') return a.p.age - b.p.age;
        // pos: group pitchers then by position
        const ap = posLabel(a.p);
        const bp = posLabel(b.p);
        return ap.localeCompare(bp);
      });
  }, [aaaRoster, posFilter, sortKey, version]);

  const selectedProspect = useMemo(
    () => prospects.find(x => x.p.id === selectedProspectId)?.p ?? null,
    [prospects, selectedProspectId],
  );

  // Recent dev events (last 14 days) for the user's team, keyed by playerId
  const recentDevByPlayer = useMemo(() => {
    const cutoff = (season?.currentDay ?? 0) - 14;
    const map = new Map<string, ProspectDevelopmentEvent>();
    for (const e of prospectDevelopmentLog) {
      if (e.teamId === userTeamId && e.day >= cutoff) {
        // Keep the most recent event per player
        const existing = map.get(e.playerId);
        if (!existing || e.day > existing.day) map.set(e.playerId, e);
      }
    }
    return map;
  }, [prospectDevelopmentLog, userTeamId, season?.currentDay]);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-cream-dim">No franchise loaded.</p>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const isSeptemberCallups = currentDay >= 150;
  const maxRoster = isSeptemberCallups ? 40 : 26;
  const mlbCount = userTeam?.roster.players.length ?? 0;
  const aaaCount = aaaRoster?.players.length ?? 0;
  const canCallUp = mlbCount < maxRoster;

  const handleCallUp = (playerId: string) => {
    const event = callUpSpecificPlayer(userTeamId, playerId);
    if (event) {
      showFeedback(event.message);
      setSelectedProspectId(null);
      setVersion(v => v + 1);
    } else {
      showFeedback('Could not call up — roster may be full.', false);
    }
  };

  const handleSendDown = (playerId: string) => {
    const event = sendDownPlayer(userTeamId, playerId);
    if (event) {
      showFeedback(event.message);
      setVersion(v => v + 1);
    }
  };

  // Prospect grade summary for the farm header
  const farmGrade = useMemo(() => {
    if (!aaaRoster?.players.length) return null;
    const avg = aaaRoster.players.reduce((s, p) => s + evaluatePlayer(p), 0) / aaaRoster.players.length;
    return Math.round(avg);
  }, [aaaRoster, version]);

  // League-wide farm ranking
  const leagueRankings = useMemo(() => {
    return allTeams
      .map(t => {
        const aff = engine.minorLeagues.getAffiliate(t.id);
        if (!aff || !aff.players.length) return { teamId: t.id, name: `${t.city} ${t.name}`, avg: 0, count: 0 };
        const avg = aff.players.reduce((s, p) => s + evaluatePlayer(p), 0) / aff.players.length;
        return { teamId: t.id, name: `${t.city} ${t.name}`, avg: Math.round(avg), count: aff.players.length };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [allTeams, version]);

  const userFarmRank = leagueRankings.findIndex(r => r.teamId === userTeamId) + 1;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Minor Leagues</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam?.city} {userTeam?.name} — {season.year} AAA Affiliate
          </p>
          {isSeptemberCallups && (
            <span className="inline-block mt-1 font-mono text-xs font-bold text-green-light bg-green-900/20 px-2 py-0.5 rounded">
              SEPTEMBER CALLUPS OPEN
            </span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/roster')}>MLB Roster</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* ── Farm Status Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">MLB Roster</p>
          <p className={cn('font-mono text-xl font-bold', mlbCount >= maxRoster ? 'text-red-400' : 'text-cream')}>
            {mlbCount}<span className="text-cream-dim/40 text-sm">/{maxRoster}</span>
          </p>
          <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">
            {maxRoster - mlbCount} open slot{maxRoster - mlbCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">AAA Roster</p>
          <p className="font-mono text-xl font-bold text-cream">
            {aaaCount}
          </p>
          <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">prospects</p>
        </div>
        <div className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">Farm Grade</p>
          <p className={cn('font-mono text-xl font-bold', gradeColor(farmGrade ?? 0))}>
            {farmGrade ?? '—'}
          </p>
          <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">avg prospect OVR</p>
        </div>
        <div className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">Farm Rank</p>
          <p className="font-mono text-xl font-bold text-cream">
            {userFarmRank > 0 ? `#${userFarmRank}` : '—'}<span className="text-cream-dim/40 text-sm">/{leagueRankings.length}</span>
          </p>
          <p className="font-mono text-[10px] text-cream-dim/50 mt-0.5">in the league</p>
        </div>
      </div>

      {/* ── Feedback Banner ── */}
      {feedback && (
        <div className={cn(
          'mb-4 px-4 py-2.5 rounded-md border font-mono text-sm transition-all',
          feedback.ok
            ? 'bg-green-900/20 border-green-light/30 text-green-light'
            : 'bg-red-900/20 border-red-400/30 text-red-400',
        )}>
          {feedback.msg}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4 border-b border-navy-lighter/40 pb-0 flex-wrap">
        {(['prospects', 'dev', 'mlb', 'log'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'font-mono text-sm px-4 py-2 rounded-t-md transition-colors -mb-px border-b-2',
              tab === t
                ? 'text-gold border-gold bg-gold/5'
                : 'text-cream-dim/60 border-transparent hover:text-cream-dim',
            )}
          >
            {t === 'prospects' && `Prospects (${aaaCount})`}
            {t === 'dev' && (
              <span className="flex items-center gap-1">
                Development
                {lastProspectDevelopment.filter(e => e.teamId === userTeamId).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-green-light animate-pulse" />
                )}
              </span>
            )}
            {t === 'mlb' && `MLB Roster (${mlbCount})`}
            {t === 'log' && `Log (${callupLog.length})`}
          </button>
        ))}
      </div>

      {/* ══ TAB: PROSPECTS ══ */}
      {tab === 'prospects' && (
        <div className="flex gap-4">
          {/* Left: list */}
          <div className="flex-1 min-w-0">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex gap-1 flex-wrap">
                {POS_FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setPosFilter(f)}
                    className={cn(
                      'font-mono text-xs px-2.5 py-1 rounded-full border transition-colors',
                      posFilter === f
                        ? 'border-gold text-gold bg-gold/10'
                        : 'border-navy-lighter/50 text-cream-dim/60 hover:border-navy-lighter hover:text-cream-dim',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-1">
                {(['ovr', 'potential', 'age', 'pos'] as SortKey[]).map(k => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={cn(
                      'font-mono text-[10px] px-2 py-0.5 rounded border transition-colors',
                      sortKey === k
                        ? 'border-cream-dim/40 text-cream bg-navy-lighter/30'
                        : 'border-transparent text-cream-dim/40 hover:text-cream-dim',
                    )}
                  >
                    {k === 'ovr' ? 'OVR' : k === 'potential' ? 'POT' : k.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[28px_1fr_36px_36px_auto_auto] gap-2 px-3 mb-1.5">
              <span className="font-mono text-[9px] text-cream-dim/30">#</span>
              <span className="font-mono text-[9px] text-cream-dim/30">NAME</span>
              <span className="font-mono text-[9px] text-cream-dim/30 text-center">OVR</span>
              <span className="font-mono text-[9px] text-cream-dim/30 text-center">POT</span>
              <span className="font-mono text-[9px] text-cream-dim/30 hidden sm:block">GRADES</span>
              <span className="font-mono text-[9px] text-cream-dim/30 hidden sm:block">ETA</span>
            </div>

            {prospects.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-mono text-3xl mb-3">⚾</p>
                <p className="font-mono text-cream-dim/50 text-sm">
                  {posFilter === 'All' ? 'AAA affiliate is empty.' : `No ${posFilter} prospects on the farm.`}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                {prospects.map(({ p }, i) => (
                  <ProspectRow
                    key={p.id}
                    player={p}
                    rank={i + 1}
                    isSelected={selectedProspectId === p.id}
                    onClick={() => setSelectedProspectId(prev => prev === p.id ? null : p.id)}
                    recentDev={recentDevByPlayer.get(p.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: detail panel */}
          {selectedProspect && (
            <div className="w-72 shrink-0">
              <Panel title="Prospect Report" className="sticky top-4">
                <ProspectDetailPanel
                  player={selectedProspect}
                  canCallUp={canCallUp}
                  onCallUp={handleCallUp}
                  onClose={() => setSelectedProspectId(null)}
                />
              </Panel>
            </div>
          )}

          {/* Right: league farm rankings when no prospect selected */}
          {!selectedProspect && (
            <div className="w-64 shrink-0 hidden lg:block">
              <Panel title="League Farm Rankings">
                <div className="space-y-1.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                  {leagueRankings.map((r, i) => (
                    <div
                      key={r.teamId}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs',
                        r.teamId === userTeamId
                          ? 'bg-gold/10 border border-gold/20'
                          : 'border border-transparent',
                      )}
                    >
                      <span className="font-mono text-cream-dim/40 w-5 shrink-0">#{i + 1}</span>
                      <span className={cn('font-body flex-1 truncate', r.teamId === userTeamId ? 'text-gold' : 'text-cream-dim')}>
                        {r.name}
                      </span>
                      <span className={cn('font-mono font-bold shrink-0', gradeColor(r.avg))}>{r.avg}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: MLB ROSTER ══ */}
      {tab === 'mlb' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title={`Send Down Candidates — ${mlbCount}/${maxRoster} roster slots`}>
            <p className="font-mono text-xs text-cream-dim/50 mb-3">
              Sorted by OVR ascending. Click ↓ AAA to option a player to the affiliate.
              {isSeptemberCallups && ' September rules: 40-man roster active.'}
            </p>
            {mlbRoster.length === 0 ? (
              <p className="font-mono text-cream-dim text-sm py-4 text-center">No MLB players.</p>
            ) : (
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {mlbRoster.map(({ p }) => (
                  <MLBPlayerRow key={p.id} player={p} onSendDown={handleSendDown} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="AAA Top Callup Candidates">
            <p className="font-mono text-xs text-cream-dim/50 mb-3">
              Sorted by OVR descending. {canCallUp ? `${maxRoster - mlbCount} open roster slot(s).` : 'Roster is full — send down first.'}
            </p>
            {prospects.length === 0 ? (
              <p className="font-mono text-cream-dim text-sm py-4 text-center">AAA affiliate is empty.</p>
            ) : (
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {[...prospects]
                  .sort((a, b) => b.ovr - a.ovr)
                  .slice(0, 15)
                  .map(({ p, ovr }) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-navy-lighter/40 bg-navy-lighter/10 hover:border-navy-lighter/70 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm text-cream truncate">{getPlayerName(p)}</p>
                        <p className="font-mono text-[10px] text-cream-dim/50">{posLabel(p)} · {p.age}y</p>
                      </div>
                      <span className={cn('font-mono text-sm font-bold shrink-0', gradeColor(ovr))}>{ovr}</span>
                      {canCallUp ? (
                        <Button size="sm" variant="secondary" onClick={() => handleCallUp(p.id)} className="shrink-0 text-xs">
                          ↑ MLB
                        </Button>
                      ) : (
                        <span className="font-mono text-[10px] text-red-400/60 bg-red-900/10 px-2 py-0.5 rounded">Full</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ══ TAB: DEVELOPMENT ══ */}
      {tab === 'dev' && <DevelopmentTab
        prospectDevelopmentLog={prospectDevelopmentLog}
        userTeamId={userTeamId}
        currentDay={currentDay}
        allTeams={allTeams}
      />}

      {/* ══ TAB: LOG ══ */}
      {tab === 'log' && (
        <Panel title={`Transaction Log (${callupLog.length} moves)`}>
          {callupLog.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-mono text-3xl mb-3">📋</p>
              <p className="font-mono text-cream-dim/50 text-sm">No transactions yet this season.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {[...callupLog].reverse().map((e, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border',
                    e.type === 'callup'
                      ? 'bg-green-900/10 border-green-light/20'
                      : 'bg-navy-lighter/20 border-navy-lighter/40',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-mono text-xs font-bold',
                    e.type === 'callup'
                      ? 'bg-green-900/40 text-green-light'
                      : 'bg-navy-lighter/40 text-cream-dim',
                  )}>
                    {e.type === 'callup' ? '↑' : '↓'}
                  </div>
                  <div className="flex-1">
                    <p className="font-body text-sm text-cream">{e.message}</p>
                    <p className="font-mono text-[10px] text-cream-dim/40">
                      {e.type === 'callup' ? 'Called up to MLB' : 'Optioned to AAA'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
