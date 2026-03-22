import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { addToast } from '@/stores/toastStore.ts';
import { cn } from '@/lib/cn.ts';
import type { Position, Hand } from '@/engine/types/enums.ts';
import type { BattingRatings, PitchingRatings, MentalRatings, FieldingRatings } from '@/engine/types/player.ts';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'P',  label: 'P'  },
  { value: 'C',  label: 'C'  },
  { value: '1B', label: '1B' },
  { value: '2B', label: '2B' },
  { value: '3B', label: '3B' },
  { value: 'SS', label: 'SS' },
  { value: 'LF', label: 'LF' },
  { value: 'CF', label: 'CF' },
  { value: 'RF', label: 'RF' },
  { value: 'DH', label: 'DH' },
];

const HANDS: { label: string; value: Hand }[] = [
  { label: 'L', value: 'L' },
  { label: 'R', value: 'R' },
  { label: 'S', value: 'S' },
];
const THROW_HANDS: { label: string; value: Hand }[] = [
  { label: 'L', value: 'L' },
  { label: 'R', value: 'R' },
];

interface ArchetypeTemplate {
  name: string;
  color: string;
  batting: Partial<BattingRatings>;
  pitching: Partial<Omit<PitchingRatings, 'repertoire'>>;
  position: Position;
}

const ARCHETYPES: ArchetypeTemplate[] = [
  {
    name: 'Power Hitter',
    color: '#ef4444',
    position: 'DH',
    batting: { contact_L: 55, contact_R: 58, power_L: 88, power_R: 92, eye: 52, avoid_k: 35, gap_power: 88, speed: 30, steal: 8, bunt: 12, clutch: 72 },
    pitching: {},
  },
  {
    name: 'Contact',
    color: '#22c55e',
    position: '2B',
    batting: { contact_L: 82, contact_R: 85, power_L: 38, power_R: 42, eye: 78, avoid_k: 80, gap_power: 50, speed: 68, steal: 55, bunt: 70, clutch: 60 },
    pitching: {},
  },
  {
    name: 'Speed',
    color: '#3b82f6',
    position: 'CF',
    batting: { contact_L: 72, contact_R: 70, power_L: 32, power_R: 35, eye: 65, avoid_k: 68, gap_power: 45, speed: 95, steal: 90, bunt: 75, clutch: 52 },
    pitching: {},
  },
  {
    name: 'Ace Pitcher',
    color: '#d4a843',
    position: 'P',
    batting: { contact_L: 15, contact_R: 15, power_L: 10, power_R: 10, eye: 15, avoid_k: 12, gap_power: 10, speed: 25, steal: 5, bunt: 20, clutch: 25 },
    pitching: { stuff: 90, movement: 82, control: 78, stamina: 85, velocity: 96, hold_runners: 72, groundball_pct: 52 },
  },
  {
    name: 'Closer',
    color: '#a855f7',
    position: 'P',
    batting: { contact_L: 12, contact_R: 12, power_L: 8, power_R: 8, eye: 12, avoid_k: 10, gap_power: 8, speed: 20, steal: 5, bunt: 15, clutch: 30 },
    pitching: { stuff: 95, movement: 75, control: 72, stamina: 45, velocity: 98, hold_runners: 80, groundball_pct: 48 },
  },
  {
    name: 'Utility',
    color: '#6b7280',
    position: 'SS',
    batting: { contact_L: 65, contact_R: 65, power_L: 52, power_R: 55, eye: 60, avoid_k: 58, gap_power: 55, speed: 60, steal: 45, bunt: 55, clutch: 55 },
    pitching: {},
  },
];

function ratingColor(v: number) {
  if (v >= 75) return '#22c55e';
  if (v >= 50) return '#eab308';
  return '#ef4444';
}

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

