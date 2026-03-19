import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { ARCHETYPE_TEMPLATES } from '@/engine/player/PlayerGenerator.ts';
import type { Archetype } from '@/engine/player/PlayerGenerator.ts';
import type { Position, Hand } from '@/engine/types/enums.ts';
import { useCareerStore } from '@/stores/careerStore.ts';
import { cn } from '@/lib/cn.ts';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'P',  label: 'Pitcher'       },
  { value: 'C',  label: 'Catcher'       },
  { value: '1B', label: '1st Base'      },
  { value: '2B', label: '2nd Base'      },
  { value: '3B', label: '3rd Base'      },
  { value: 'SS', label: 'Shortstop'     },
  { value: 'LF', label: 'Left Field'    },
  { value: 'CF', label: 'Center Field'  },
  { value: 'RF', label: 'Right Field'   },
  { value: 'DH', label: 'DH'            },
];

type BatThrow = { label: string; value: Hand };
const HANDS: BatThrow[] = [
  { label: 'Left',   value: 'L' },
  { label: 'Right',  value: 'R' },
  { label: 'Switch', value: 'S' },
];

const THROW_HANDS: BatThrow[] = [
  { label: 'Left',  value: 'L' },
  { label: 'Right', value: 'R' },
];

interface RatingBarProps { label: string; value: number; color?: string }
function RatingBar({ label, value, color = '#d4a843' }: RatingBarProps) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-cream-dim uppercase tracking-wide">{label}</span>
        <span className="text-cream">{value}</span>
      </div>
      <div className="h-1.5 bg-navy rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface ArchetypeCardProps {
  template: typeof ARCHETYPE_TEMPLATES[number];
  selected: boolean;
  onSelect: () => void;
}
function ArchetypeCard({ template: t, selected, onSelect }: ArchetypeCardProps) {
  const isPitcher = t.archetype === 'Ace Pitcher' || t.archetype === 'Closer';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'text-left p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer w-full',
        'hover:scale-[1.02] active:scale-[0.99]',
        selected
          ? 'shadow-lg scale-[1.02]'
          : 'border-navy-lighter bg-navy-light/60 hover:border-navy-lighter/80',
      )}
      style={selected ? {
        borderColor: t.color,
        backgroundColor: `${t.color}18`,
        boxShadow: `0 0 16px ${t.color}44`,
      } : {}}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: t.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm tracking-wide uppercase" style={{ color: selected ? t.color : '#e8e0d4' }}>
            {t.archetype}
          </div>
          <p className="text-cream-dim/70 text-xs mt-1 leading-relaxed">{t.description}</p>

          {/* Mini rating preview */}
          <div className="mt-3 space-y-1.5">
            {isPitcher ? (
              <>
                <RatingBar label="Stuff"    value={t.pitching.stuff}    color={t.color} />
                <RatingBar label="Control"  value={t.pitching.control}  color={t.color} />
                <RatingBar label="Movement" value={t.pitching.movement} color={t.color} />
                <RatingBar label="Velo"
                  value={Math.round((t.pitching.velocity - 78) / 24 * 100)}
                  color={t.color}
                />
              </>
            ) : (
              <>
                <RatingBar label="Contact" value={(t.batting.contact_L + t.batting.contact_R) >> 1} color={t.color} />
                <RatingBar label="Power"   value={(t.batting.power_L + t.batting.power_R) >> 1}   color={t.color} />
                <RatingBar label="Eye"     value={t.batting.eye}     color={t.color} />
                <RatingBar label="Speed"   value={t.batting.speed}   color={t.color} />
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export function CreatePlayerPage() {
  const navigate = useNavigate();
  const createPlayer = useCareerStore(s => s.createPlayer);

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [position,  setPosition]  = useState<Position>('CF');
  const [bats,      setBats]      = useState<Hand>('R');
  const [throws,    setThrows]    = useState<Hand>('R');
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [error,     setError]     = useState('');

  const canStart = firstName.trim() && lastName.trim() && archetype !== null;

  function handleBeginCareer() {
    if (!canStart) { setError('Fill out all fields and choose an archetype.'); return; }
    createPlayer({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      position,
      bats,
      throws,
      archetype: archetype!,
      age: 21,
    });
    navigate('/career');
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <p className="font-mono text-gold-dim text-xs tracking-widest uppercase">Sprint 6</p>
          <h1 className="font-display text-5xl text-gold tracking-tight uppercase">
            Be A Player
          </h1>
          <p className="font-mono text-cream-dim text-sm">Create your ballplayer and start your climb to the Majors</p>
          <div className="w-24 h-0.5 bg-gold/30 mx-auto mt-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Identity */}
          <div className="space-y-4">
            <Panel title="Player Identity">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="First"
                      className={cn(
                        'w-full bg-navy border border-navy-lighter rounded-md px-3 py-2',
                        'text-cream font-body text-sm focus:outline-none focus:border-gold/60',
                        'placeholder:text-cream-dim/40 transition-colors'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Last"
                      className={cn(
                        'w-full bg-navy border border-navy-lighter rounded-md px-3 py-2',
                        'text-cream font-body text-sm focus:outline-none focus:border-gold/60',
                        'placeholder:text-cream-dim/40 transition-colors'
                      )}
                    />
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-2">
                    Position
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {POSITIONS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => setPosition(p.value)}
                        className={cn(
                          'py-1.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                          position === p.value
                            ? 'bg-gold text-navy font-bold shadow-md'
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
                    <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-2">
                      Bats
                    </label>
                    <div className="flex gap-1.5">
                      {HANDS.map(h => (
                        <button
                          key={h.value}
                          onClick={() => setBats(h.value)}
                          className={cn(
                            'flex-1 py-1.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                            bats === h.value
                              ? 'bg-gold text-navy font-bold'
                              : 'bg-navy border border-navy-lighter text-cream-dim hover:text-cream hover:border-gold/40'
                          )}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-2">
                      Throws
                    </label>
                    <div className="flex gap-1.5">
                      {THROW_HANDS.map(h => (
                        <button
                          key={h.value}
                          onClick={() => setThrows(h.value)}
                          className={cn(
                            'flex-1 py-1.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                            throws === h.value
                              ? 'bg-gold text-navy font-bold'
                              : 'bg-navy border border-navy-lighter text-cream-dim hover:text-cream hover:border-gold/40'
                          )}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {(firstName || lastName) && (
                  <div className="mt-2 p-3 rounded bg-navy/60 border border-gold/20">
                    <p className="font-display text-xl text-gold tracking-wide">
                      {[firstName, lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-cream-dim text-xs font-mono mt-0.5">
                      {position} · Bats {bats} / Throws {throws}
                      {archetype ? ` · ${archetype}` : ''}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Right: Archetype selector */}
          <div>
            <Panel title="Choose Archetype">
              <div className="grid grid-cols-1 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
                {ARCHETYPE_TEMPLATES.map(t => (
                  <ArchetypeCard
                    key={t.archetype}
                    template={t}
                    selected={archetype === t.archetype}
                    onSelect={() => { setArchetype(t.archetype); setError(''); }}
                  />
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* Begin Career */}
        <div className="text-center space-y-2 pb-8">
          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}
          {/* Checklist shows what's still required */}
          {!canStart && (
            <div className="flex items-center justify-center gap-4 text-xs font-mono mb-1">
              <span className={firstName.trim() && lastName.trim() ? 'text-green-light' : 'text-cream-dim/40'}>
                {firstName.trim() && lastName.trim() ? '✓' : '○'} Name
              </span>
              <span className={archetype !== null ? 'text-green-light' : 'text-gold'}>
                {archetype !== null ? '✓' : '● Select archetype below'}
              </span>
            </div>
          )}
          <Button
            size="lg"
            className="w-72"
            disabled={!canStart}
            onClick={handleBeginCareer}
            data-testid="begin-career-btn"
          >
            Begin Career ⚾
          </Button>
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              ← Back to Menu
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
