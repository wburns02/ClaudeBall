import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import { createSettings, PRESETS, CHARACTER_ARCHETYPES } from '@/dynasty/DynastySettings.ts';
import type { DynastyPreset, CharacterCreation, DynastySettings, PlayerBackground, AttrBonus } from '@/dynasty/DynastySettings.ts';
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
  contact: 45, power: 40, speed: 50, fielding: 45, arm: 45, eye: 45,
  stuff: 35, control: 35, stamina: 35, velocity: 88,
};

const DEFAULT_POTENTIAL: PlayerAttributes = {
  contact: 65, power: 60, speed: 65, fielding: 60, arm: 60, eye: 60,
  stuff: 55, control: 55, stamina: 55, velocity: 95,
};

// Two pools: Current points + Potential points
// Background determines the split
const BASE_CURRENT_POINTS = 300;
const BASE_POTENTIAL_POINTS = 400;

/**
 * Background config — the ITP-style split:
 * High School: low current (raw), high potential (ceiling)
 * College: higher current (polished), lower potential (closer to peak)
 */
const BACKGROUND_CONFIG: Record<PlayerBackground, {
  age: number;
  currentPoints: number;  // Points for RIGHT NOW ratings
  potentialPoints: number; // Points for CEILING ratings
  description: string;
}> = {
  high_school: { age: 18, currentPoints: 250, potentialPoints: 450, description: 'Raw but unlimited ceiling' },
  international: { age: 20, currentPoints: 280, potentialPoints: 420, description: 'Young with high upside' },
  college_star: { age: 22, currentPoints: 320, potentialPoints: 380, description: 'Polished, ready to contribute' },
  late_round: { age: 23, currentPoints: 300, potentialPoints: 340, description: 'Less talent, prove-it mentality' },
  undrafted: { age: 24, currentPoints: 280, potentialPoints: 300, description: 'Lowest ceiling, ultimate grinder' },
};

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
    case 'high_school': baseRound = 1; break;
    case 'college_star': baseRound = 1; break;
    case 'late_round': baseRound = 6; break;
    case 'undrafted': baseRound = 15; break; // UDFA tryout
    case 'international': baseRound = 0; break; // International signing
  }

  // Better attributes -> earlier pick
  const attrBonus = Math.floor((total - 250) / 30);
  const round = Math.max(1, Math.min(20, baseRound - attrBonus));
  const pick = Math.floor(Math.random() * 30) + 1;

  // Pick a random team
  const teamIdx = Math.floor(Math.random() * ALL_TEAMS.length);
  const team = ALL_TEAMS[teamIdx];

  const descriptions: Record<PlayerBackground, string> = {
    high_school: round <= 2
      ? `With the ${ordinal(pick)} pick in round ${round}, the ${team.city} ${team.name} select you straight out of high school! The youngest pick in the draft — the sky's the limit.`
      : `The ${team.city} ${team.name} take a gamble on you in round ${round}, pick ${pick}. Straight from prom to the pros — raw talent with everything to prove.`,
    college_star: round === 1
      ? `With the ${ordinal(pick)} pick in the first round, the ${team.city} ${team.name} select you!`
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

// Helper: ordinal suffix for numbers (1st, 2nd, 3rd, 11th, 12th, 13th, 21st, etc.)
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Helper: format a camelCase trait name for display
function formatTraitName(trait: string): string {
  return trait
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

// +/- button attribute control
function AttributeControl({ label, value, onChange, min = 20, max = 80, pointsRemaining, disabled, isMaxedOut }: {
  label: string; value: number; onChange: (v: number, delta: number) => void;
  min?: number; max?: number; pointsRemaining: number; disabled?: boolean; isMaxedOut?: boolean;
}) {
  const grade = value >= 70 ? 'A' : value >= 60 ? 'B' : value >= 50 ? 'C' : value >= 40 ? 'D' : 'F';
  const gradeColor = value >= 70 ? 'text-gold' : value >= 60 ? 'text-green-light' : value >= 50 ? 'text-cream' : value >= 40 ? 'text-orange-400' : 'text-red-400';
  const canDecrease = value > min && !disabled;
  const canIncrease = value < max && pointsRemaining > 0 && !disabled;

  return (
    <div className={cn('flex items-center gap-2 py-1.5', isMaxedOut && 'bg-gold/5 rounded-md px-1 -mx-1')}>
      <span className="font-mono text-xs text-cream-dim w-20 shrink-0 uppercase tracking-wider">{label}</span>
      <button
        onClick={(e) => {
          const delta = e.shiftKey ? 5 : 1;
          const clamped = Math.max(min, value - delta);
          if (canDecrease) onChange(clamped, -(value - clamped));
        }}
        disabled={!canDecrease}
        className={cn(
          'w-8 h-8 rounded-md font-mono text-sm font-bold flex items-center justify-center border transition-all',
          canDecrease
            ? 'border-cream-dim/30 text-cream hover:bg-navy-lighter hover:border-gold/50 cursor-pointer'
            : 'border-navy-lighter/30 text-cream-dim/20 cursor-not-allowed'
        )}
      >
        -
      </button>
      <span className="font-mono text-lg text-cream w-10 text-center font-bold">{value}</span>
      <button
        onClick={(e) => {
          const delta = e.shiftKey ? 5 : 1;
          const maxByPoints = value + Math.min(delta, pointsRemaining);
          const clamped = Math.min(max, maxByPoints);
          if (canIncrease) onChange(clamped, clamped - value);
        }}
        disabled={!canIncrease}
        className={cn(
          'w-8 h-8 rounded-md font-mono text-sm font-bold flex items-center justify-center border transition-all',
          canIncrease
            ? 'border-cream-dim/30 text-cream hover:bg-navy-lighter hover:border-gold/50 cursor-pointer'
            : 'border-navy-lighter/30 text-cream-dim/20 cursor-not-allowed'
        )}
      >
        +
      </button>
      <span className="font-mono text-[10px] text-cream-dim/40 w-8 text-center">{isMaxedOut ? 'MAX' : '1/5'}</span>
      <span className={cn('font-mono text-xs w-4 font-bold', gradeColor)}>{grade}</span>
    </div>
  );
}

function VelocityControl({ value, onChange, pointsRemaining, disabled, min = 78, max = 102, isMaxedOut }: {
  value: number; onChange: (v: number, delta: number) => void; pointsRemaining: number; disabled?: boolean;
  min?: number; max?: number; isMaxedOut?: boolean;
}) {
  const label = value >= 97 ? 'Elite' : value >= 94 ? 'Plus' : value >= 91 ? 'Avg' : value >= 87 ? 'Below' : 'Soft';
  const color = value >= 97 ? 'text-gold' : value >= 94 ? 'text-green-light' : value >= 91 ? 'text-cream' : 'text-orange-400';
  const canDecrease = value > min && !disabled;
  const canIncrease = value < max && pointsRemaining > 0 && !disabled;

  return (
    <div className={cn('flex items-center gap-2 py-1.5', isMaxedOut && 'bg-gold/5 rounded-md px-1 -mx-1')}>
      <span className="font-mono text-xs text-cream-dim w-20 shrink-0 uppercase tracking-wider">Velocity</span>
      <button
        onClick={(e) => {
          const delta = e.shiftKey ? 5 : 1;
          const clamped = Math.max(min, value - delta);
          if (canDecrease) onChange(clamped, -(value - clamped));
        }}
        disabled={!canDecrease}
        className={cn(
          'w-8 h-8 rounded-md font-mono text-sm font-bold flex items-center justify-center border transition-all',
          canDecrease
            ? 'border-cream-dim/30 text-cream hover:bg-navy-lighter hover:border-gold/50 cursor-pointer'
            : 'border-navy-lighter/30 text-cream-dim/20 cursor-not-allowed'
        )}
      >
        -
      </button>
      <span className="font-mono text-lg text-cream w-14 text-center font-bold">{value} mph</span>
      <button
        onClick={(e) => {
          const delta = e.shiftKey ? 5 : 1;
          const maxByPoints = value + Math.min(delta, pointsRemaining);
          const clamped = Math.min(max, maxByPoints);
          if (canIncrease) onChange(clamped, clamped - value);
        }}
        disabled={!canIncrease}
        className={cn(
          'w-8 h-8 rounded-md font-mono text-sm font-bold flex items-center justify-center border transition-all',
          canIncrease
            ? 'border-cream-dim/30 text-cream hover:bg-navy-lighter hover:border-gold/50 cursor-pointer'
            : 'border-navy-lighter/30 text-cream-dim/20 cursor-not-allowed'
        )}
      >
        +
      </button>
      <span className="font-mono text-[10px] text-cream-dim/40 w-8 text-center">{isMaxedOut ? 'MAX' : '1/5'}</span>
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
  const [potential, setPotential] = useState<PlayerAttributes>({ ...DEFAULT_POTENTIAL });
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);

  const [character, setCharacter] = useState<CharacterCreation>({
    name: '', background: 'college_star', archetypes: [], position: 'SS',
  });

  const isPitcher = character.position === 'P';

  // Compute combined attrBonus from selected archetypes
  const combinedAttrBonus = useMemo(() => {
    const bonus: AttrBonus = {};
    for (const archId of character.archetypes) {
      const arch = CHARACTER_ARCHETYPES.find(a => a.id === archId);
      if (!arch) continue;
      for (const [key, val] of Object.entries(arch.attrBonus)) {
        const k = key as keyof AttrBonus;
        bonus[k] = (bonus[k] || 0) + (val as number);
      }
    }
    return bonus;
  }, [character.archetypes]);

  // Effective max for each attribute (base 80 + archetype bonus, clamped to 20-99)
  const getEffectiveMax = (attr: keyof AttrBonus): number => {
    const bonus = combinedAttrBonus[attr] || 0;
    return Math.max(20, Math.min(99, 80 + bonus));
  };

  // Effective min stays at 20 always (bonus only raises ceiling)
  const getEffectiveMin = (attr: keyof AttrBonus): number => {
    const bonus = combinedAttrBonus[attr] || 0;
    // Negative bonus lowers ceiling, not min
    if (bonus < 0) return 20;
    return 20;
  };

  const bgConfig = BACKGROUND_CONFIG[character.background];

  // Current ratings points
  const currentTotal = useMemo(() => {
    if (isPitcher) return attrs.stuff + attrs.control + attrs.stamina + Math.round(attrs.velocity / 2) + attrs.fielding;
    return attrs.contact + attrs.power + attrs.speed + attrs.fielding + attrs.arm + attrs.eye;
  }, [attrs, isPitcher]);
  const currentMax = bgConfig.currentPoints;
  const currentRemaining = currentMax - currentTotal;

  // Potential ratings points
  const potentialTotal = useMemo(() => {
    if (isPitcher) return potential.stuff + potential.control + potential.stamina + Math.round(potential.velocity / 2) + potential.fielding;
    return potential.contact + potential.power + potential.speed + potential.fielding + potential.arm + potential.eye;
  }, [potential, isPitcher]);
  const potentialMax = bgConfig.potentialPoints;
  const potentialRemaining = potentialMax - potentialTotal;

  const isOverBudget = currentRemaining < 0 || potentialRemaining < 0;

  // Overall = average of current ratings
  const overallCurrent = Math.round(currentTotal / (isPitcher ? 5 : 6));
  const overallPotential = Math.round(potentialTotal / (isPitcher ? 5 : 6));

  const handleModeSelect = (m: DynastyMode) => {
    setMode(m);
    setSettings(createSettings(m, preset));
    setStep(m === 'living' ? 'character' : 'settings');
  };

  const handlePresetSelect = (p: DynastyPreset) => {
    setPreset(p);
    setSettings(createSettings(mode, p));
  };

  // Personality point budget
  const PERSONALITY_BUDGET = 5;
  const usedPoints = character.archetypes.reduce(
    (sum, id) => sum + (CHARACTER_ARCHETYPES.find(a => a.id === id)?.cost ?? 0), 0
  );
  const remainingPoints = PERSONALITY_BUDGET - usedPoints;

  const handleArchetypeToggle = (id: string) => {
    setCharacter(prev => {
      if (prev.archetypes.includes(id)) {
        // Always allow deselection
        return { ...prev, archetypes: prev.archetypes.filter(a => a !== id) };
      }
      // Check budget before adding
      const arch = CHARACTER_ARCHETYPES.find(a => a.id === id);
      if (!arch) return prev;
      const currentUsed = prev.archetypes.reduce(
        (sum, aid) => sum + (CHARACTER_ARCHETYPES.find(a => a.id === aid)?.cost ?? 0), 0
      );
      if (prev.archetypes.length >= 3 || currentUsed + arch.cost > PERSONALITY_BUDGET) return prev;
      return { ...prev, archetypes: [...prev.archetypes, id] };
    });
  };

  const handleBackgroundChange = (bg: PlayerBackground) => {
    setCharacter(prev => ({ ...prev, background: bg }));
    const newConfig = BACKGROUND_CONFIG[bg];
    const hitterKeys: (keyof PlayerAttributes)[] = ['contact', 'power', 'speed', 'fielding', 'arm', 'eye'];
    const pitcherKeys: (keyof PlayerAttributes)[] = ['stuff', 'control', 'stamina', 'fielding'];
    const keys = isPitcher ? pitcherKeys : hitterKeys;

    // Helper: rescale a set of attributes to fit within a budget
    const rescale = (
      source: PlayerAttributes,
      budget: number,
      setter: (fn: (prev: PlayerAttributes) => PlayerAttributes) => void,
    ) => {
      const calcTotal = (a: PlayerAttributes) =>
        keys.reduce((s, k) => s + a[k], 0) + (isPitcher ? Math.round(a.velocity / 2) : 0);
      const total = calcTotal(source);
      if (total <= budget) return;

      const scale = budget / total;
      const scaled = { ...source };
      for (const k of keys) {
        scaled[k] = Math.max(20, Math.floor(source[k] * scale));
      }
      if (isPitcher) {
        scaled.velocity = Math.max(78, Math.floor(source.velocity * scale));
      }
      // Fix rounding: if still over, shave 1 from the highest-value attributes
      let newTotal = calcTotal(scaled);
      let safetyCounter = 0;
      while (newTotal > budget && safetyCounter < 50) {
        // Find the key with the highest value (above 20) to shave from
        let maxKey = keys[0];
        let maxVal = 0;
        for (const k of keys) {
          if (scaled[k] > maxVal && scaled[k] > 20) {
            maxVal = scaled[k];
            maxKey = k;
          }
        }
        scaled[maxKey]--;
        newTotal = calcTotal(scaled);
        safetyCounter++;
      }
      setter(prev => ({ ...prev, ...scaled }));
    };

    rescale(attrs, newConfig.currentPoints, setAttrs);
    rescale(potential, newConfig.potentialPoints, setPotential);
  };

  const handleAttr = (key: keyof PlayerAttributes, val: number) => {
    // Bug fix: Current ratings must never exceed potential ratings
    const cappedVal = Math.min(val, potential[key]);
    setAttrs(prev => ({ ...prev, [key]: cappedVal }));
  };

  const handlePotential = (key: keyof PlayerAttributes, val: number) => {
    setPotential(prev => ({ ...prev, [key]: val }));
    // Bug fix: If potential drops below current, drag current down to match
    setAttrs(prev => {
      if (prev[key] > val) {
        return { ...prev, [key]: val };
      }
      return prev;
    });
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
      localStorage.setItem('claudeball_dynasty_attrs', JSON.stringify({ current: attrs, potential }));
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
              {/* Coming Soon: Childhood stages */}
              <div className="relative text-left rounded-lg border border-navy-lighter/40 p-3 opacity-50 cursor-not-allowed col-span-2 md:col-span-1">
                <div className="absolute top-2 right-2 font-mono text-[9px] uppercase tracking-wider bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-full px-2 py-0.5">
                  Coming Soon
                </div>
                <div className="font-mono text-sm text-cream-dim">Start from Childhood</div>
                <div className="font-mono text-xs text-cream-dim/40 mt-0.5">Little League (age 12) through High School — full childhood gameplay</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="font-mono text-[10px] text-cream-dim/30">Ages 12-18</span>
                  <span className="font-mono text-[10px] text-cream-dim/30">Career Stages System</span>
                </div>
              </div>
              {([
                { id: 'high_school' as PlayerBackground, label: 'High School Phenom', desc: 'Straight out of high school — raw but sky-high potential', age: 18, bonus: '+20 bonus pts' },
                { id: 'international' as PlayerBackground, label: 'International Signee', desc: 'Global talent — signed out of intl pool', age: 20, bonus: '+10 bonus pts' },
                { id: 'college_star' as PlayerBackground, label: 'College Star', desc: 'Top prospect — expected 1st round pick', age: 22, bonus: 'Baseline' },
                { id: 'late_round' as PlayerBackground, label: 'Late-Round Pick', desc: 'Chip on your shoulder — rounds 3-10', age: 23, bonus: '-10 pts (harder)' },
                { id: 'undrafted' as PlayerBackground, label: 'Undrafted Free Agent', desc: 'Nobody drafted you — earn a tryout', age: 24, bonus: '-20 pts (hardest)' },
              ]).map(bg => (
                <button key={bg.id} onClick={() => handleBackgroundChange(bg.id)}
                  className={cn('text-left rounded-lg border p-3 transition-all cursor-pointer',
                    character.background === bg.id ? 'border-gold bg-gold/10' : 'border-navy-lighter hover:border-gold/30')}>
                  <div className="font-mono text-sm text-cream">{bg.label}</div>
                  <div className="font-mono text-xs text-cream-dim/60 mt-0.5">{bg.desc}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-mono text-[10px] text-cream-dim/40">Age {bg.age}</span>
                    {bg.bonus && (
                      <span className="font-mono text-[10px] text-green-light">{bg.bonus}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={`Personality (Pick up to 3) — ${character.archetypes.length}/3 selected`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="font-mono text-xs text-cream-dim/60">Personality Points</span>
              <span className={cn('font-mono text-sm font-bold',
                remainingPoints <= 0 ? 'text-red-400' : remainingPoints <= 2 ? 'text-gold' : 'text-green-light'
              )}>
                {remainingPoints}/{PERSONALITY_BUDGET} remaining
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CHARACTER_ARCHETYPES.map(arch => {
                const selected = character.archetypes.includes(arch.id);
                const disabled = !selected && (character.archetypes.length >= 3 || usedPoints + arch.cost > PERSONALITY_BUDGET);

                // Build pros/cons from traitEffects
                const pros: string[] = [];
                const cons: string[] = [];
                for (const [trait, effect] of Object.entries(arch.traitEffects)) {
                  if (!effect) continue;
                  const name = formatTraitName(trait);
                  if (effect.max !== undefined && effect.max < 50) {
                    cons.push(`${name} ${effect.min}-${effect.max}`);
                  } else {
                    pros.push(`${name} ${effect.min}+`);
                  }
                }

                // Build attr bonus/penalty strings
                const attrPros: string[] = [];
                const attrCons: string[] = [];
                for (const [key, val] of Object.entries(arch.attrBonus)) {
                  const name = key.charAt(0).toUpperCase() + key.slice(1);
                  if ((val as number) > 0) {
                    attrPros.push(`+${val} max ${name}`);
                  } else if ((val as number) < 0) {
                    attrCons.push(`${val} max ${name}`);
                  }
                }

                return (
                  <button key={arch.id} onClick={() => !disabled && handleArchetypeToggle(arch.id)}
                    className={cn('text-left rounded-lg border px-3 py-2 transition-all',
                      selected ? 'border-gold bg-gold/15 text-gold' :
                      disabled ? 'border-navy-lighter/30 text-cream-dim/30 cursor-not-allowed' :
                      'border-navy-lighter hover:border-gold/30 text-cream cursor-pointer')}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{arch.label}</span>
                      <span className={cn('font-mono text-[10px] px-1.5 py-0.5 rounded-full border',
                        arch.cost === 3 ? 'text-gold border-gold/40 bg-gold/10' :
                        arch.cost === 2 ? 'text-cream border-cream-dim/30 bg-cream-dim/5' :
                        'text-green-light border-green-light/30 bg-green-light/5'
                      )}>{arch.cost} pt{arch.cost !== 1 ? 's' : ''}</span>
                    </div>
                    {pros.length > 0 && (
                      <div className="font-mono text-[10px] text-green-light mt-0.5">
                        +{pros.join(' · +')}
                      </div>
                    )}
                    {cons.length > 0 && (
                      <div className="font-mono text-[10px] text-red-400 mt-0.5">
                        -{cons.join(' · -')}
                      </div>
                    )}
                    {(attrPros.length > 0 || attrCons.length > 0) && (
                      <div className="flex flex-wrap gap-x-2 mt-0.5">
                        {attrPros.map(s => (
                          <span key={s} className="font-mono text-[10px] text-green-light">{s}</span>
                        ))}
                        {attrCons.map(s => (
                          <span key={s} className="font-mono text-[10px] text-red-400">{s}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="flex justify-between items-end">
            <Button variant="secondary" onClick={() => setStep('mode')}>Back</Button>
            <div className="text-right">
              <Button onClick={() => setStep('attributes')} disabled={!character.name || character.archetypes.length === 0}>
                Next: Set Attributes
              </Button>
              {!character.name && (
                <p className="text-red-400 text-xs mt-1 font-mono">Enter a player name to continue</p>
              )}
              {character.name && character.archetypes.length === 0 && (
                <p className="text-red-400 text-xs mt-1 font-mono">Select at least 1 personality</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step: Attributes */}
      {step === 'attributes' && (
        <div className="space-y-6">
          {/* Dual columns: Current (RIGHT NOW) + Potential (CEILING) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT: Current Ratings (RIGHT NOW) */}
            <Panel title="Right Now Ratings">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs text-cream-dim/50">How good you are TODAY</span>
                <span className={cn('font-mono text-lg font-bold',
                  currentRemaining < 0 ? 'text-red-400' : currentRemaining >= 20 ? 'text-green-light' : currentRemaining > 0 ? 'text-gold' : 'text-cream'
                )}>
                  {currentRemaining} pts
                </span>
              </div>
              <div className="font-mono text-[10px] text-cream-dim/40 mb-2">
                {character.background === 'high_school' ? 'HS: fewer current pts (raw)' :
                 character.background === 'undrafted' ? 'UDFA: modest current pts' :
                 character.background === 'college_star' ? 'College: balanced current pts' :
                 character.background === 'international' ? 'Intl: moderate current pts' :
                 'Late-round: moderate current pts'}
              </div>

              {currentRemaining === 0 && (
                <div className="mb-2 font-mono text-[10px] text-cream-dim/50 bg-navy-lighter/30 rounded px-2 py-1 text-center">
                  Lower an attribute to free up points
                </div>
              )}

              <div className="space-y-1">
                {(isPitcher
                  ? [['Stuff', 'stuff'], ['Control', 'control'], ['Stamina', 'stamina'], ['Fielding', 'fielding']] as const
                  : [['Contact', 'contact'], ['Power', 'power'], ['Speed', 'speed'], ['Fielding', 'fielding'], ['Arm', 'arm'], ['Eye', 'eye']] as const
                ).map(([label, key]) => (
                  <AttributeControl key={key} label={label} value={attrs[key as keyof PlayerAttributes]}
                    onChange={(v) => handleAttr(key as keyof PlayerAttributes, v)}
                    min={getEffectiveMin(key)} max={Math.min(getEffectiveMax(key), potential[key as keyof PlayerAttributes])}
                    pointsRemaining={currentRemaining}
                    isMaxedOut={attrs[key as keyof PlayerAttributes] === potential[key as keyof PlayerAttributes]} />
                ))}
                {isPitcher && (
                  <VelocityControl value={attrs.velocity}
                    onChange={(v) => handleAttr('velocity', v)}
                    pointsRemaining={currentRemaining}
                    max={potential.velocity}
                    isMaxedOut={attrs.velocity === potential.velocity} />
                )}
              </div>
              <div className="mt-2 font-mono text-[10px] text-cream-dim/40 text-center">
                Hold Shift to adjust by 5
              </div>
            </Panel>

            {/* RIGHT: Potential Ratings (CEILING) */}
            <Panel title="Potential Ratings">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs text-cream-dim/50">How good you COULD become</span>
                <span className={cn('font-mono text-lg font-bold',
                  potentialRemaining < 0 ? 'text-red-400' : potentialRemaining >= 20 ? 'text-green-light' : potentialRemaining > 0 ? 'text-gold' : 'text-cream'
                )}>
                  {potentialRemaining} pts
                </span>
              </div>
              <div className="font-mono text-[10px] text-cream-dim/40 mb-2">
                {character.background === 'high_school' ? 'HS: most potential pts (sky-high ceiling!)' :
                 character.background === 'undrafted' ? 'UDFA: lowest potential (limited ceiling)' :
                 character.background === 'college_star' ? 'College: balanced potential' :
                 character.background === 'international' ? 'Intl: high potential' :
                 'Late-round: below-avg potential'}
              </div>

              {potentialRemaining === 0 && (
                <div className="mb-2 font-mono text-[10px] text-cream-dim/50 bg-navy-lighter/30 rounded px-2 py-1 text-center">
                  Lower a ceiling to free up points
                </div>
              )}

              <div className="space-y-1">
                {(isPitcher
                  ? [['Stuff', 'stuff'], ['Control', 'control'], ['Stamina', 'stamina'], ['Fielding', 'fielding']] as const
                  : [['Contact', 'contact'], ['Power', 'power'], ['Speed', 'speed'], ['Fielding', 'fielding'], ['Arm', 'arm'], ['Eye', 'eye']] as const
                ).map(([label, key]) => (
                  <AttributeControl key={`pot_${key}`} label={label} value={potential[key as keyof PlayerAttributes]}
                    onChange={(v) => handlePotential(key as keyof PlayerAttributes, v)}
                    min={20} max={80}
                    pointsRemaining={potentialRemaining}
                    isMaxedOut={attrs[key as keyof PlayerAttributes] === potential[key as keyof PlayerAttributes]} />
                ))}
                {isPitcher && (
                  <VelocityControl value={potential.velocity}
                    onChange={(v) => handlePotential('velocity', v)}
                    pointsRemaining={potentialRemaining}
                    isMaxedOut={attrs.velocity === potential.velocity} />
                )}
              </div>
              <div className="mt-2 font-mono text-[10px] text-cream-dim/40 text-center">
                Hold Shift to adjust by 5
              </div>
            </Panel>
          </div>

          {/* Overall Preview */}
          <Panel title="Scouting Report">
            <div className="flex items-center justify-center gap-8 py-4">
              <div className="text-center">
                <div className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider">Current OVR</div>
                <div className="font-display text-5xl text-cream">{overallCurrent}</div>
              </div>
              <div className="text-cream-dim/30 font-display text-2xl">→</div>
              <div className="text-center">
                <div className="font-mono text-[10px] text-gold/60 uppercase tracking-wider">Potential OVR</div>
                <div className="font-display text-5xl text-gold">{overallPotential}</div>
              </div>
            </div>
            <div className="text-center font-mono text-xs text-cream-dim/50">
              Age {bgConfig.age} · {character.position} · {character.background.replace('_', ' ')}
            </div>
          </Panel>

          {isOverBudget && (
              <div className="font-mono text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded px-3 py-2">
                Over budget — lower some attributes
              </div>
            )}
            {/* Overall Rating — prominent */}
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
                  &ldquo;{draftResult.description}&rdquo;
                </p>
              </Panel>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <Button variant="secondary" onClick={() => { handleRunDraft(); }}>
                Re-roll Draft
              </Button>
              <Button onClick={handleStart} className="bg-gradient-to-r from-gold/80 to-gold border-gold">
                Accept &amp; Begin Career
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