function RatingSlider({ label, value, min = 1, max = 100, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const color = ratingColor(min === 60 ? Math.round(((value - 60) / 45) * 100) : value);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-cream-dim uppercase tracking-wide">{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="absolute w-full h-1.5 rounded-full bg-navy-lighter overflow-hidden">
          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <input
          type="range" min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="relative w-full h-4 opacity-0 cursor-pointer z-10"
          style={{ WebkitAppearance: 'none' }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-gold bg-navy pointer-events-none shadow-md"
          style={{ left: `calc(${pct}% - 7px)`, top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>
    </div>
  );
}

export function CreatePlayerPage2() {
  const navigate = useNavigate();
  const { teams, createPlayer } = useFranchiseStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState(99);
  const [age, setAge] = useState(22);
  const [position, setPosition] = useState<Position>('CF');
  const [bats, setBats] = useState<Hand>('R');
  const [throws, setThrows] = useState<Hand>('R');
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? '');
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [batting, setBatting] = useState<BattingRatings>({
    contact_L: 50, contact_R: 50, power_L: 50, power_R: 50,
    eye: 50, avoid_k: 50, gap_power: 50, speed: 50, steal: 30, bunt: 30, clutch: 50,
  });
  const [pitching, setPitching] = useState<Omit<PitchingRatings, 'repertoire'> & { velocity: number }>({
    stuff: 50, movement: 50, control: 50, stamina: 50, velocity: 88,
    hold_runners: 50, groundball_pct: 50,
  });
  const [fielding, setFielding] = useState<Omit<FieldingRatings, 'position'>>({
    range: 50, arm_strength: 50, arm_accuracy: 50, turn_dp: 50, error_rate: 50,
  });
  const [mental, setMental] = useState<MentalRatings>({
    intelligence: 50, work_ethic: 50, durability: 50, consistency: 50, composure: 50, leadership: 50,
  });

  function applyArchetype(arch: ArchetypeTemplate) {
    setSelectedArchetype(arch.name);
    setPosition(arch.position);
    setBatting(prev => ({ ...prev, ...arch.batting }));
    if (Object.keys(arch.pitching).length > 0) {
      setPitching(prev => ({ ...prev, ...arch.pitching }));
    }
  }

  function bat(key: keyof BattingRatings) {
    return (v: number) => setBatting(prev => ({ ...prev, [key]: v }));
  }
  function pit(key: keyof Omit<PitchingRatings, 'repertoire'>) {
    return (v: number) => setPitching(prev => ({ ...prev, [key]: v }));
  }
  function fld(key: keyof Omit<FieldingRatings, 'position'>) {
    return (v: number) => setFielding(prev => ({ ...prev, [key]: v }));
  }
  function men(key: keyof MentalRatings) {
    return (v: number) => setMental(prev => ({ ...prev, [key]: v }));
  }

  function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter first and last name.');
      return;
    }
    if (!selectedTeamId) {
      setError('Please select a team.');
      return;
    }
    createPlayer(
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number,
        age,
        position,
        bats,
        throws,
        batting,
        pitching: { ...pitching, repertoire: ['fastball'] },
        fielding: [{ ...fielding, position }],
        mental,
        state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
      },
      selectedTeamId
    );
    addToast(`${firstName.trim()} ${lastName.trim()} added to roster`, 'success');
    navigate('/franchise/roster');
  }

  const inputClass = cn(
    'w-full bg-navy border border-navy-lighter rounded-md px-3 py-2',
    'text-cream font-body text-sm focus:outline-none focus:border-gold/60',
    'placeholder:text-cream-dim/40 transition-colors'
  );

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Create Player</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">Build a custom player and add them to any roster</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
          <Button variant="primary" onClick={handleCreate}>Create Player</Button>
        </div>
      </div>

      {/* Archetypes */}
      <Panel title="Quick-Fill Archetypes" className="mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {ARCHETYPES.map(arch => (
            <button
              key={arch.name}
              onClick={() => applyArchetype(arch)}
              className={cn(
                'py-2 px-3 rounded-lg border-2 text-xs font-display uppercase tracking-wide transition-all cursor-pointer',
                selectedArchetype === arch.name
                  ? 'scale-[1.04] shadow-lg'
                  : 'border-navy-lighter bg-navy-light hover:border-gold/40'
              )}
              style={selectedArchetype === arch.name ? {
                borderColor: arch.color,
                backgroundColor: `${arch.color}18`,
                color: arch.color,
              } : {}}
            >
              {arch.name}
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left */}
        <div className="space-y-4">
          <Panel title="Identity">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">First Name</label>
                  <input className={inputClass} value={firstName} placeholder="First" onChange={e => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">Last Name</label>
                  <input className={inputClass} value={lastName} placeholder="Last" onChange={e => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">Number</label>
                  <input type="number" min={0} max={99} className={inputClass} value={number} onChange={e => setNumber(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">Age</label>
                  <input type="number" min={18} max={45} className={inputClass} value={age} onChange={e => setAge(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1.5">Team</label>
                <select
                  className={cn(inputClass, 'cursor-pointer')}
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.city} {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1.5">Position</label>
                <div className="grid grid-cols-5 gap-1">
                  {POSITIONS.map(p => (
                    <button key={p.value} onClick={() => setPosition(p.value)}
                      className={cn('py-1.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                        position === p.value ? 'bg-gold text-navy font-bold' : 'bg-navy border border-navy-lighter text-cream-dim hover:text-cream hover:border-gold/40'
                      )}>
                      {p.value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1.5">Bats</label>
                  <div className="flex gap-1">
                    {HANDS.map(h => (
                      <button key={h.value} onClick={() => setBats(h.value)}
                        className={cn('flex-1 py-1.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                          bats === h.value ? 'bg-gold text-navy font-bold' : 'bg-navy border border-navy-lighter text-cream-dim hover:text-cream hover:border-gold/40'
                        )}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1.5">Throws</label>
                  <div className="flex gap-1">
                    {THROW_HANDS.map(h => (
                      <button key={h.value} onClick={() => setThrows(h.value)}
                        className={cn('flex-1 py-1.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                          throws === h.value ? 'bg-gold text-navy font-bold' : 'bg-navy border border-navy-lighter text-cream-dim hover:text-cream hover:border-gold/40'
                        )}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Batting">
            <div className="space-y-3">
              <RatingSlider label="Contact L" value={batting.contact_L} onChange={bat('contact_L')} />
              <RatingSlider label="Contact R" value={batting.contact_R} onChange={bat('contact_R')} />
              <RatingSlider label="Power L" value={batting.power_L} onChange={bat('power_L')} />
              <RatingSlider label="Power R" value={batting.power_R} onChange={bat('power_R')} />
              <RatingSlider label="Eye" value={batting.eye} onChange={bat('eye')} />
              <RatingSlider label="Avoid K" value={batting.avoid_k} onChange={bat('avoid_k')} />
              <RatingSlider label="Gap Power" value={batting.gap_power} onChange={bat('gap_power')} />
              <RatingSlider label="Speed" value={batting.speed} onChange={bat('speed')} />
              <RatingSlider label="Steal" value={batting.steal} onChange={bat('steal')} />
              <RatingSlider label="Bunt" value={batting.bunt} onChange={bat('bunt')} />
              <RatingSlider label="Clutch" value={batting.clutch} onChange={bat('clutch')} />
            </div>
          </Panel>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <Panel title="Pitching">
            <div className="space-y-3">
              <RatingSlider label="Stuff" value={pitching.stuff} onChange={pit('stuff')} />
              <RatingSlider label="Movement" value={pitching.movement} onChange={pit('movement')} />
              <RatingSlider label="Control" value={pitching.control} onChange={pit('control')} />
              <RatingSlider label="Stamina" value={pitching.stamina} onChange={pit('stamina')} />
              <RatingSlider label="Velocity (mph)" value={pitching.velocity} min={60} max={105} onChange={pit('velocity')} />
              <RatingSlider label="Hold Runners" value={pitching.hold_runners} onChange={pit('hold_runners')} />
              <RatingSlider label="Groundball %" value={pitching.groundball_pct} onChange={pit('groundball_pct')} />
            </div>
          </Panel>

          <Panel title="Fielding">
            <div className="space-y-3">
              <RatingSlider label="Range" value={fielding.range} onChange={fld('range')} />
              <RatingSlider label="Arm Strength" value={fielding.arm_strength} onChange={fld('arm_strength')} />
              <RatingSlider label="Arm Accuracy" value={fielding.arm_accuracy} onChange={fld('arm_accuracy')} />
              <RatingSlider label="Turn DP" value={fielding.turn_dp} onChange={fld('turn_dp')} />
              <RatingSlider label="Error Rate (low=good)" value={fielding.error_rate} onChange={fld('error_rate')} />
            </div>
          </Panel>

          <Panel title="Mental">
            <div className="space-y-3">
              <RatingSlider label="Intelligence" value={mental.intelligence} onChange={men('intelligence')} />
              <RatingSlider label="Work Ethic" value={mental.work_ethic} onChange={men('work_ethic')} />
              <RatingSlider label="Durability" value={mental.durability} onChange={men('durability')} />
              <RatingSlider label="Consistency" value={mental.consistency} onChange={men('consistency')} />
              <RatingSlider label="Composure" value={mental.composure} onChange={men('composure')} />
              <RatingSlider label="Leadership" value={mental.leadership} onChange={men('leadership')} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 pb-8">
        {error && <p className="text-red-400 text-sm font-mono mr-auto">{error}</p>}
        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        <Button variant="primary" onClick={handleCreate}>Create Player</Button>
      </div>
    </div>
  );
}
