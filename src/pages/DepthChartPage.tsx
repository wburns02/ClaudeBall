import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Position } from '@/engine/types/enums.ts';

// ── Grade helpers (20-80 scout scale) ─────────────────────────────────────────

function ovrTo80(ovr: number): number {
  // OVR 0-100 → 20-80 scout grade
  return Math.max(20, Math.min(80, Math.round(20 + (ovr / 100) * 60)));
}

function scoutBucket(ovr: number): 80 | 70 | 60 | 50 | 40 | 30 {
  const g = ovrTo80(ovr);
  if (g >= 75) return 80;
  if (g >= 65) return 70;
  if (g >= 55) return 60;
  if (g >= 45) return 50;
  if (g >= 35) return 40;
  return 30;
}

function letterGrade(ovr: number): string {
  if (ovr >= 78) return 'A+';
  if (ovr >= 72) return 'A';
  if (ovr >= 66) return 'B+';
  if (ovr >= 60) return 'B';
  if (ovr >= 54) return 'C+';
  if (ovr >= 48) return 'C';
  if (ovr >= 42) return 'D';
  return 'F';
}

function gradeTextColor(ovr: number): string {
  if (ovr >= 78) return 'text-gold';
  if (ovr >= 70) return 'text-green-400';
  if (ovr >= 60) return 'text-green-300';
  if (ovr >= 48) return 'text-cream';
  if (ovr >= 42) return 'text-yellow-500';
  return 'text-red-400';
}

function gradeBadge(ovr: number): string {
  if (ovr >= 78) return 'bg-gold/20 border-gold/50 text-gold';
  if (ovr >= 70) return 'bg-green-400/15 border-green-400/40 text-green-400';
  if (ovr >= 60) return 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400';
  if (ovr >= 48) return 'bg-navy-lighter/40 border-navy-lighter/60 text-cream-dim';
  if (ovr >= 42) return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
  return 'bg-red-400/10 border-red-400/30 text-red-400';
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FIELD_POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

const POS_FULL: Record<string, string> = {
  C: 'Catcher', '1B': '1st Base', '2B': '2nd Base', '3B': '3rd Base',
  SS: 'Shortstop', LF: 'Left Field', CF: 'Center Field', RF: 'Right Field', DH: 'DH',
};

// ── Player Card (field position) ───────────────────────────────────────────────

function PlayerCard({
  player,
  isStarter,
  injured,
  onClick,
}: {
  player: Player;
  isStarter: boolean;
  injured: boolean;
  onClick: () => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const bucket = scoutBucket(ovr);
  const letter = letterGrade(ovr);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left',
        'cursor-pointer transition-all group',
        isStarter
          ? 'border-navy-lighter/50 bg-navy-light/40 hover:border-gold/30 hover:bg-navy-lighter/20'
          : 'border-navy-lighter/20 bg-navy-light/10 hover:border-navy-lighter/40 hover:bg-navy-light/30',
      )}
    >
      {/* Scout grade bubble — always full opacity */}
      <div className={cn(
        'w-9 h-9 rounded-lg border flex items-center justify-center font-mono text-sm font-bold shrink-0',
        gradeBadge(ovr),
      )}>
        {bucket}
      </div>

      {/* Name & info — dimmed for backups */}
      <div className={cn('flex-1 min-w-0', !isStarter && 'opacity-60 group-hover:opacity-90 transition-opacity')}>
        <div className="flex items-center gap-1">
          <span className={cn(
            'font-body text-sm truncate leading-tight',
            isStarter ? 'text-cream font-semibold' : 'text-cream-dim',
          )}>
            {getPlayerName(player)}
          </span>
          {injured && <span className="text-red-400 text-xs shrink-0" title="Injured">🏥</span>}
        </div>
        <div className="font-mono text-[10px] text-cream-dim/40 mt-0.5">
          {player.position} · {player.bats}/{player.throws} · {player.age}y
        </div>
      </div>

      {/* Letter grade — full opacity always */}
      <div className={cn('font-display text-lg font-bold shrink-0', gradeTextColor(ovr))}>
        {letter}
      </div>
    </button>
  );
}

// ── Position Column ────────────────────────────────────────────────────────────

