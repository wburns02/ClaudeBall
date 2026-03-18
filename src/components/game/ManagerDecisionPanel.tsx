import { useState } from 'react';
import { getPlayer } from '@/engine/types/team.ts';
import type { Team } from '@/engine/types/team.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import type { BaseState } from '@/engine/types/game.ts';
import type { DefensiveAlignment, ManagerDecision } from '@/engine/types/manager.ts';
import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { BullpenStatus } from './BullpenStatus.tsx';

interface ManagerDecisionPanelProps {
  role: 'batting' | 'pitching';
  team: Team;
  bases: BaseState;
  outs: number;
  onDecision: (decision: ManagerDecision) => void;
}

function FatigueBar({ fatigue, label }: { fatigue: number; label?: string }) {
  const pct = Math.round(fatigue);
  const color =
    fatigue < 30 ? 'bg-green-500'
    : fatigue < 60 ? 'bg-yellow-500'
    : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-cream-dim w-12 flex-shrink-0">{label}</span>}
      <div className="flex-1 h-2 bg-navy-lighter rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-cream-dim w-8 text-right">{pct}%</span>
    </div>
  );
}

function AlignmentToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-cream-dim w-20 flex-shrink-0">{label}</span>
      <div className="flex rounded overflow-hidden border border-navy-lighter">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              'px-2 py-1 text-xs font-mono transition-all cursor-pointer',
              value === opt
                ? 'bg-gold text-navy font-bold'
                : 'text-cream-dim hover:bg-navy-lighter',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ManagerDecisionPanel({
  role,
  team,
  bases,
  outs,
  onDecision,
}: ManagerDecisionPanelProps) {
  const [alignment, setAlignment] = useState<DefensiveAlignment>({
    infieldShift: 'normal',
    infieldDepth: 'normal',
    outfieldDepth: 'normal',
  });

  const hasRunnerOnFirst = bases.first !== null;
  const hasAnyRunner = bases.first !== null || bases.second !== null || bases.third !== null;

  const pitcher = getPlayer(team, team.pitcherId);
  const pitcherFatigue = pitcher?.state.fatigue ?? 0;
  const pitcherPitchCount = pitcher?.state.pitchCount ?? 0;

  // Bench: roster players not in lineup and not bullpen
  const lineupIds = new Set(team.lineup.map(l => l.playerId));
  const bullpenIds = new Set(team.bullpen);
  const bench = team.roster.players.filter(
    p => !lineupIds.has(p.id) && !bullpenIds.has(p.id) && p.id !== team.pitcherId
  );

  function applyAlignmentChange(field: keyof DefensiveAlignment, value: string) {
    const next = { ...alignment, [field]: value } as DefensiveAlignment;
    setAlignment(next);
    onDecision({ type: 'defensive_shift', data: { alignment: next } });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Batting actions */}
      {role === 'batting' && (
        <Panel title="Offense">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasRunnerOnFirst}
                onClick={() => onDecision({ type: 'steal', data: { runner: bases.first } })}
              >
                Steal 2B
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasAnyRunner}
                onClick={() => onDecision({ type: 'hit_and_run' })}
              >
                Hit & Run
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={outs >= 2}
                onClick={() => onDecision({ type: 'sacrifice_bunt' })}
              >
                Sac Bunt
              </Button>
            </div>

            {bench.length > 0 && (
              <div className="mt-1">
                <p className="text-xs text-cream-dim mb-1 uppercase tracking-wide">Pinch Hit</p>
                <div className="flex flex-col gap-1">
                  {bench.slice(0, 4).map(p => (
                    <button
                      key={p.id}
                      onClick={() => onDecision({ type: 'pinch_hit', data: { playerId: p.id } })}
                      className="text-left text-xs text-cream hover:text-gold cursor-pointer px-2 py-1 rounded hover:bg-navy-lighter transition-colors"
                    >
                      #{p.number} {getPlayerName(p)}
                      <span className="text-cream-dim ml-2 font-mono">
                        {p.bats} · {p.batting.contact_R}ct · {p.batting.speed}spd
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Pitching actions */}
      {role === 'pitching' && pitcher && (
        <Panel title="Pitching">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-cream-dim">
                #{pitcher.number} {getPlayerName(pitcher)}
              </span>
              <span className="font-mono text-xs text-cream-dim">
                {pitcherPitchCount} pitches
              </span>
            </div>
            <FatigueBar fatigue={pitcherFatigue} label="Fatigue" />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDecision({ type: 'intentional_walk' })}
            >
              IBB
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDecision({ type: 'pitchout' })}
            >
              Pitchout
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDecision({ type: 'mound_visit' })}
            >
              Mound Visit
            </Button>
          </div>
        </Panel>
      )}

      {/* Defensive alignment — always visible */}
      <Panel title="Defense">
        <div className="flex flex-col gap-2">
          <AlignmentToggle
            label="Infield"
            options={['L', 'Norm', 'R']}
            value={alignment.infieldShift === 'normal' ? 'Norm' : alignment.infieldShift === 'shift_left' ? 'L' : 'R'}
            onChange={v => applyAlignmentChange(
              'infieldShift',
              v === 'Norm' ? 'normal' : v === 'L' ? 'shift_left' : 'shift_right',
            )}
          />
          <AlignmentToggle
            label="IF Depth"
            options={['In', 'Norm', 'Back']}
            value={alignment.infieldDepth === 'normal' ? 'Norm' : alignment.infieldDepth === 'in' ? 'In' : 'Back'}
            onChange={v => applyAlignmentChange(
              'infieldDepth',
              v === 'Norm' ? 'normal' : v === 'In' ? 'in' : 'back',
            )}
          />
          <AlignmentToggle
            label="OF Depth"
            options={['Shal', 'Norm', 'Deep']}
            value={alignment.outfieldDepth === 'normal' ? 'Norm' : alignment.outfieldDepth === 'shallow' ? 'Shal' : 'Deep'}
            onChange={v => applyAlignmentChange(
              'outfieldDepth',
              v === 'Norm' ? 'normal' : v === 'Shal' ? 'shallow' : 'deep',
            )}
          />
        </div>
      </Panel>

      {/* Bullpen */}
      {role === 'pitching' && (
        <BullpenStatus
          bullpen={team.bullpen.map(id => getPlayer(team, id)).filter((p): p is NonNullable<typeof p> => p !== undefined)}
          currentPitcherId={team.pitcherId}
          onSelect={id => onDecision({ type: 'pitching_change', data: { incomingId: id } })}
        />
      )}
    </div>
  );
}
