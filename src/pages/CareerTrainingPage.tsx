import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useCareerStore } from '@/stores/careerStore.ts';
import type { TrainingFocus } from '@/engine/player/CareerEngine.ts';
import { cn } from '@/lib/cn.ts';

const BATTING_FOCUSES: { focus: TrainingFocus; label: string; description: string; color: string; affectsKey: string }[] = [
  { focus: 'Contact',  label: 'Contact',  description: 'Improve bat-to-ball skill. Raises Contact rating.',                 color: '#22c55e', affectsKey: 'Contact L/R' },
  { focus: 'Power',    label: 'Power',    description: 'Build raw power. Raises Power rating, generates more HR.',           color: '#ef4444', affectsKey: 'Power L/R' },
  { focus: 'Speed',    label: 'Speed',    description: 'Improve foot speed and baserunning. Raises Speed & Steal.',          color: '#f59e0b', affectsKey: 'Speed, Steal' },
  { focus: 'Eye',      label: 'Plate Eye',description: 'Better pitch recognition. Raises Eye & Avoid K.',                   color: '#3b82f6', affectsKey: 'Eye, Avoid K' },
  { focus: 'Fielding', label: 'Fielding', description: 'Improve defensive skills. Raises Range & Arm Strength.',            color: '#a855f7', affectsKey: 'Range, Arm' },
];

const PITCHING_FOCUSES: { focus: TrainingFocus; label: string; description: string; color: string; affectsKey: string }[] = [
  { focus: 'Stuff',    label: 'Stuff',    description: 'Improve pitch quality and movement. Raises Stuff rating.',          color: '#3b82f6', affectsKey: 'Stuff' },
  { focus: 'Control',  label: 'Control',  description: 'Improve command and location. Raises Control rating.',             color: '#22c55e', affectsKey: 'Control' },
  { focus: 'Stamina',  label: 'Stamina',  description: 'Build endurance for deeper outings. Raises Stamina.',              color: '#f59e0b', affectsKey: 'Stamina' },
  { focus: 'Velocity', label: 'Velocity', description: 'Add MPH to your fastball. Raises velocity.',                       color: '#ef4444', affectsKey: 'Velocity' },
  { focus: 'Fielding', label: 'Fielding', description: 'Improve fielding and holding runners.',                             color: '#a855f7', affectsKey: 'Range, Arm' },
];

interface FocusCardProps {
  focus: TrainingFocus;
  label: string;
  description: string;
  color: string;
  affectsKey: string;
  selected: boolean;
  isSecondary?: boolean;
  onSelect: () => void;
}

function FocusCard({ focus, label, description, color, affectsKey, selected, isSecondary, onSelect }: FocusCardProps) {
  void focus; // used by parent
  return (
    <button
      onClick={onSelect}
      className={cn(
        'text-left p-3 rounded-lg border-2 transition-all cursor-pointer w-full',
        'hover:scale-[1.01] active:scale-[0.99]',
        selected ? 'shadow-lg scale-[1.01]' : 'border-navy-lighter bg-navy-light/60'
      )}
      style={selected ? {
        borderColor: color,
        backgroundColor: `${color}15`,
        boxShadow: `0 0 12px ${color}33`,
      } : {}}
    >
      <div className="flex items-start gap-2">
        <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: color }} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold" style={{ color: selected ? color : '#e8e0d4' }}>
              {label}
            </span>
            {selected && isSecondary && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase" style={{ backgroundColor: `${color}30`, color }}>
                Secondary
              </span>
            )}
            {selected && !isSecondary && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase" style={{ backgroundColor: `${color}30`, color }}>
                Primary
              </span>
            )}
          </div>
          <p className="text-cream-dim/70 text-xs mt-0.5 leading-relaxed">{description}</p>
          <p className="text-xs mt-1" style={{ color: selected ? color : '#a09880' }}>
            + {affectsKey}
          </p>
        </div>
      </div>
    </button>
  );
}