function PositionColumn({
  pos,
  players,
  injuredIds,
  onPlayerClick,
}: {
  pos: Position;
  players: Player[];
  injuredIds: Set<string>;
  onPlayerClick: (id: string) => void;
}) {
  const starter = players[0];
  const backups = players.slice(1, 3);
  const starterOvr = starter ? Math.round(evaluatePlayer(starter)) : 0;

  return (
    <div>
      {/* Position header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-display text-xs text-gold tracking-wider uppercase">{pos}</span>
          <span className="font-mono text-[10px] text-cream-dim/40 ml-2">{POS_FULL[pos]}</span>
        </div>
        {starter && (
          <span className={cn('font-mono text-xs font-bold', gradeTextColor(starterOvr))}>
            {letterGrade(starterOvr)}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {/* Starter */}
        {starter ? (
          <PlayerCard
            player={starter}
            isStarter={true}
            injured={injuredIds.has(starter.id)}
            onClick={() => onPlayerClick(starter.id)}
          />
        ) : (
          <div className="px-3 py-2 rounded-lg border border-dashed border-red-400/30 bg-red-950/10 text-center">
            <span className="font-mono text-xs text-red-400/50">ROSTER HOLE</span>
          </div>
        )}

        {/* Backups */}
        {backups.map(p => (
          <PlayerCard
            key={p.id}
            player={p}
            isStarter={false}
            injured={injuredIds.has(p.id)}
            onClick={() => onPlayerClick(p.id)}
          />
        ))}

        {backups.length === 0 && (
          <div className="px-3 py-1.5 rounded border border-dashed border-navy-lighter/15 text-center">
            <span className="font-mono text-[10px] text-cream-dim/20">no backup</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pitcher Row ────────────────────────────────────────────────────────────────

function PitcherRow({
  player,
  slotLabel,
  injured,
  isCloser,
  onClick,
}: {
  player: Player;
  slotLabel: string;
  injured: boolean;
  isCloser?: boolean;
  onClick: () => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const bucket = scoutBucket(ovr);
  const letter = letterGrade(ovr);
  const { stuff, movement, control, velocity } = player.pitching;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-navy-lighter/30 bg-navy-light/20 hover:border-gold/30 hover:bg-navy-lighter/20 cursor-pointer transition-all text-left group"
    >
      {/* Slot */}
      <div className={cn(
        'font-mono text-[10px] w-8 shrink-0 font-bold uppercase',
        isCloser ? 'text-gold' : 'text-cream-dim/40',
      )}>
        {slotLabel}
      </div>

      {/* Grade */}
      <div className={cn(
        'w-8 h-8 rounded border flex items-center justify-center font-mono text-xs font-bold shrink-0',
        gradeBadge(ovr),
      )}>
        {bucket}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-body text-sm text-cream truncate">{getPlayerName(player)}</span>
          {injured && <span className="text-red-400 text-xs" title="Injured">🏥</span>}
          {isCloser && (
            <span className="font-mono text-[9px] text-gold/60 border border-gold/30 px-1 rounded uppercase tracking-wider">CL</span>
          )}
        </div>
        <div className="font-mono text-[10px] text-cream-dim/40 mt-0.5">
          {player.age}y · {player.throws}HP · {velocity}mph
        </div>
      </div>

      {/* Pitch ratings */}
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        {[
          { label: 'STF', val: stuff },
          { label: 'MOV', val: movement },
          { label: 'CTL', val: control },
        ].map(({ label, val }) => (
          <div key={label} className="text-center min-w-[28px]">
            <div className="font-mono text-[9px] text-cream-dim/30 uppercase">{label}</div>
            <div className={cn('font-mono text-xs font-bold', gradeTextColor(val))}>{val}</div>
          </div>
        ))}
      </div>

      {/* Letter */}
      <div className={cn('font-display text-base font-bold shrink-0 ml-1', gradeTextColor(ovr))}>
        {letter}
      </div>
    </button>
  );
}

// ── Roster Needs analysis ──────────────────────────────────────────────────────

function RosterNeedsCard({
  fieldPositions,
}: {
  fieldPositions: Map<Position, Player[]>;
}) {
  const needs = useMemo(() => {
    const items: { pos: string; grade: string; color: string; note: string }[] = [];
    for (const [pos, players] of fieldPositions) {
      const starter = players[0];
      if (!starter) {
        items.push({ pos, grade: 'F', color: 'text-red-400', note: 'No player at position' });
        continue;
      }
      const ovr = Math.round(evaluatePlayer(starter));
      if (ovr < 48) {
        items.push({ pos, grade: letterGrade(ovr), color: gradeTextColor(ovr), note: players.length < 2 ? 'No backup either' : 'Starter below average' });
      } else if (players.length < 2) {
        items.push({ pos, grade: letterGrade(ovr), color: gradeTextColor(ovr), note: 'No backup' });
      }
    }
    return items.sort((a, b) => a.grade.localeCompare(b.grade));
  }, [fieldPositions]);

  if (needs.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="text-2xl mb-2">✅</div>
        <p className="font-mono text-sm text-green-400">No major roster holes detected</p>
        <p className="font-mono text-xs text-cream-dim/40 mt-1">All positions have average or better starters</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {needs.map(({ pos, grade, color, note }) => (
        <div key={pos} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-950/10 border border-red-400/20">
          <div className="font-display text-sm text-gold w-8 shrink-0">{pos}</div>
          <div className={cn('font-mono text-sm font-bold w-6 shrink-0', color)}>{grade}</div>
          <div className="font-mono text-xs text-cream-dim/60">{note}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function DepthChartPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, getTeamInjuries } = useFranchiseStore();
  const team = engine && userTeamId ? engine.getTeam(userTeamId) : null;

  const injuredIds = useMemo(() => {
    if (!userTeamId) return new Set<string>();
    return new Set(getTeamInjuries(userTeamId).map(r => r.playerId));
  }, [userTeamId, getTeamInjuries]);

  const { fieldPositions, startingRotation, bullpen, teamOvr, offOvr, pitOvr } = useMemo(() => {
    if (!team) return {
      fieldPositions: new Map<Position, Player[]>(),
      startingRotation: [] as Player[],
      bullpen: [] as Player[],
      teamOvr: 0, offOvr: 0, pitOvr: 0,
    };

    const players = team.roster.players;
    const pitchers = players.filter(p => p.position === 'P');
    const posPlayers = players.filter(p => p.position !== 'P');

    // Starting rotation: top 5 by (stamina * 0.6 + ovr * 0.4)
    const spSorted = [...pitchers].sort((a, b) =>
      (b.pitching.stamina * 0.6 + evaluatePlayer(b) * 0.4) -
      (a.pitching.stamina * 0.6 + evaluatePlayer(a) * 0.4)
    );
    const startingRotation = spSorted.slice(0, 5);
    const bullpenRaw = pitchers.filter(p => !startingRotation.includes(p))
      .sort((a, b) => evaluatePlayer(b) - evaluatePlayer(a));

    // Field positions: collect all eligible players per position
    const fieldPositions = new Map<Position, Player[]>();
    for (const pos of FIELD_POSITIONS) {
      const eligible = posPlayers.filter(p =>
        p.position === pos || p.fielding.some(f => f.position === pos)
      ).sort((a, b) => evaluatePlayer(b) - evaluatePlayer(a));
      fieldPositions.set(pos, eligible);
    }

    // Grade calculations
    const top9pos = [...posPlayers].sort((a, b) => evaluatePlayer(b) - evaluatePlayer(a)).slice(0, 9);
    const offOvr = top9pos.length > 0
      ? Math.round(top9pos.reduce((s, p) => s + evaluatePlayer(p), 0) / top9pos.length)
      : 0;

    const pitOvr = startingRotation.length > 0
      ? Math.round(startingRotation.reduce((s, p) => s + evaluatePlayer(p), 0) / startingRotation.length)
      : 0;

    const allKey = [...top9pos, ...startingRotation];
    const teamOvr = allKey.length > 0
      ? Math.round(allKey.reduce((s, p) => s + evaluatePlayer(p), 0) / allKey.length)
      : 0;

    return { fieldPositions, startingRotation, bullpen: bullpenRaw, teamOvr, offOvr, pitOvr };
  }, [team]);

  if (!engine || !team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Depth Chart</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">View your team's positional depth at every spot on the diamond.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const teamDisplayName = `${team.city} ${team.name}`;
  const closer = bullpen[0];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Depth Chart</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">{teamDisplayName} · 25-Man Roster</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Team grade cards */}
          <div className="flex gap-2">
            {[
              { label: 'OFF', ovr: offOvr },
              { label: 'PIT', ovr: pitOvr },
              { label: 'OVR', ovr: teamOvr },
            ].map(({ label, ovr }) => (
              <div key={label} className={cn('px-2.5 py-2 rounded-xl border text-center min-w-[56px]', gradeBadge(ovr))}>
                <div className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider">{label}</div>
                <div className={cn('font-display text-xl font-bold', gradeTextColor(ovr))}>{letterGrade(ovr)}</div>
                <div className="font-mono text-[10px] text-cream-dim/50">{ovr}</div>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      {/* Scout grade legend */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="font-mono text-[10px] text-cream-dim/30 uppercase tracking-wider mr-1">20-80 Scale:</span>
        {(
          [
            { bucket: 80, label: 'Elite', cls: 'bg-gold/20 border-gold/50 text-gold' },
            { bucket: 70, label: 'Plus+', cls: 'bg-green-400/15 border-green-400/40 text-green-400' },
            { bucket: 60, label: 'Plus', cls: 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' },
            { bucket: 50, label: 'Avg', cls: 'bg-sky-400/10 border-sky-400/30 text-sky-300' },
            { bucket: 40, label: 'Below', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' },
            { bucket: 30, label: 'Poor', cls: 'bg-red-400/10 border-red-400/30 text-red-400' },
          ] as const
        ).map(({ bucket, label, cls }) => (
          <span key={bucket} className={cn('px-2 py-0.5 rounded border font-mono text-[10px]', cls)}>
            {bucket} · {label}
          </span>
        ))}
      </div>

      {/* Field positions grid */}
      <Panel title="Position Players" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FIELD_POSITIONS.map(pos => (
            <PositionColumn
              key={pos}
              pos={pos}
              players={fieldPositions.get(pos) ?? []}
              injuredIds={injuredIds}
              onPlayerClick={(id) => navigate(`/franchise/player-stats/${id}`)}
            />
          ))}
        </div>
      </Panel>

      {/* Pitching staff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Starting rotation */}
        <Panel title="Starting Rotation">
          <div className="space-y-2">
            {startingRotation.map((p, i) => (
              <PitcherRow
                key={p.id}
                player={p}
                slotLabel={`SP${i + 1}`}
                injured={injuredIds.has(p.id)}
                onClick={() => navigate(`/franchise/player-stats/${p.id}`)}
              />
            ))}
            {startingRotation.length === 0 && (
              <div className="py-8 text-center">
                <p className="font-mono text-cream-dim/40 text-sm">No pitchers on roster</p>
              </div>
            )}
          </div>
        </Panel>

        {/* Bullpen */}
        <Panel title="Bullpen">
          <div className="space-y-2">
            {bullpen.slice(0, 8).map((p, i) => (
              <PitcherRow
                key={p.id}
                player={p}
                slotLabel={i === 0 ? 'CL' : `RP${i}`}
                injured={injuredIds.has(p.id)}
                isCloser={i === 0}
                onClick={() => navigate(`/franchise/player-stats/${p.id}`)}
              />
            ))}
            {bullpen.length === 0 && (
              <div className="py-8 text-center">
                <p className="font-mono text-cream-dim/40 text-sm">No relievers on roster</p>
              </div>
            )}
          </div>
          {closer && (
            <div className="mt-4 pt-3 border-t border-navy-lighter/30">
              <p className="font-mono text-[10px] text-cream-dim/30 uppercase tracking-wider">
                Closer: <span className="text-gold">{getPlayerName(closer)}</span>
                <span className="ml-2 text-cream-dim/20">· {Math.round(evaluatePlayer(closer))} OVR</span>
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* Roster Needs */}
      <Panel title="Roster Needs & Holes">
        <RosterNeedsCard fieldPositions={fieldPositions} />
      </Panel>

    </div>
  );
}
