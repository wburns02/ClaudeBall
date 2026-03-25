import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import { createSettings, PRESETS, CHARACTER_ARCHETYPES } from '@/dynasty/DynastySettings.ts';
import type { DynastyPreset, CharacterCreation, DynastySettings, PlayerBackground } from '@/dynasty/DynastySettings.ts';
import type { DynastyMode } from '@/dynasty/ecs/types.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { TEAMS as ALL_TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';

type SetupStep = 'mode' | 'character' | 'attributes' | 'settings' | 'draft' | 'team';

interface PlayerAttributes {
  contact: number;
  power: number;
  speed: number;
  fielding: number;
  arm: number;
  eye: number;
  // Pitchers
  stuff: number;
  control: number;
  stamina: number;
  velocity: number;
}

const DEFAULT_ATTRS: PlayerAttributes = {
  contact: 50, power: 45, speed: 55, fielding: 50, arm: 50, eye: 50,
  stuff: 40, control: 40, stamina: 40, velocity: 88,
};

// Total attribute points budget — forces trade-offs
const MAX_POINTS = 350;
const PITCHER_MAX_POINTS = 320;

// Draft simulation based on background + attributes
interface DraftResult {
  round: number;
  pick: number;
  teamId: string;
  teamName: string;
  teamCity: string;
  description: string;
}

function simulateDraft(background: PlayerBackground, attrs: PlayerAttributes, isPitcher: boolean): DraftResult {
  const total = isPitcher
    ? attrs.stuff + attrs.control + attrs.stamina + Math.round(attrs.velocity / 2) + attrs.fielding
    : attrs.contact + attrs.power + attrs.speed + attrs.fielding + attrs.arm + attrs.eye;

  let baseRound = 5;
  switch (background) {
    case 'college_star': baseRound = 1; break;
    case 'late_round': baseRound = 6; break;
    case 'undrafted': baseRound = 15; break; // UDFA tryout
    case 'international': baseRound = 0; break; // International signing
  }

  // Better attributes → earlier pick
  const attrBonus = Math.floor((total - 250) / 30);
  const round = Math.max(1, Math.min(20, baseRound - attrBonus));
  const pick = Math.floor(Math.random() * 30) + 1;

  // Pick a random team
  const teamIdx = Math.floor(Math.random() * ALL_TEAMS.length);
  const team = ALL_TEAMS[teamIdx];

  const descriptions: Record<PlayerBackground, string> = {
    college_star: round === 1
      ? `With the ${pick}${pick === 1 ? 'st' : pick === 2 ? 'nd' : pick === 3 ? 'rd' : 'th'} pick in the first round, the ${team.city} ${team.name} select you!`
      : `The ${team.city} ${team.name} select you in round ${round}, pick ${pick}. Not the first round — you've got something to prove.`,
    late_round: `Round ${round}, pick ${pick}. The ${team.city} ${team.name} take a flyer on you. Most people have never heard your name. Time to change that.`,
    undrafted: `Nobody drafted you. But the ${team.city} ${team.name} invite you to spring training as a non-roster invitee. This is your shot — make it count.`,
    international: `The ${team.city} ${team.name} sign you out of the international free agent pool. Welcome to America. Welcome to professional baseball.`,
  };

  return {
    round,
    pick,
    teamId: team.id,
    teamName: team.name,
    teamCity: team.city,
    description: descriptions[background],
  };
}

function AttributeSlider({ label, value, onChange, min = 20, max = 80, color = 'gold' }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; color?: string;
}) {
  const grade = value >= 70 ? 'A' : value >= 60 ? 'B' : value >= 50 ? 'C' : value >= 40 ? 'D' : 'F';
  const gradeColor = value >= 70 ? 'text-gold' : value >= 60 ? 'text-green-light' : value >= 50 ? 'text-cream' : value >= 40 ? 'text-orange-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-cream-dim w-20 shrink-0 uppercase tracking-wider">{label}</span>
      <div className="flex-1 relative">
        <div className="h-2 rounded-full bg-navy-lighter overflow-hidden">
          <div className="h-full rounded-full bg-gold/60 transition-all" style={{ width: `${((value - min) / (max - min)) * 100}%` }} />
        </div>
        <input
          type="range" min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="font-mono text-sm text-cream w-8 text-right">{value}</span>
      <span className={cn('font-mono text-xs w-4 font-bold', gradeColor)}>{grade}</span>
    </div>
  );
}

function VelocitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label = value >= 97 ? 'Elite' : value >= 94 ? 'Plus' : value >= 91 ? 'Avg' : value >= 87 ? 'Below' : 'Soft';
  const color = value >= 97 ? 'text-gold' : value >= 94 ? 'text-green-light' : value >= 91 ? 'text-cream' : 'text-orange-400';
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-cream-dim w-20 shrink-0 uppercase tracking-wider">Velocity</span>
      <div className="flex-1 relative">
        <div className="h-2 rounded-full bg-navy-lighter overflow-hidden">
          <div className="h-full rounded-full bg-red-400/60 transition-all" style={{ width: `${((value - 78) / (102 - 78)) * 100}%` }} />
        </div>
        <input
          type="range" min={78} max={102} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="font-mono text-sm text-cream w-12 text-right">{value} mph</span>
      <span className={cn('font-mono text-xs w-10 font-bold', color)}>{label}</span>
    </div>
  );
}

export function DynastySetupPage() {
  const navigate = useNavigate();
  const { startFranchise } = useFranchiseStore();
  const [step, setStep] = useState<SetupStep>('mode');
  const [mode, setMode] = useState<DynastyMode>('classic');
  const [preset, setPreset] = useState<DynastyPreset>('realistic');
  const [settings, setSettings] = useState<DynastySettings>(createSettings('classic'));
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<PlayerAttributes>({ ...DEFAULT_ATTRS });
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);

  const [character, setCharacter] = useState<CharacterCreation>({
    name: '', background: 'college_star', archetypes: [], position: 'SS',
  });

  const isPitcher = character.position === 'P';
  const totalPoints = useMemo(() => {
    if (isPitcher) return attrs.stuff + attrs.control + attrs.stamina + Math.round(attrs.velocity / 2) + attrs.fielding;
    return attrs.contact + attrs.power + attrs.speed + attrs.fielding + attrs.arm + attrs.eye;
  }, [attrs, isPitcher]);
  const pointsMax = isPitcher ? PITCHER_MAX_POINTS : MAX_POINTS;
  const pointsRemaining = pointsMax - totalPoints;
  const isOverBudget = pointsRemaining < 0;

  const handleModeSelect = (m: DynastyMode) => {
    setMode(m);
    setSettings(createSettings(m, preset));
    setStep(m === 'living' ? 'character' : 'settings');
  };

  const handlePresetSelect = (p: DynastyPreset) => {
    setPreset(p);
    setSettings(createSettings(mode, p));
  };

  const handleArchetypeToggle = (id: string) => {
    setCharacter(prev => {
      const archs = prev.archetypes.includes(id)
        ? prev.archetypes.filter(a => a !== id)
        : prev.archetypes.length < 3 ? [...prev.archetypes, id] : prev.archetypes;
      return { ...prev, archetypes: archs };
    });
  };

  const handleAttr = (key: keyof PlayerAttributes, val: number) => {
    setAttrs(prev => ({ ...prev, [key]: val }));
  };

  const handleRunDraft = () => {
    const result = simulateDraft(character.background, attrs, isPitcher);
    setDraftResult(result);
    setSelectedTeamId(result.teamId);
  };

  const handleStart = () => {
    const teamId = selectedTeamId;
    if (!teamId) return;
    startFranchise(ALL_TEAMS as any, LEAGUE_STRUCTURE, teamId);
    localStorage.setItem('claudeball_dynasty_settings', JSON.stringify(settings));
    localStorage.setItem('claudeball_dynasty_mode', mode);
    if (mode === 'living') {
      localStorage.setItem('claudeball_dynasty_character', JSON.stringify(character));
      localStorage.setItem('claudeball_dynasty_attrs', JSON.stringify(attrs));
    }
    navigate('/franchise');
  };

  const allSteps: SetupStep[] = mode === 'living'
    ? ['mode', 'character', 'attributes', 'settings', 'draft']
    : ['mode', 'settings', 'team'];

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl text-gold tracking-wide uppercase">New Dynasty</h1>
        <p className="font-mono text-cream-dim text-sm mt-2">
          {step === 'mode' && 'Choose your experience'}
          {step === 'character' && 'Create your player'}
          {step === 'attributes' && 'Set your abilities'}
          {step === 'settings' && 'Configure your league'}
          {step === 'draft' && 'Draft Day'}
          {step === 'team' && 'Choose your team'}
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          {allSteps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-0.5 bg-navy-lighter" />}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs border',
                step === s ? 'border-gold bg-gold/20 text-gold' :
                  allSteps.indexOf(step) > allSteps.indexOf(s) ? 'border-green-light/50 bg-green-light/10 text-green-light'
                  : 'border-navy-lighter text-cream-dim/40'
              )}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step: Mode Selection */}
      {step === 'mode' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => handleModeSelect('classic')}
            className="text-left rounded-xl border-2 border-gold/30 bg-navy-lighter/30 p-6 hover:border-gold/60 hover:bg-navy-lighter/50 transition-all cursor-pointer">
            <div className="font-display text-2xl text-gold uppercase tracking-wide mb-2">Classic Dynasty</div>
            <div className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-3">Start as GM</div>
            <p className="text-cream-dim text-sm leading-relaxed">Traditional franchise management. Build through trades, draft, and free agency.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Franchise Mgmt', 'Hot Stove', 'AI Conversations', 'Team Chemistry'].map(tag => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold/10 text-gold/70 border border-gold/20">{tag}</span>
              ))}
            </div>
          </button>
          <button onClick={() => handleModeSelect('living')}
            className="text-left rounded-xl border-2 border-neon-green/30 bg-navy-lighter/30 p-6 hover:border-neon-green/60 hover:bg-navy-lighter/50 transition-all cursor-pointer">
            <div className="font-display text-2xl text-neon-green uppercase tracking-wide mb-2">Living Dynasty</div>
            <div className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-3">Start as Player → Work Your Way Up</div>
            <p className="text-cream-dim text-sm leading-relaxed">Full RPG career. Create a player, get drafted, build relationships, work your way to GM.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Full RPG', 'Draft Day', 'Career Pipeline', 'Life Events', 'AI Voice Calls'].map(tag => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neon-green/10 text-neon-green/70 border border-neon-green/20">{tag}</span>
              ))}
            </div>
          </button>
        </div>
      )}

      {/* Step: Character Creation */}
      {step === 'character' && (
        <div className="space-y-6">
          <Panel title="Your Player">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs text-cream-dim uppercase tracking-wider block mb-1">Name</label>
                <input type="text" value={character.name}
                  onChange={e => setCharacter(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-navy-lighter/50 border border-navy-lighter rounded-md px-3 py-2 text-cream font-mono text-sm focus:border-gold/50 outline-none"
                  placeholder="Enter player name..." />
              </div>
              <div>
                <label className="font-mono text-xs text-cream-dim uppercase tracking-wider block mb-1">Position</label>
                <select value={character.position}
                  onChange={e => setCharacter(prev => ({ ...prev, position: e.target.value }))}
                  className="w-full bg-navy-lighter/50 border border-navy-lighter rounded-md px-3 py-2 text-cream font-mono text-sm focus:border-gold/50 outline-none">
                  {['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>

          <Panel title="Background">
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'college_star', label: 'College Star', desc: 'Top prospect — expected 1st round pick' },
                { id: 'late_round', label: 'Late-Round Pick', desc: 'Chip on your shoulder — rounds 3-10' },
                { id: 'undrafted', label: 'Undrafted Free Agent', desc: 'Nobody drafted you — earn a tryout' },
                { id: 'international', label: 'International Signee', desc: 'Global talent — signed out of intl pool' },
              ] as { id: PlayerBackground; label: string; desc: string }[]).map(bg => (
                <button key={bg.id} onClick={() => setCharacter(prev => ({ ...prev, background: bg.id }))}
                  className={cn('text-left rounded-lg border p-3 transition-all cursor-pointer',
                    character.background === bg.id ? 'border-gold bg-gold/10' : 'border-navy-lighter hover:border-gold/30')}>
                  <div className="font-mono text-sm text-cream">{bg.label}</div>
                  <div className="font-mono text-xs text-cream-dim/60 mt-0.5">{bg.desc}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={`Personality (Pick 3) — ${character.archetypes.length}/3 selected`}>
            <div className="grid grid-cols-2 gap-2">
              {CHARACTER_ARCHETYPES.map(arch => {
                const selected = character.archetypes.includes(arch.id);
                const disabled = !selected && character.archetypes.length >= 3;
                return (
                  <button key={arch.id} onClick={() => !disabled && handleArchetypeToggle(arch.id)}
                    className={cn('text-left rounded-lg border px-3 py-2 transition-all',
                      selected ? 'border-gold bg-gold/15 text-gold' :
                      disabled ? 'border-navy-lighter/30 text-cream-dim/30 cursor-not-allowed' :
                      'border-navy-lighter hover:border-gold/30 text-cream cursor-pointer')}>
                    <span className="font-mono text-sm">{arch.label}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('mode')}>Back</Button>
            <Button onClick={() => setStep('attributes')} disabled={!character.name || character.archetypes.length !== 3}>
              Next: Set Attributes
            </Button>
          </div>
        </div>
      )}

      {/* Step: Attributes */}
      {step === 'attributes' && (
        <div className="space-y-6">
          <Panel title={isPitcher ? 'Pitching Attributes' : 'Hitting Attributes'}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs text-cream-dim/50">Distribute your ability points</span>
              <span className={cn('font-mono text-sm font-bold', isOverBudget ? 'text-red-400' : pointsRemaining < 20 ? 'text-gold' : 'text-green-light')}>
                {pointsRemaining} pts remaining
              </span>
            </div>

            <div className="space-y-3">
              {isPitcher ? (
                <>
                  <AttributeSlider label="Stuff" value={attrs.stuff} onChange={v => handleAttr('stuff', v)} />
                  <AttributeSlider label="Control" value={attrs.control} onChange={v => handleAttr('control', v)} />
                  <AttributeSlider label="Stamina" value={attrs.stamina} onChange={v => handleAttr('stamina', v)} />
                  <VelocitySlider value={attrs.velocity} onChange={v => handleAttr('velocity', v)} />
                  <AttributeSlider label="Fielding" value={attrs.fielding} onChange={v => handleAttr('fielding', v)} />
                </>
              ) : (
                <>
                  <AttributeSlider label="Contact" value={attrs.contact} onChange={v => handleAttr('contact', v)} />
                  <AttributeSlider label="Power" value={attrs.power} onChange={v => handleAttr('power', v)} />
                  <AttributeSlider label="Speed" value={attrs.speed} onChange={v => handleAttr('speed', v)} />
                  <AttributeSlider label="Fielding" value={attrs.fielding} onChange={v => handleAttr('fielding', v)} />
                  <AttributeSlider label="Arm" value={attrs.arm} onChange={v => handleAttr('arm', v)} />
                  <AttributeSlider label="Eye" value={attrs.eye} onChange={v => handleAttr('eye', v)} />
                </>
              )}
            </div>

            {isOverBudget && (
              <div className="mt-3 font-mono text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded px-3 py-2">
                Over budget by {Math.abs(pointsRemaining)} points — lower some attributes
              </div>
            )}
          </Panel>

          <Panel title="Scouting Report Preview">
            <div className="grid grid-cols-3 gap-3 text-center font-mono">
              {(isPitcher ? [
                { label: 'Stuff', val: attrs.stuff }, { label: 'Control', val: attrs.control },
                { label: 'Stamina', val: attrs.stamina }, { label: 'Velocity', val: attrs.velocity },
                { label: 'Fielding', val: attrs.fielding },
              ] : [
                { label: 'Contact', val: attrs.contact }, { label: 'Power', val: attrs.power },
                { label: 'Speed', val: attrs.speed }, { label: 'Fielding', val: attrs.fielding },
                { label: 'Arm', val: attrs.arm }, { label: 'Eye', val: attrs.eye },
              ]).map(attr => (
                <div key={attr.label} className="bg-navy-lighter/30 rounded p-2">
                  <div className="text-[10px] text-cream-dim/50 uppercase">{attr.label}</div>
                  <div className={cn('text-lg font-bold',
                    attr.val >= 70 ? 'text-gold' : attr.val >= 60 ? 'text-green-light' : attr.val >= 50 ? 'text-cream' : 'text-orange-400'
                  )}>{attr.val}</div>
                </div>
              ))}
              <div className="bg-navy-lighter/30 rounded p-2">
                <div className="text-[10px] text-cream-dim/50 uppercase">Overall</div>
                <div className="text-lg font-bold text-gold">{Math.round(totalPoints / (isPitcher ? 5 : 6))}</div>
              </div>
            </div>
          </Panel>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('character')}>Back</Button>
            <Button onClick={() => setStep('settings')} disabled={isOverBudget}>
              Next: League Settings
            </Button>
          </div>
        </div>
      )}

      {/* Step: League Settings */}
      {step === 'settings' && (
        <div className="space-y-6">
          <Panel title="Preset">
            <div className="grid grid-cols-4 gap-3">
              {(['casual', 'realistic', 'hardcore', 'sandbox'] as DynastyPreset[]).map(p => (
                <button key={p} onClick={() => handlePresetSelect(p)}
                  className={cn('rounded-lg border p-3 text-center transition-all cursor-pointer',
                    preset === p ? 'border-gold bg-gold/15' : 'border-navy-lighter hover:border-gold/30')}>
                  <div className="font-mono text-sm text-cream capitalize">{p}</div>
                  <div className="font-mono text-[10px] text-cream-dim/50 mt-1">
                    {p === 'casual' && '56 games'}
                    {p === 'realistic' && '162 games'}
                    {p === 'hardcore' && '162 games · Brutal'}
                    {p === 'sandbox' && 'Custom'}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Key Settings">
            <div className="space-y-3 font-mono text-sm">
              {[
                ['Season Length', `${settings.seasonLength} games`],
                ['Teams', `${settings.teamCount}`],
                ['Salary System', settings.salarySystem.replace('_', ' ')],
                ['Trade AI', settings.tradeAIDifficulty],
                ['Injuries', settings.injuryFrequency],
                ['Bust Rate', `${settings.prospectBustRate}%`],
                ['Owner Patience', settings.ownerPatience.replace('_', ' ')],
                ['Fire Risk', settings.fireRisk ? 'ON' : 'OFF'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-cream-dim">{label}</span>
                  <span className={cn('capitalize', label === 'Fire Risk' ? (value === 'ON' ? 'text-red-400 font-bold' : 'text-green-light font-bold') : 'text-gold')}>{value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(mode === 'living' ? 'attributes' : 'mode')}>Back</Button>
            <Button onClick={() => { if (mode === 'living') { handleRunDraft(); setStep('draft'); } else { setStep('team'); } }}>
              {mode === 'living' ? 'Next: Draft Day' : 'Next: Choose Team'}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Draft Day (Living Dynasty) */}
      {step === 'draft' && draftResult && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="font-mono text-xs text-cream-dim/40 uppercase tracking-widest mb-4">
              {character.background === 'undrafted' ? 'Spring Training Invite' :
               character.background === 'international' ? 'International Signing' : 'Draft Day'}
            </div>

            {character.background !== 'undrafted' && character.background !== 'international' && (
              <div className="font-display text-6xl text-gold mb-2">
                Round {draftResult.round}, Pick {draftResult.pick}
              </div>
            )}

            <div className="font-display text-3xl text-cream uppercase tracking-wide mb-6">
              {draftResult.teamCity} {draftResult.teamName}
            </div>

            <div className="max-w-lg mx-auto">
              <Panel>
                <p className="text-cream text-sm leading-relaxed text-center italic">
                  "{draftResult.description}"
                </p>
              </Panel>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <Button variant="secondary" onClick={() => { handleRunDraft(); }}>
                Re-roll Draft
              </Button>
              <Button onClick={handleStart} className="bg-gradient-to-r from-gold/80 to-gold border-gold">
                Accept & Begin Career
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Team Selection (Classic Dynasty) */}
      {step === 'team' && (
        <div className="space-y-6">
          <Panel title="Select Your Team">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {ALL_TEAMS.map(team => (
                <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
                  className={cn('text-left rounded-lg border px-3 py-2 transition-all cursor-pointer',
                    selectedTeamId === team.id ? 'border-gold bg-gold/15' : 'border-navy-lighter hover:border-gold/30')}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.primaryColor }} />
                    <div>
                      <div className="font-mono text-sm text-cream">{team.city} {team.name}</div>
                      <div className="font-mono text-[10px] text-cream-dim/50">{team.abbreviation}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('settings')}>Back</Button>
            <Button onClick={handleStart} disabled={!selectedTeamId} className="bg-gradient-to-r from-gold/80 to-gold border-gold">
              Start Classic Dynasty
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