// Simple progress bar showing estimated off-season gain
function GainBar({ label, gain }: { label: string; gain: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-cream-dim text-xs font-mono w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-navy rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${Math.min(100, gain * 20)}%` }}
        />
      </div>
      <span className="text-green-400 text-xs font-mono">+{gain.toFixed(1)}</span>
    </div>
  );
}

export function CareerTrainingPage() {
  const navigate = useNavigate();
  const careerState = useCareerStore(s => s.careerState);
  const setTrainingPlan = useCareerStore(s => s.setTrainingPlan);

  const [primary,   setPrimary]   = useState<TrainingFocus | null>(careerState?.trainingPlan.primary ?? null);
  const [secondary, setSecondary] = useState<TrainingFocus | null>(careerState?.trainingPlan.secondary ?? null);
  const [restDays,  setRestDays]  = useState(careerState?.trainingPlan.restDays ?? 2);
  const [saved,     setSaved]     = useState(false);

  if (!careerState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Panel className="text-center max-w-sm">
          <p className="text-cream py-4">No career in progress.</p>
          <Button onClick={() => navigate('/career/new')}>Start Career</Button>
        </Panel>
      </div>
    );
  }

  const { player } = careerState;
  const isPitcher = player.position === 'P';
  const focuses = isPitcher ? PITCHING_FOCUSES : BATTING_FOCUSES;

  function handleSave() {
    if (!primary || !secondary) return;
    setTrainingPlan({ primary, secondary, restDays });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Estimate gains
  function estimateGain(focus: TrainingFocus): number {
    const isPrim = focus === primary;
    const isSec  = focus === secondary;
    const age = player.age;
    const growthFactor = age < 24 ? 0.8 : age < 30 ? 0.6 : 0.3;
    const base = isPrim ? 2.5 : isSec ? 1.5 : 0;
    return base * growthFactor;
  }

  const restPenalty = restDays >= 5 ? 'High rest → less overall gain' : restDays >= 3 ? 'Balanced rest' : 'Low rest → more gain, higher injury risk';

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-tight uppercase">Training Plan</h1>
            <p className="text-cream-dim text-sm font-mono mt-1">
              {player.firstName} {player.lastName} · Age {player.age} ·
              Training affects offseason development
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/career')}>← Dashboard</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Focus selector */}
          <div className="space-y-4">
            <Panel title="Primary Focus">
              <p className="text-cream-dim text-xs font-mono mb-3">Main training area — largest attribute bonus.</p>
              <div className="space-y-2">
                {focuses.map(f => (
                  <FocusCard
                    key={f.focus}
                    {...f}
                    selected={primary === f.focus}
                    onSelect={() => {
                      setPrimary(f.focus);
                      if (secondary === f.focus) setSecondary(null);
                      setSaved(false);
                    }}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Secondary Focus">
              <p className="text-cream-dim text-xs font-mono mb-3">Secondary area — smaller bonus.</p>
              <div className="space-y-2">
                {focuses.filter(f => f.focus !== primary).map(f => (
                  <FocusCard
                    key={f.focus}
                    {...f}
                    selected={secondary === f.focus}
                    isSecondary
                    onSelect={() => { setSecondary(f.focus); setSaved(false); }}
                  />
                ))}
              </div>
            </Panel>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Rest days */}
            <Panel title="Rest & Recovery">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-mono text-cream-dim mb-2">
                    <span>Rest Days Per Week</span>
                    <span className="text-gold">{restDays} days</span>
                  </div>
                  <input
                    type="range"
                    min={1} max={6}
                    value={restDays}
                    onChange={e => setRestDays(parseInt(e.target.value))}
                    className="w-full accent-gold cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-cream-dim/50 mt-1">
                    <span>Grind</span>
                    <span>Rest</span>
                  </div>
                </div>
                <p className="text-xs font-mono" style={{
                  color: restDays >= 5 ? '#f59e0b' : restDays >= 3 ? '#22c55e' : '#ef4444'
                }}>
                  {restPenalty}
                </p>
              </div>
            </Panel>

            {/* Estimated gains */}
            <Panel title="Estimated Offseason Gains">
              {!primary && !secondary ? (
                <p className="text-cream-dim text-xs font-mono">Select focus areas to see estimates.</p>
              ) : (
                <div className="space-y-3">
                  {isPitcher ? (
                    <>
                      <GainBar label="Stuff"    gain={estimateGain('Stuff')} />
                      <GainBar label="Control"  gain={estimateGain('Control')} />
                      <GainBar label="Stamina"  gain={estimateGain('Stamina')} />
                      <GainBar label="Velocity" gain={estimateGain('Velocity')} />
                      <GainBar label="Fielding" gain={estimateGain('Fielding')} />
                    </>
                  ) : (
                    <>
                      <GainBar label="Contact"  gain={estimateGain('Contact')} />
                      <GainBar label="Power"    gain={estimateGain('Power')} />
                      <GainBar label="Speed"    gain={estimateGain('Speed')} />
                      <GainBar label="Eye"      gain={estimateGain('Eye')} />
                      <GainBar label="Fielding" gain={estimateGain('Fielding')} />
                    </>
                  )}
                  <p className="text-cream-dim/60 text-[10px] font-mono pt-1">
                    Actual gains vary based on age, work ethic, and randomness.
                    Age {player.age} growth factor:{' '}
                    {player.age < 24 ? 'HIGH' : player.age < 30 ? 'MODERATE' : player.age < 34 ? 'LOW' : 'VERY LOW'}
                  </p>
                </div>
              )}
            </Panel>

            {/* Current plan summary */}
            <Panel title="Current Plan">
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-cream-dim">Primary</span>
                  <span className="text-gold">{careerState.trainingPlan.primary}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-dim">Secondary</span>
                  <span className="text-gold">{careerState.trainingPlan.secondary}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-dim">Rest Days</span>
                  <span className="text-cream">{careerState.trainingPlan.restDays}</span>
                </div>
              </div>
            </Panel>

            {/* Save button */}
            <Button
              className="w-full"
              disabled={!primary || !secondary}
              onClick={handleSave}
            >
              {saved ? 'Plan Saved!' : 'Save Training Plan'}
            </Button>

            <Button variant="ghost" className="w-full" onClick={() => navigate('/career')}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Tips */}
        <Panel title="Training Tips">
          <ul className="space-y-1 text-cream-dim text-xs font-mono">
            <li>• Young players (under 24) see the biggest gains — prioritize your weakness.</li>
            <li>• After age 30, physical skills (Speed, Velocity) start declining regardless of training.</li>
            <li>• High work_ethic rating amplifies all training gains.</li>
            <li>• Two similar focuses (e.g. Contact + Eye) produce a more well-rounded gain.</li>
            <li>• Training plan applies only once per offseason when you Advance Offseason.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
