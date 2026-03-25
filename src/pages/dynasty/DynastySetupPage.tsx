import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import { createSettings, PRESETS, CHARACTER_ARCHETYPES } from '@/dynasty/DynastySettings.ts';
import type { DynastyPreset, CharacterCreation, DynastySettings, PlayerBackground } from '@/dynasty/DynastySettings.ts';
import type { DynastyMode } from '@/dynasty/ecs/types.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { TEAMS as ALL_TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';

type SetupStep = 'mode' | 'character' | 'settings' | 'team';

export function DynastySetupPage() {
  const navigate = useNavigate();
  const { startFranchise } = useFranchiseStore();
  const [step, setStep] = useState<SetupStep>('mode');
  const [mode, setMode] = useState<DynastyMode>('classic');
  const [preset, setPreset] = useState<DynastyPreset>('realistic');
  const [settings, setSettings] = useState<DynastySettings>(createSettings('classic'));
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Character creation state (Living only)
  const [character, setCharacter] = useState<CharacterCreation>({
    name: '', background: 'college_star', archetypes: [], position: 'SS',
  });

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

  const handleStart = () => {
    if (!selectedTeamId) return;
    startFranchise(ALL_TEAMS as any, LEAGUE_STRUCTURE, selectedTeamId);
    // Store dynasty settings in localStorage for now
    localStorage.setItem('claudeball_dynasty_settings', JSON.stringify(settings));
    localStorage.setItem('claudeball_dynasty_mode', mode);
    if (mode === 'living') {
      localStorage.setItem('claudeball_dynasty_character', JSON.stringify(character));
    }
    navigate('/franchise');
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl text-gold tracking-wide uppercase">New Dynasty</h1>
        <p className="font-mono text-cream-dim text-sm mt-2">
          {step === 'mode' && 'Choose your experience'}
          {step === 'character' && 'Create your player'}
          {step === 'settings' && 'Configure your league'}
          {step === 'team' && 'Choose your team'}
        </p>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {(['mode', ...(mode === 'living' ? ['character'] : []), 'settings', 'team'] as SetupStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-0.5 bg-navy-lighter" />}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs border',
                step === s ? 'border-gold bg-gold/20 text-gold' :
                  (['mode', ...(mode === 'living' ? ['character'] : []), 'settings', 'team'].indexOf(step) > ['mode', ...(mode === 'living' ? ['character'] : []), 'settings', 'team'].indexOf(s))
                    ? 'border-green-light/50 bg-green-light/10 text-green-light' : 'border-navy-lighter text-cream-dim/40'
              )}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Mode Selection */}
      {step === 'mode' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => handleModeSelect('classic')}
            className="text-left rounded-xl border-2 border-gold/30 bg-navy-lighter/30 p-6 hover:border-gold/60 hover:bg-navy-lighter/50 transition-all cursor-pointer"
          >
            <div className="font-display text-2xl text-gold uppercase tracking-wide mb-2">Classic Dynasty</div>
            <div className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-3">Start as GM</div>
            <p className="text-cream-dim text-sm leading-relaxed">
              Traditional franchise management. Build your roster through trades, the draft, and free agency.
              AI-driven personality system, living offseason, full financial depth.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Franchise Mgmt', 'Hot Stove', 'AI Conversations', 'Team Chemistry'].map(tag => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold/10 text-gold/70 border border-gold/20">{tag}</span>
              ))}
            </div>
          </button>

          <button
            onClick={() => handleModeSelect('living')}
            className="text-left rounded-xl border-2 border-neon-green/30 bg-navy-lighter/30 p-6 hover:border-neon-green/60 hover:bg-navy-lighter/50 transition-all cursor-pointer"
          >
            <div className="font-display text-2xl text-neon-green uppercase tracking-wide mb-2">Living Dynasty</div>
            <div className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-3">Start as Player → Work Your Way Up</div>
            <p className="text-cream-dim text-sm leading-relaxed">
              Full RPG career arc. Create a player, build relationships, manage your money, make life decisions.
              Work your way from player to scout to coach to GM to owner.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Full RPG', 'Career Pipeline', 'Life Events', 'AI Voice Calls', 'Personal Finance'].map(tag => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neon-green/10 text-neon-green/70 border border-neon-green/20">{tag}</span>
              ))}
            </div>
          </button>
        </div>
      )}

      {/* Step 2: Character Creation (Living only) */}
      {step === 'character' && (
        <div className="space-y-6">
          <Panel title="Your Player">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs text-cream-dim uppercase tracking-wider block mb-1">Name</label>
                <input
                  type="text"
                  value={character.name}
                  onChange={e => setCharacter(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-navy-lighter/50 border border-navy-lighter rounded-md px-3 py-2 text-cream font-mono text-sm focus:border-gold/50 outline-none"
                  placeholder="Enter player name..."
                />
              </div>
              <div>
                <label className="font-mono text-xs text-cream-dim uppercase tracking-wider block mb-1">Position</label>
                <select
                  value={character.position}
                  onChange={e => setCharacter(prev => ({ ...prev, position: e.target.value }))}
                  className="w-full bg-navy-lighter/50 border border-navy-lighter rounded-md px-3 py-2 text-cream font-mono text-sm focus:border-gold/50 outline-none"
                >
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
                { id: 'college_star', label: 'College Star', desc: 'Top prospect, high expectations' },
                { id: 'late_round', label: 'Late-Round Pick', desc: 'Chip on your shoulder, underdog' },
                { id: 'undrafted', label: 'Undrafted Free Agent', desc: 'Nobody believed in you' },
                { id: 'international', label: 'International Signee', desc: 'Global talent, new country' },
              ] as { id: PlayerBackground; label: string; desc: string }[]).map(bg => (
                <button
                  key={bg.id}
                  onClick={() => setCharacter(prev => ({ ...prev, background: bg.id }))}
                  className={cn(
                    'text-left rounded-lg border p-3 transition-all cursor-pointer',
                    character.background === bg.id
                      ? 'border-gold bg-gold/10' : 'border-navy-lighter hover:border-gold/30'
                  )}
                >
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
                  <button
                    key={arch.id}
                    onClick={() => !disabled && handleArchetypeToggle(arch.id)}
                    className={cn(
                      'text-left rounded-lg border px-3 py-2 transition-all',
                      selected ? 'border-gold bg-gold/15 text-gold' :
                        disabled ? 'border-navy-lighter/30 text-cream-dim/30 cursor-not-allowed' :
                          'border-navy-lighter hover:border-gold/30 text-cream cursor-pointer'
                    )}
                  >
                    <span className="font-mono text-sm">{arch.label}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('mode')}>Back</Button>
            <Button
              onClick={() => setStep('settings')}
              disabled={!character.name || character.archetypes.length !== 3}
            >
              Next: League Settings
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: League Settings */}
      {step === 'settings' && (
        <div className="space-y-6">
          <Panel title="Preset">
            <div className="grid grid-cols-4 gap-3">
              {(['casual', 'realistic', 'hardcore', 'sandbox'] as DynastyPreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => handlePresetSelect(p)}
                  className={cn(
                    'rounded-lg border p-3 text-center transition-all cursor-pointer',
                    preset === p ? 'border-gold bg-gold/15' : 'border-navy-lighter hover:border-gold/30'
                  )}
                >
                  <div className="font-mono text-sm text-cream capitalize">{p}</div>
                  <div className="font-mono text-[10px] text-cream-dim/50 mt-1">
                    {p === 'casual' && '56 games · Easy'}
                    {p === 'realistic' && '162 games · Fair'}
                    {p === 'hardcore' && '162 games · Brutal'}
                    {p === 'sandbox' && 'Custom · No limits'}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Key Settings">
            <div className="space-y-3 font-mono text-sm">
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Season Length</span>
                <span className="text-gold">{settings.seasonLength} games</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Teams</span>
                <span className="text-gold">{settings.teamCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Salary System</span>
                <span className="text-gold capitalize">{settings.salarySystem.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Trade AI</span>
                <span className="text-gold capitalize">{settings.tradeAIDifficulty}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Injuries</span>
                <span className="text-gold capitalize">{settings.injuryFrequency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Prospect Bust Rate</span>
                <span className="text-gold">{settings.prospectBustRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Owner Patience</span>
                <span className="text-gold capitalize">{settings.ownerPatience.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">Fire Risk</span>
                <span className={cn('font-bold', settings.fireRisk ? 'text-red-400' : 'text-green-light')}>{settings.fireRisk ? 'ON' : 'OFF'}</span>
              </div>
            </div>
          </Panel>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(mode === 'living' ? 'character' : 'mode')}>Back</Button>
            <Button onClick={() => setStep('team')}>Next: Choose Team</Button>
          </div>
        </div>
      )}

      {/* Step 4: Team Selection */}
      {step === 'team' && (
        <div className="space-y-6">
          <Panel title={mode === 'classic' ? 'Select Your Team' : 'Select Starting Organization'}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {ALL_TEAMS.map(team => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    'text-left rounded-lg border px-3 py-2 transition-all cursor-pointer',
                    selectedTeamId === team.id ? 'border-gold bg-gold/15' : 'border-navy-lighter hover:border-gold/30'
                  )}
                >
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
            <Button
              onClick={handleStart}
              disabled={!selectedTeamId}
              className="bg-gradient-to-r from-gold/80 to-gold border-gold"
            >
              {mode === 'classic' ? 'Start Classic Dynasty' : 'Start Living Dynasty'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
