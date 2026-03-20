import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { DevelopmentChange, DevelopmentPhase } from '@/engine/season/OffseasonEngine.ts';
import type { TrainingAssignment } from '@/engine/player/DevelopmentEngine.ts';

const FOCUS_COLORS: Record<string, { color: string; bg: string }> = {
  contact:  { color: 'text-blue-400',   bg: 'bg-blue-900/20'   },
  power:    { color: 'text-orange-400', bg: 'bg-orange-900/20' },
  eye:      { color: 'text-green-light',bg: 'bg-green-900/20'  },
  speed:    { color: 'text-cyan-400',   bg: 'bg-cyan-900/20'   },
  stuff:    { color: 'text-red-400',    bg: 'bg-red-900/20'    },
  movement: { color: 'text-purple-400', bg: 'bg-purple-900/20' },
  control:  { color: 'text-gold',       bg: 'bg-gold/10'       },
  stamina:  { color: 'text-teal-400',   bg: 'bg-teal-900/20'   },
  mental:   { color: 'text-cream',      bg: 'bg-cream/5'       },
};

function trainingBonus(training: TrainingAssignment | undefined): number {
  if (!training || training.focus === 'none') return 0;
  if (training.intensity === 'rest') return -1;
  if (training.intensity === 'light') return 0;
  if (training.intensity === 'normal') return 1;
  return 2; // intense
}

