import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
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
        {/* track */}
        <div className="absolute w-full h-1.5 rounded-full bg-navy-lighter overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="relative w-full h-4 opacity-0 cursor-pointer z-10"
          style={{ WebkitAppearance: 'none' }}
        />
        {/* thumb overlay */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-gold bg-navy pointer-events-none shadow-md"
          style={{ left: `calc(${pct}% - 7px)`, top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-5 first:mt-0">
      <div className="w-1 h-5 bg-gold rounded-full" />
      <h3 className="font-display text-gold text-base tracking-wider uppercase">{title}</h3>
      <div className="flex-1 h-px bg-navy-lighter" />
    </div>
  );
}

export function PlayerEditorPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { teams, updatePlayer } = useFranchiseStore();

  const player = useMemo(() => {
    for (const team of teams) {
      const p = team.roster.players.find(pl => pl.id === playerId);
      if (p) return p;
    }
    return null;
  }, [teams, playerId]);

  const [firstName, setFirstName] = useState(player?.firstName ?? '');
  const [lastName, setLastName] = useState(player?.lastName ?? '');
  const [number, setNumber] = useState(player?.number ?? 0);
  const [age, setAge] = useState(player?.age ?? 25);
  const [position, setPosition] = useState<Position>(player?.position ?? 'CF');
  const [bats, setBats] = useState<Hand>(player?.bats ?? 'R');
  const [throws, setThrows] = useState<Hand>(player?.throws ?? 'R');

  const [batting, setBatting] = useState<BattingRatings>(
    player?.batting ?? {
      contact_L: 50, contact_R: 50, power_L: 50, power_R: 50,
      eye: 50, avoid_k: 50, gap_power: 50, speed: 50,
      steal: 30, bunt: 30, clutch: 50,
    }
  );

  const [pitching, setPitching] = useState<PitchingRatings>(
    player?.pitching ?? {
      stuff: 50, movement: 50, control: 50, stamina: 50, velocity: 90,
      hold_runners: 50, groundball_pct: 50, repertoire: ['fastball'],
    }
  );

  const [fielding, setFielding] = useState<FieldingRatings>(
    (player?.fielding?.[0]) ?? {
      position, range: 50, arm_strength: 50, arm_accuracy: 50, turn_dp: 50, error_rate: 50,
    }
  );

  const [mental, setMental] = useState<MentalRatings>(
    player?.mental ?? {
      intelligence: 50, work_ethic: 50, durability: 50,
      consistency: 50, composure: 50, leadership: 50,
    }
  );

  const [saved, setSaved] = useState(false);

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Panel>
          <p className="font-mono text-cream-dim">Player not found.</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Back</Button>
        </Panel>
      </div>
    );
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

  function handleSave() {
    if (!player) return;
    updatePlayer(playerId!, {
      firstName: firstName.trim() || player.firstName,
      lastName: lastName.trim() || player.lastName,
      number,
      age,
      position,
      bats,
      throws,
      batting,
      pitching,
      fielding: [{ ...fielding, position }],
      mental,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass = cn(
    'w-full bg-navy border border-navy-lighter rounded-md px-3 py-2',
    'text-cream font-body text-sm focus:outline-none focus:border-gold/60',
    'placeholder:text-cream-dim/40 transition-colors'
  );

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            Edit Player
          </h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            #{player.number} {player.firstName} {player.lastName} · {player.position}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={handleSave}
            className={saved ? '!bg-green-600' : ''}
          >
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Identity */}
          <Panel title="Identity">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">First Name</label>
                  <input className={inputClass} value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">Last Name</label>
                  <input className={inputClass} value={lastName} onChange={e => setLastName(e.target.value)} />
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
              {/* Position */}
              <div>
                <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1.5">Position</label>
                <div className="grid grid-cols-5 gap-1">
                  {POSITIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPosition(p.value)}
                      className={cn(
                        'py-1.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                        position === p.value
                          ? 'bg-gold text-navy font-bold'
                          : 'bg-navy border border-navy-lighter text-cream-dim hover:text-cream hover:border-gold/40'
                      )}
                    >
                      {p.value}
                    </button>
                  ))}
                </div>
              </div>
              {/* Bats / Throws */}
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

          {/* Batting */}
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

        {/* Right column */}
        <div className="space-y-4">
          {/* Pitching */}
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

          {/* Fielding */}
          <Panel title="Fielding">
            <div className="space-y-3">
              <RatingSlider label="Range" value={fielding.range} onChange={fld('range')} />
              <RatingSlider label="Arm Strength" value={fielding.arm_strength} onChange={fld('arm_strength')} />
              <RatingSlider label="Arm Accuracy" value={fielding.arm_accuracy} onChange={fld('arm_accuracy')} />
              <RatingSlider label="Turn DP" value={fielding.turn_dp} onChange={fld('turn_dp')} />
              <RatingSlider label="Error Rate (low=good)" value={fielding.error_rate} onChange={fld('error_rate')} />
            </div>
          </Panel>

          {/* Mental */}
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

      {/* Save footer */}
      <div className="mt-6 flex justify-end gap-3 pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} className={saved ? '!bg-green-600' : ''}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
