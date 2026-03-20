import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { addToast } from '@/stores/toastStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { TrainingFocus, TrainingIntensity, TrainingAssignment } from '@/engine/player/DevelopmentEngine.ts';
import type { Player } from '@/engine/types/player.ts';
import type { DevelopmentChange } from '@/engine/season/OffseasonEngine.ts';

// ── Training metadata ────────────────────────────────────────────────────────

interface FocusOption {
  id: TrainingFocus;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  forPitchers: boolean;
  forHitters: boolean;
}

const FOCUS_OPTIONS: FocusOption[] = [
  { id: 'contact',  label: 'Contact',  description: 'Improve bat-to-ball skills',      color: 'text-blue-400',   bg: 'bg-blue-900/20',   border: 'border-blue-500/30',   forPitchers: false, forHitters: true  },
  { id: 'power',    label: 'Power',    description: 'Develop raw hitting power',        color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/30', forPitchers: false, forHitters: true  },
  { id: 'eye',      label: 'Eye',      description: 'Plate discipline & walk rate',     color: 'text-green-light',bg: 'bg-green-900/20',  border: 'border-green-500/30',  forPitchers: false, forHitters: true  },
  { id: 'speed',    label: 'Speed',    description: 'Running speed & base-stealing',    color: 'text-cyan-400',   bg: 'bg-cyan-900/20',   border: 'border-cyan-500/30',   forPitchers: false, forHitters: true  },
  { id: 'stuff',    label: 'Stuff',    description: 'Pitch quality & strikeout power',  color: 'text-red-400',    bg: 'bg-red-900/20',    border: 'border-red-500/30',    forPitchers: true,  forHitters: false },
  { id: 'movement', label: 'Movement', description: 'Pitch break & deception',          color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-500/30', forPitchers: true,  forHitters: false },
  { id: 'control',  label: 'Control',  description: 'Walk rate & command',              color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30',       forPitchers: true,  forHitters: false },
  { id: 'stamina',  label: 'Stamina',  description: 'Innings pitched & pitch efficiency',color: 'text-teal-400',  bg: 'bg-teal-900/20',   border: 'border-teal-500/30',   forPitchers: true,  forHitters: false },
  { id: 'mental',   label: 'Mental',   description: 'Work ethic, composure, leadership', color: 'text-cream',     bg: 'bg-cream/5',       border: 'border-cream/20',      forPitchers: true,  forHitters: true  },
];

interface IntensityOption {
  id: TrainingIntensity;
  label: string;
  description: string;
  projBonus: string;
  riskNote: string;
  color: string;
  bg: string;
  border: string;
}

const INTENSITY_OPTIONS: IntensityOption[] = [
  { id: 'rest',    label: 'Rest',    description: 'Full recovery',          projBonus: '—',       riskNote: 'Injury risk ↓',   color: 'text-cream-dim', bg: 'bg-navy-lighter/10',  border: 'border-navy-lighter/30' },
  { id: 'light',   label: 'Light',   description: 'Easy maintenance work',  projBonus: '+0–1',    riskNote: 'Normal risk',      color: 'text-blue-400',   bg: 'bg-blue-900/10',      border: 'border-blue-500/20'     },
  { id: 'normal',  label: 'Normal',  description: 'Standard training load', projBonus: '+1–2',    riskNote: 'Normal risk',      color: 'text-green-light',bg: 'bg-green-900/10',     border: 'border-green-500/20'    },
  { id: 'intense', label: 'Intense', description: 'Push to the limit',      projBonus: '+2–4',    riskNote: '⚠ Injury risk ↑', color: 'text-gold',       bg: 'bg-gold/8',           border: 'border-gold/25'         },
];

// ── Phase helpers ─────────────────────────────────────────────────────────────

function getPhaseLabel(age: number): string {
  if (age <= 26) return 'Growth';
  if (age <= 31) return 'Peak';
  if (age <= 36) return 'Decline';
  return 'Steep';
}

function getPhaseColor(age: number): string {
  if (age <= 26) return 'text-green-light';
  if (age <= 31) return 'text-gold';
  if (age <= 36) return 'text-orange-400';
  return 'text-red-400';
}

// ── Player Training Card ──────────────────────────────────────────────────────

function PlayerTrainingCard({
  player,
  assignment,
  onChange,
}: {
  player: Player;
  assignment: TrainingAssignment | undefined;
  onChange: (a: TrainingAssignment) => void;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const isPitcher = player.position === 'P';
  const applicableFocuses = FOCUS_OPTIONS.filter(f => isPitcher ? f.forPitchers : f.forHitters);

  const currentFocus = assignment?.focus ?? 'none';
  const currentIntensity = assignment?.intensity ?? 'normal';

  const focusMeta = FOCUS_OPTIONS.find(f => f.id === currentFocus);

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      assignment && assignment.intensity !== 'rest'
        ? 'border-gold/20 bg-navy-light'
        : 'border-navy-lighter/40 bg-navy-light/60',
    )}>
      {/* Player header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-lighter/30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-9 h-9 rounded-full bg-navy-lighter flex items-center justify-center">
            <span className="font-mono text-xs text-gold font-bold">{player.position}</span>
          </div>
          <div className="min-w-0">
            <p className="font-body text-sm text-cream font-semibold truncate">{getPlayerName(player)}</p>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-cream-dim">Age {player.age}</span>
              <span className={cn('font-bold', getPhaseColor(player.age))}>{getPhaseLabel(player.age)}</span>
              <span className="text-cream-dim/40">·</span>
              <span className="text-cream-dim/60" title="Work ethic affects training gains">
                WE <span className={cn(
                  'font-bold',
                  player.mental.work_ethic >= 70 ? 'text-green-light' :
                  player.mental.work_ethic >= 50 ? 'text-cream' : 'text-orange-400',
                )}>{player.mental.work_ethic}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="font-mono text-lg font-bold text-cream leading-none">{ovr}</p>
          <p className="font-mono text-[10px] text-cream-dim">OVR</p>
        </div>
      </div>

      {/* Training focus selector */}
      <div className="px-4 py-3">
        <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-2">Training Focus</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => onChange({ focus: 'none', intensity: currentIntensity })}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer border',
              currentFocus === 'none'
                ? 'bg-navy-lighter border-navy-lighter text-cream'
                : 'bg-transparent border-navy-lighter/30 text-cream-dim/50 hover:text-cream-dim',
            )}
          >
            General
          </button>
          {applicableFocuses.map(f => (
            <button
              key={f.id}
              onClick={() => onChange({ focus: f.id, intensity: currentIntensity })}
              title={f.description}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer border',
                currentFocus === f.id
                  ? (f.bg + ' ' + f.border + ' ' + f.color + ' font-bold')
                  : 'bg-transparent border-navy-lighter/30 text-cream-dim/50 hover:text-cream-dim hover:border-navy-lighter',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Focus description */}
        {focusMeta && currentFocus !== 'none' && (
          <p className="font-mono text-[10px] text-cream-dim/50 mb-3">
            Focus: <span className={cn('font-semibold', focusMeta.color)}>{focusMeta.description}</span>
          </p>
        )}

        {/* Intensity selector */}
        <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-widest mb-2">Intensity</p>
        <div className="grid grid-cols-4 gap-1">
          {INTENSITY_OPTIONS.map(intensity => (
            <button
              key={intensity.id}
              onClick={() => onChange({ focus: currentFocus as TrainingFocus | 'none', intensity: intensity.id })}
              title={`${intensity.description} · ${intensity.riskNote}`}
              className={cn(
                'flex flex-col items-center py-2 px-1 rounded-lg border text-center transition-all cursor-pointer',
                currentIntensity === intensity.id
                  ? (intensity.bg + ' ' + intensity.border + ' ' + intensity.color)
                  : 'bg-transparent border-navy-lighter/20 text-cream-dim/40 hover:border-navy-lighter/60 hover:text-cream-dim',
              )}
            >
              <span className="font-mono text-[10px] font-bold">{intensity.label}</span>
              <span className="font-mono text-[9px] opacity-70 mt-0.5">{intensity.projBonus}</span>
            </button>
          ))}
        </div>

        {/* Risk warning for intense */}
        {currentIntensity === 'intense' && (
          <p className="font-mono text-[10px] text-gold/70 mt-2">
            ⚠ Intense training carries higher injury risk during the offseason
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function TrainingCenterPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, trainingAssignments, setTrainingAssignment, clearTrainingAssignments, lastDevelopmentChanges } = useFranchiseStore();

  const userTeam = useMemo(
    () => (engine && userTeamId) ? engine.getTeam(userTeamId) : null,
    [engine, userTeamId],
  );

  const roster = useMemo(() => userTeam?.roster.players ?? [], [userTeam]);

  // Summary stats
  const summary = useMemo(() => {
    let focused = 0, resting = 0, general = 0;
    for (const p of roster) {
      const a = trainingAssignments[p.id];
      if (!a) { general++; continue; }
      if (a.intensity === 'rest') { resting++; continue; }
      if (a.focus === 'none') { general++; continue; }
      focused++;
    }
    return { focused, resting, general };
  }, [roster, trainingAssignments]);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Training Center</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Assign training programs to your players to develop their skills over the season.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const pitchers = roster.filter(p => p.position === 'P');
  const hitters = roster.filter(p => p.position !== 'P');

  function handleTrainingChange(playerId: string, playerName: string, a: TrainingAssignment) {
    setTrainingAssignment(playerId, a);
    const focusLabel = a.intensity === 'rest' ? 'Rest' : a.focus === 'none' ? 'General' : a.focus.charAt(0).toUpperCase() + a.focus.slice(1);
    addToast(`${playerName}: ${focusLabel} (${a.intensity})`, 'info');
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Training Center</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam?.city} {userTeam?.name} · {season.year} — Set focus for next offseason
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/franchise/development')} variant="ghost" size="sm">
            Development Hub
          </Button>
          <Button
            onClick={clearTrainingAssignments}
            variant="secondary"
            size="sm"
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Completion banner */}
      {summary.general === 0 && summary.focused + summary.resting === roster.length && roster.length > 0 && (
        <div className="mb-4 px-4 py-2.5 rounded-lg border border-green-light/30 bg-green-900/15 flex items-center gap-2">
          <span className="text-green-light text-base">✓</span>
          <p className="font-mono text-sm text-green-light">
            All {roster.length} players assigned — training plan complete for next offseason.
          </p>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-green-light/20 bg-green-900/10 px-4 py-3 text-center">
          <p className="font-display text-2xl font-bold text-green-light">{summary.focused}</p>
          <p className="font-mono text-xs text-green-light/70 mt-0.5">Focused Training</p>
        </div>
        <div className="rounded-lg border border-cream/10 bg-cream/5 px-4 py-3 text-center">
          <p className="font-display text-2xl font-bold text-cream-dim">{summary.general}</p>
          <p className="font-mono text-xs text-cream-dim/50 mt-0.5">General / None</p>
        </div>
        <div className="rounded-lg border border-navy-lighter/30 bg-navy-light/40 px-4 py-3 text-center">
          <p className="font-display text-2xl font-bold text-cream-dim/50">{summary.resting}</p>
          <p className="font-mono text-xs text-cream-dim/40 mt-0.5">Resting</p>
        </div>
        <div className="rounded-lg border border-navy-lighter/30 bg-navy-light/40 px-4 py-3 text-center">
          <p className="font-display text-2xl font-bold text-cream">{roster.length}</p>
          <p className="font-mono text-xs text-cream-dim/50 mt-0.5">Total Players</p>
        </div>
      </div>

      {/* Last offseason results */}
      {lastDevelopmentChanges && userTeamId && (() => {
        const myChanges = lastDevelopmentChanges.filter(c => c.teamId === userTeamId && c.ovrDelta !== 0);
        if (myChanges.length === 0) return null;
        const improved = myChanges.filter(c => c.ovrDelta > 0);
        const declined = myChanges.filter(c => c.ovrDelta < 0);
        return (
          <div className="mb-6 rounded-lg border border-green-light/20 bg-green-900/10 px-4 py-3">
            <h3 className="font-mono text-xs text-green-light/70 uppercase tracking-wider mb-3">
              Last Offseason Development Results — {myChanges.length} players changed
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {[...improved, ...declined].slice(0, 20).map((c: DevelopmentChange) => (
                <div key={c.playerId} className="flex items-center justify-between gap-2 font-mono text-xs">
                  <span className="text-cream truncate">{c.playerName}</span>
                  <span className={cn(
                    'shrink-0 font-bold',
                    c.ovrDelta > 0 ? 'text-green-light' : 'text-red-400',
                  )}>
                    {c.ovrDelta > 0 ? '+' : ''}{c.ovrDelta} OVR
                  </span>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] text-cream-dim/40 mt-2">
              {improved.length} improved · {declined.length} declined
            </p>
          </div>
        );
      })()}

      {/* How it works callout */}
      <div className="mb-6 px-4 py-3 rounded-lg border border-gold/15 bg-gold/5 font-mono text-xs text-cream-dim/70">
        <span className="text-gold font-bold">How training works: </span>
        Focus areas target specific ratings during the next offseason development run.
        Intense training gives larger gains but adds injury risk. Resting players recover fully.
        Assignments auto-clear after the offseason applies them.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pitchers */}
        <div>
          <h2 className="font-display text-lg text-cream tracking-wide uppercase mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Pitchers ({pitchers.length})
          </h2>
          <div className="space-y-3">
            {pitchers.length === 0 ? (
              <Panel><p className="font-mono text-xs text-cream-dim/40 text-center py-4">No pitchers on roster</p></Panel>
            ) : (
              pitchers.map(p => (
                <PlayerTrainingCard
                  key={p.id}
                  player={p}
                  assignment={trainingAssignments[p.id]}
                  onChange={(a) => handleTrainingChange(p.id, getPlayerName(p), a)}
                />
              ))
            )}
          </div>
        </div>

        {/* Hitters */}
        <div>
          <h2 className="font-display text-lg text-cream tracking-wide uppercase mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Position Players ({hitters.length})
          </h2>
          <div className="space-y-3">
            {hitters.length === 0 ? (
              <Panel><p className="font-mono text-xs text-cream-dim/40 text-center py-4">No hitters on roster</p></Panel>
            ) : (
              hitters.map(p => (
                <PlayerTrainingCard
                  key={p.id}
                  player={p}
                  assignment={trainingAssignments[p.id]}
                  onChange={(a) => handleTrainingChange(p.id, getPlayerName(p), a)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Intensity legend */}
      <div className="mt-8">
        <Panel title="Training Intensity Guide">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {INTENSITY_OPTIONS.map(opt => (
              <div key={opt.id} className={cn('rounded-lg border p-3', opt.bg, opt.border)}>
                <p className={cn('font-mono text-xs font-bold mb-1', opt.color)}>{opt.label}</p>
                <p className="font-mono text-[10px] text-cream-dim/60">{opt.description}</p>
                <p className={cn('font-mono text-[10px] font-bold mt-1', opt.color)}>
                  Bonus: {opt.projBonus}
                </p>
                <p className="font-mono text-[9px] text-cream-dim/40 mt-0.5">{opt.riskNote}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