// ── Phase metadata ──────────────────────────────────────────────────────────
const PHASE_META: Record<DevelopmentPhase, { label: string; color: string; bg: string; border: string; description: string }> = {
  growth:  { label: 'Growth',  color: 'text-green-light',  bg: 'bg-green-light/10',  border: 'border-green-light/30',  description: 'Young players typically improve 2-6 pts/year' },
  peak:    { label: 'Peak',    color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30',          description: 'Prime years — small fluctuations, few surprises' },
  decline: { label: 'Decline', color: 'text-orange-400',   bg: 'bg-orange-900/15',   border: 'border-orange-500/30',   description: 'Ratings typically dip 1-3 pts/year, mitigated by work ethic' },
  steep:   { label: 'Steep',   color: 'text-red-400',       bg: 'bg-red-900/15',       border: 'border-red-500/30',       description: 'Significant decline — 3-6 pts/year, retirement possible' },
};

function getPhase(age: number): DevelopmentPhase {
  if (age <= 26) return 'growth';
  if (age <= 31) return 'peak';
  if (age <= 36) return 'decline';
  return 'steep';
}

// Expected OVR change for age (deterministic preview)
function expectedOvrDelta(age: number, workEthic: number): { min: number; max: number; avg: number } {
  const ethics = workEthic / 100;
  if (age >= 20 && age <= 26) {
    const growthBase = 6 - (age - 20) * 0.5;
    const avg = Math.round(growthBase * 0.7 * ethics + 1);
    return { min: 1, max: Math.round(growthBase * ethics + 2), avg: Math.max(1, avg) };
  }
  if (age >= 27 && age <= 31) {
    return { min: -1, max: 1, avg: 0 };
  }
  if (age >= 32 && age <= 36) {
    const declineBase = 1 + (age - 31) * 0.3;
    const decay = Math.round(declineBase * (1 - ethics * 0.25));
    return { min: -(decay + 1), max: -1, avg: -decay };
  }
  const steep = 2 + (age - 36) * 0.5;
  return { min: -Math.round(steep + 3), max: -2, avg: -Math.round(steep + 1) };
}

// ── Player Projection Card ──────────────────────────────────────────────────
function ProjectionCard({
  player, userTeamId, teamId, training, onGoToTraining,
}: {
  player: Player;
  userTeamId: string;
  teamId: string;
  training?: TrainingAssignment;
  onGoToTraining?: () => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const age = player.age;
  const phase = getPhase(age);
  const { avg: baseAvg, min, max } = expectedOvrDelta(age, player.mental.work_ethic);
  const bonus = trainingBonus(training);
  const avg = baseAvg + (baseAvg >= 0 ? bonus : Math.min(0, baseAvg + bonus));
  const meta = PHASE_META[phase];
  const isUserTeam = teamId === userTeamId;
  const retirementRisk = age >= 37;
  const hasTraining = training && training.focus !== 'none';
  const focusStyle = hasTraining ? (FOCUS_COLORS[training!.focus] ?? FOCUS_COLORS.mental) : null;

  // Bar: center-origin, green right for growth, red left for decline
  const barPct = Math.min(100, Math.abs(avg) * 15);
  const barPositive = avg > 0;

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-colors',
      meta.bg, meta.border,
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-sm text-cream font-semibold truncate">{getPlayerName(player)}</span>
            <span className="font-mono text-[10px] text-cream-dim bg-navy-lighter px-1.5 py-0.5 rounded">{player.position}</span>
            {!isUserTeam && (
              <span className="font-mono text-[10px] text-cream-dim/40">Other team</span>
            )}
            {/* Training badge */}
            {hasTraining && focusStyle && (
              <span className={cn(
                'font-mono text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border',
                focusStyle.color, focusStyle.bg,
                training!.intensity === 'intense' ? 'border-current/50' : 'border-current/20',
              )}>
                {training!.focus} · {training!.intensity}
                {bonus > 0 && <span className="ml-1 text-green-light">+{bonus}</span>}
                {bonus < 0 && <span className="ml-1 text-red-400">{bonus}</span>}
              </span>
            )}
            {isUserTeam && !hasTraining && (
              <button
                className="font-mono text-[9px] text-blue-400/70 hover:text-blue-400 uppercase tracking-wide border border-blue-500/20 hover:border-blue-400/40 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                onClick={e => { e.stopPropagation(); onGoToTraining?.(); }}
                title="Set training in Training Center"
              >
                set training →
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 font-mono text-xs">
            <span className="text-cream-dim">Age {age}</span>
            <span className={cn('font-bold uppercase text-[10px] tracking-wide', meta.color)}>
              {meta.label}
            </span>
            {retirementRisk && (
              <span className="text-red-400/80 text-[10px] font-bold tracking-wide">RETIRE RISK</span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-mono text-lg font-bold text-cream leading-none">{ovr}</div>
          <div className="font-mono text-[10px] text-cream-dim">OVR</div>
        </div>
      </div>

      {/* Projection bar — center-origin */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between font-mono text-[10px] mb-1">
          <span className="text-cream-dim/50">Next offseason</span>
          <span className={cn(
            'font-bold',
            avg > 0 ? 'text-green-light' : avg < 0 ? 'text-red-400' : 'text-cream-dim',
          )}>
            {avg > 0 ? '+' : ''}{avg} avg
            <span className="text-cream-dim/40 font-normal ml-1">
              ({min > 0 ? '+' : ''}{min} to {max > 0 ? '+' : ''}{max})
            </span>
            {bonus !== 0 && (
              <span className={cn('ml-1 font-bold', bonus > 0 ? 'text-green-light' : 'text-red-400')}>
                ({bonus > 0 ? '+' : ''}{bonus} training)
              </span>
            )}
          </span>
        </div>

        <div className="relative h-1.5 bg-navy-lighter rounded-full overflow-hidden">
          {avg !== 0 ? (
            <div
              className={cn(
                'absolute top-0 h-full rounded-full transition-all duration-500',
                avg > 3 ? 'bg-green-light' :
                avg > 0 ? 'bg-green-light/60' :
                avg >= -2 ? 'bg-orange-400' :
                avg >= -4 ? 'bg-orange-500' : 'bg-red-500',
                barPositive ? 'left-1/2' : 'right-1/2',
              )}
              style={{ width: `${barPct / 2}%` }}
            />
          ) : (
            <div className="absolute inset-0 bg-cream-dim/15 rounded-full" />
          )}
          {/* Center tick */}
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-navy-lighter/60" />
        </div>
      </div>

      {/* Work ethic influence */}
      {phase !== 'peak' && (
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-cream-dim/40">
          <span>Work ethic {player.mental.work_ethic}</span>
          <span className="text-cream-dim/30">·</span>
          <span>{phase === 'growth' ? 'accelerates growth' : 'slows decline'}</span>
        </div>
      )}
    </div>
  );
}

// ── Development Change Card (past offseason) ─────────────────────────────────
function ChangeCard({ change, userTeamId }: { change: DevelopmentChange; userTeamId: string }) {
  const meta = PHASE_META[change.phase];
  const delta = change.ovrDelta;
  const isUserTeam = change.teamId === userTeamId;

  const topChanges = Object.entries(change.changes)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-colors',
      isUserTeam ? (meta.bg + ' ' + meta.border) : 'bg-navy-lighter/5 border-navy-lighter/20 opacity-60',
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-sm text-cream font-semibold truncate">{change.playerName}</span>
            <span className="font-mono text-[10px] text-cream-dim bg-navy-lighter px-1.5 py-0.5 rounded">{change.position}</span>
            <span className={cn('font-mono text-[10px] font-bold uppercase tracking-wide', meta.color)}>{meta.label}</span>
          </div>
          <p className="font-mono text-xs text-cream-dim/60 mt-0.5">Age {change.age}</p>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm text-cream-dim">{change.ovrBefore}</span>
            <span className="text-cream-dim/30 text-xs">→</span>
            <span className={cn(
              'font-mono text-sm font-bold',
              delta > 0 ? 'text-green-light' : delta < 0 ? 'text-red-400' : 'text-cream',
            )}>
              {change.ovrAfter}
            </span>
          </div>
          <div className={cn(
            'font-mono text-[11px] font-bold text-right',
            delta > 0 ? 'text-green-light' : delta < 0 ? 'text-red-400' : 'text-cream-dim',
          )}>
            {delta > 0 ? '+' : ''}{delta}
          </div>
        </div>
      </div>

      {topChanges.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {topChanges.map(([key, val]) => (
            <span key={key} className="font-mono text-[10px] text-cream-dim/50">
              {key.replace(/_[LR]$/, '').toUpperCase()}
              <span className={cn('ml-0.5 font-bold', val > 0 ? 'text-green-light' : 'text-red-400')}>
                {val > 0 ? '+' : ''}{val}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function DevelopmentHubPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, lastDevelopmentChanges, trainingAssignments } = useFranchiseStore();
  const [activeTab, setActiveTab] = useState<'projections' | 'history'>('projections');
  const [phaseFilter, setPhaseFilter] = useState<DevelopmentPhase | 'ALL'>('ALL');
  const [teamFilter, setTeamFilter] = useState<'user' | 'all'>('user');
  const [sortBy, setSortBy] = useState<'delta' | 'ovr' | 'age'>('delta');

  // All hooks must be called before any early return
  const userTeam = useMemo(
    () => (engine && userTeamId) ? engine.getTeam(userTeamId) : null,
    [engine, userTeamId],
  );

  const allPlayers = useMemo<{ player: Player; teamId: string }[]>(() => {
    if (!engine || !userTeamId) return [];
    if (teamFilter === 'user') {
      const t = engine.getTeam(userTeamId);
      return t ? t.roster.players.map(p => ({ player: p, teamId: t.id })) : [];
    }
    return engine.getAllTeams().flatMap(t => t.roster.players.map(p => ({ player: p, teamId: t.id })));
  }, [engine, userTeamId, teamFilter]);

  const filteredProjections = useMemo(() => {
    let list = phaseFilter === 'ALL'
      ? [...allPlayers]
      : allPlayers.filter(({ player }) => getPhase(player.age) === phaseFilter);
    list.sort((a, b) => {
      if (sortBy === 'age') return a.player.age - b.player.age;
      if (sortBy === 'ovr') return Math.round(evaluatePlayer(b.player)) - Math.round(evaluatePlayer(a.player));
      const aAvg = expectedOvrDelta(a.player.age, a.player.mental.work_ethic).avg;
      const bAvg = expectedOvrDelta(b.player.age, b.player.mental.work_ethic).avg;
      return bAvg - aAvg;
    });
    return list;
  }, [allPlayers, phaseFilter, sortBy]);

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = { growth: 0, peak: 0, decline: 0, steep: 0 };
    (userTeam?.roster.players ?? []).forEach(p => counts[getPhase(p.age)]++);
    return counts;
  }, [userTeam]);

  const filteredHistory = useMemo(() => {
    if (!lastDevelopmentChanges) return [];
    let list = teamFilter === 'user'
      ? lastDevelopmentChanges.filter(c => c.teamId === userTeamId)
      : [...lastDevelopmentChanges];
    list.sort((a, b) => {
      if (sortBy === 'delta') return Math.abs(b.ovrDelta) - Math.abs(a.ovrDelta);
      if (sortBy === 'age') return a.age - b.age;
      return b.ovrAfter - a.ovrAfter;
    });
    return list;
  }, [lastDevelopmentChanges, teamFilter, userTeamId, sortBy]);

  const biggestGains = useMemo(() =>
    (lastDevelopmentChanges ?? [])
      .filter(c => c.ovrDelta > 0 && c.teamId === userTeamId)
      .sort((a, b) => b.ovrDelta - a.ovrDelta)
      .slice(0, 3),
    [lastDevelopmentChanges, userTeamId],
  );

  const biggestDeclines = useMemo(() =>
    (lastDevelopmentChanges ?? [])
      .filter(c => c.ovrDelta < 0 && c.teamId === userTeamId)
      .sort((a, b) => a.ovrDelta - b.ovrDelta)
      .slice(0, 3),
    [lastDevelopmentChanges, userTeamId],
  );

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Development Hub</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Track player development, attribute growth, and potential grades for your entire roster.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Development Hub</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam?.city} {userTeam?.name} · {season.year} Season
          </p>
        </div>
        <Button onClick={() => navigate('/franchise/roster')} variant="ghost" size="sm">← Roster</Button>
      </div>

      {/* Roster age summary cards — click to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {(['growth', 'peak', 'decline', 'steep'] as DevelopmentPhase[]).map(phase => {
          const meta = PHASE_META[phase];
          const count = phaseCounts[phase];
          const active = phaseFilter === phase;
          return (
            <button
              key={phase}
              onClick={() => setPhaseFilter(active ? 'ALL' : phase)}
              title={active ? 'Click to clear filter' : `Filter to ${meta.label} players`}
              className={cn(
                'rounded-lg border px-4 py-3 text-center transition-all cursor-pointer group',
                active
                  ? meta.bg + ' ' + meta.border + ' shadow-sm ring-1 ring-current'
                  : 'bg-navy-light border-navy-lighter/50 hover:border-navy-lighter hover:bg-navy-lighter/10',
              )}
            >
              <p className={cn('font-display text-2xl font-bold transition-colors', active ? meta.color : 'text-cream group-hover:' + meta.color)}>{count}</p>
              <p className={cn('font-mono text-xs mt-0.5 font-bold uppercase tracking-wide', active ? meta.color : 'text-cream-dim')}>{meta.label}</p>
              <p className="font-mono text-[10px] text-cream-dim/40 mt-0.5">
                {phase === 'growth' ? 'Age ≤26' : phase === 'peak' ? 'Age 27–31' : phase === 'decline' ? 'Age 32–36' : 'Age 37+'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active filter pill */}
      {phaseFilter !== 'ALL' && (
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-xs text-cream-dim">Filtered by:</span>
          <button
            onClick={() => setPhaseFilter('ALL')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold cursor-pointer transition-all',
              PHASE_META[phaseFilter].bg, PHASE_META[phaseFilter].border, PHASE_META[phaseFilter].color,
              'border hover:opacity-70',
            )}
          >
            {PHASE_META[phaseFilter].label} ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-navy-lighter/30 rounded-xl p-1 mb-5 w-fit">
        {(['projections', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer',
              activeTab === tab ? 'bg-gold text-navy shadow-sm' : 'text-cream-dim hover:text-cream',
            )}
          >
            {tab === 'projections' ? '📈 Projections' : '📋 Offseason History'}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-cream-dim/60">Show:</span>
          {(['user', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setTeamFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded font-mono text-xs cursor-pointer transition-colors',
                teamFilter === f ? 'bg-gold text-navy font-bold' : 'bg-navy-lighter/60 text-cream-dim hover:text-cream',
              )}
            >
              {f === 'user' ? 'My Roster' : 'All Teams'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-cream-dim/60">Sort:</span>
          {(['delta', 'ovr', 'age'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-2.5 py-1 rounded font-mono text-xs cursor-pointer transition-colors',
                sortBy === s ? 'bg-gold text-navy font-bold' : 'bg-navy-lighter/60 text-cream-dim hover:text-cream',
              )}
            >
              {s === 'delta' ? 'Projection' : s === 'ovr' ? 'OVR' : 'Age'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Projections Tab ── */}
      {activeTab === 'projections' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
          <div>
            <Panel title={`Roster Projections (${filteredProjections.length})`}>
              {filteredProjections.length === 0 ? (
                <p className="font-mono text-sm text-cream-dim/40 text-center py-10">
                  No players match the selected filter
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredProjections.map(({ player, teamId }) => (
                    <ProjectionCard
                      key={player.id}
                      player={player}
                      userTeamId={userTeamId}
                      teamId={teamId}
                      training={teamId === userTeamId ? trainingAssignments[player.id] : undefined}
                      onGoToTraining={() => navigate('/franchise/training')}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            {/* Training Coverage — only show for user's roster */}
            {teamFilter === 'user' && (() => {
              const rosterPlayers = userTeam?.roster.players ?? [];
              const assigned = rosterPlayers.filter(p => {
                const t = trainingAssignments[p.id];
                return t && t.focus !== 'none' && t.intensity !== 'rest';
              });
              const intense = rosterPlayers.filter(p => trainingAssignments[p.id]?.intensity === 'intense');
              const unassigned = rosterPlayers.filter(p => !trainingAssignments[p.id] || trainingAssignments[p.id].focus === 'none');
              const pct = rosterPlayers.length > 0 ? Math.round(assigned.length / rosterPlayers.length * 100) : 0;
              return (
                <Panel title="Training Coverage">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-cream-dim">{assigned.length}/{rosterPlayers.length} assigned</span>
                      <span className={cn(
                        'font-mono text-xs font-bold',
                        pct >= 80 ? 'text-green-light' : pct >= 50 ? 'text-gold' : 'text-red-400',
                      )}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-navy-lighter rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pct >= 80 ? 'bg-green-light' : pct >= 50 ? 'bg-gold' : 'bg-red-400',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                      <div className="text-center rounded border border-gold/20 bg-gold/5 py-1.5">
                        <p className="text-gold font-bold text-base">{intense.length}</p>
                        <p className="text-cream-dim/60">Intense</p>
                      </div>
                      <div className="text-center rounded border border-red-400/20 bg-red-900/10 py-1.5">
                        <p className="text-red-400 font-bold text-base">{unassigned.length}</p>
                        <p className="text-cream-dim/60">Unassigned</p>
                      </div>
                    </div>
                    {unassigned.length > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate('/franchise/training')}
                      >
                        Assign Training →
                      </Button>
                    )}
                  </div>
                </Panel>
              );
            })()}

            <Panel title="Age Curve Guide">
              <div className="space-y-2.5">
                {(['growth', 'peak', 'decline', 'steep'] as DevelopmentPhase[]).map(phase => {
                  const meta = PHASE_META[phase];
                  return (
                    <div key={phase} className={cn('rounded-md border p-2.5', meta.bg, meta.border)}>
                      <p className={cn('font-mono text-xs font-bold mb-1 uppercase tracking-wide', meta.color)}>
                        {meta.label}{' '}
                        <span className="font-normal normal-case opacity-60">
                          {phase === 'growth' ? '(≤26)' : phase === 'peak' ? '(27–31)' : phase === 'decline' ? '(32–36)' : '(37+)'}
                        </span>
                      </p>
                      <p className="font-mono text-[10px] text-cream-dim/60 leading-relaxed">{meta.description}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Development Tips">
              <ul className="space-y-2 font-mono text-[11px] text-cream-dim/70">
                <li>• High <span className="text-gold font-bold">Work Ethic</span> accelerates growth and slows decline</li>
                <li>• Players 37+ face retirement risk each offseason</li>
                <li>• Young players (≤26) are valuable trade chips — they'll improve</li>
                <li>• Veterans 32+ can contribute but plan succession early</li>
                <li>• Peak years (27–31) are the window for winning now</li>
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {!lastDevelopmentChanges ? (
            <Panel>
              <div className="text-center py-12">
                <div className="text-4xl mb-3 opacity-30">📋</div>
                <p className="font-display text-xl text-cream-dim/50 mb-2">No History Yet</p>
                <p className="font-mono text-sm text-cream-dim/40 max-w-sm mx-auto">
                  Complete a full season and advance to the offseason to see player development results here.
                </p>
              </div>
            </Panel>
          ) : (
            <>
              {/* Summary stats for user team */}
              {(() => {
                const userChanges = lastDevelopmentChanges.filter(c => c.teamId === userTeamId);
                if (userChanges.length === 0) return null;
                const avg = Math.round(userChanges.reduce((s, c) => s + c.ovrDelta, 0) / userChanges.length * 10) / 10;
                const improved = userChanges.filter(c => c.ovrDelta > 0).length;
                const declined = userChanges.filter(c => c.ovrDelta < 0).length;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Panel title="Biggest Gains">
                      <div className="space-y-2">
                        {biggestGains.length === 0
                          ? <p className="font-mono text-xs text-cream-dim/40 text-center py-2">None this offseason</p>
                          : biggestGains.map(c => (
                            <div key={c.playerId} className="flex justify-between items-center font-mono text-xs">
                              <span className="text-cream truncate mr-2">{c.playerName}</span>
                              <span className="text-green-light font-bold shrink-0">+{c.ovrDelta}</span>
                            </div>
                          ))
                        }
                      </div>
                    </Panel>
                    <Panel title="Biggest Declines">
                      <div className="space-y-2">
                        {biggestDeclines.length === 0
                          ? <p className="font-mono text-xs text-cream-dim/40 text-center py-2">None this offseason</p>
                          : biggestDeclines.map(c => (
                            <div key={c.playerId} className="flex justify-between items-center font-mono text-xs">
                              <span className="text-cream truncate mr-2">{c.playerName}</span>
                              <span className="text-red-400 font-bold shrink-0">{c.ovrDelta}</span>
                            </div>
                          ))
                        }
                      </div>
                    </Panel>
                    <Panel title="Offseason Summary">
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-cream-dim">Players tracked</span>
                          <span className="text-cream font-bold">{userChanges.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cream-dim">Improved</span>
                          <span className="text-green-light font-bold">{improved}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cream-dim">Declined</span>
                          <span className="text-red-400 font-bold">{declined}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-cream-dim">Avg OVR change</span>
                          <span className={cn('font-bold', avg >= 0 ? 'text-green-light' : 'text-red-400')}>
                            {avg >= 0 ? '+' : ''}{avg}
                          </span>
                        </div>
                      </div>
                    </Panel>
                  </div>
                );
              })()}

              <Panel title={`Offseason Changes (${filteredHistory.length})`}>
                {filteredHistory.length === 0 ? (
                  <p className="font-mono text-sm text-cream-dim/40 text-center py-6">
                    No changes for the selected filter
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredHistory.map(change => (
                      <ChangeCard key={change.playerId + change.age} change={change} userTeamId={userTeamId} />
                    ))}
                  </div>
                )}
              </Panel>
            </>
          )}
        </div>
      )}
    </div>
  );
}
