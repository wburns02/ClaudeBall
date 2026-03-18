import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { Panel } from '@/components/ui/Panel.tsx';
import { useSettingsStore } from '@/stores/settingsStore.ts';
import type { Difficulty, Theme } from '@/stores/settingsStore.ts';
import { cn } from '@/lib/cn.ts';

// ---- Volume Slider -------------------------------------------------------

interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function VolumeSlider({ label, value, onChange }: VolumeSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-cream-dim uppercase tracking-wide">{label}</span>
        <span className="font-mono text-sm text-gold w-8 text-right">{value}</span>
      </div>
      {/* Track */}
      <div className="relative h-3 rounded-full bg-[#0d1625] border border-navy-lighter overflow-hidden">
        {/* Gold fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gold rounded-full transition-all duration-75"
          style={{ width: `${value}%` }}
        />
        {/* Native range for interaction, transparent overlay */}
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// ---- Toggle Switch -------------------------------------------------------

interface ToggleSwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleSwitch({ label, description, value, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-mono text-sm text-cream uppercase tracking-wide">{label}</div>
        {description && (
          <div className="font-mono text-xs text-cream-dim/60 mt-0.5">{description}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative w-12 h-6 rounded-full transition-all duration-200 border focus:outline-none',
          value
            ? 'bg-gold border-gold shadow-[0_0_8px_rgba(212,168,67,0.4)]'
            : 'bg-[#0d1625] border-navy-lighter',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full transition-all duration-200',
            value ? 'left-6 bg-navy' : 'left-0.5 bg-cream-dim/40',
          )}
        />
      </button>
    </div>
  );
}

// ---- Difficulty Selector -------------------------------------------------

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: 'rookie',  label: 'Rookie',  desc: 'Forgiving — ideal for new players' },
  { id: 'veteran', label: 'Veteran', desc: 'Balanced challenge' },
  { id: 'legend',  label: 'Legend',  desc: 'Brutal realism' },
];

// ---- Theme Selector -------------------------------------------------

const THEMES: { id: Theme; label: string; desc: string }[] = [
  { id: 'classic', label: 'Classic', desc: 'Dark navy & gold' },
  { id: 'dark',    label: 'Dark',    desc: 'Pure black mode' },
  { id: 'retro',   label: 'Retro',   desc: 'Green phosphor CRT' },
];

// ---- Speed Slider -------------------------------------------------------

interface SpeedSliderProps {
  value: number;
  onChange: (v: number) => void;
}

function SpeedSlider({ value, onChange }: SpeedSliderProps) {
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-cream-dim uppercase tracking-wide">Auto-Play Speed</span>
        <span className="font-mono text-sm text-gold">{value}x</span>
      </div>
      {/* Track */}
      <div className="relative h-3 rounded-full bg-[#0d1625] border border-navy-lighter overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gold rounded-full transition-all duration-75"
          style={{ width: `${((value - 1) / 9) * 100}%` }}
        />
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      {/* Tick labels */}
      <div className="flex justify-between px-0.5">
        {labels.map((l) => (
          <span key={l} className="font-mono text-[10px] text-cream-dim/40">{l}</span>
        ))}
      </div>
    </div>
  );
}

// ---- Main Page -----------------------------------------------------------

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore();

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Settings</h1>
          <p className="font-mono text-xs text-cream-dim/50 mt-1">Audio, gameplay, and display options</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          ← Back
        </Button>
      </div>

      {/* Audio */}
      <Panel title="Audio">
        <div className="space-y-5 py-2">
          <VolumeSlider
            label="Master Volume"
            value={settings.masterVolume}
            onChange={(v) => settings.setSetting('masterVolume', v)}
          />
          <VolumeSlider
            label="Music Volume"
            value={settings.musicVolume}
            onChange={(v) => settings.setSetting('musicVolume', v)}
          />
          <VolumeSlider
            label="SFX Volume"
            value={settings.sfxVolume}
            onChange={(v) => settings.setSetting('sfxVolume', v)}
          />
        </div>
      </Panel>

      {/* Gameplay */}
      <Panel title="Gameplay">
        <div className="space-y-5 py-2">
          <SpeedSlider
            value={settings.autoPlaySpeed}
            onChange={(v) => settings.setSetting('autoPlaySpeed', v)}
          />
          <ToggleSwitch
            label="Show Animations"
            description="Base-running, fielding, and pitch effects"
            value={settings.showAnimations}
            onChange={(v) => settings.setSetting('showAnimations', v)}
          />
          <div className="pt-1">
            <div className="font-mono text-sm text-cream-dim uppercase tracking-wide mb-3">Difficulty</div>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => settings.setSetting('difficulty', d.id)}
                  className={cn(
                    'px-3 py-3 rounded-md text-left border transition-all duration-150',
                    settings.difficulty === d.id
                      ? 'bg-gold/10 border-gold text-gold shadow-[0_0_8px_rgba(212,168,67,0.2)]'
                      : 'bg-[#0d1625] border-navy-lighter text-cream-dim hover:border-gold/40 hover:text-cream',
                  )}
                >
                  <div className="font-mono text-sm font-semibold">{d.label}</div>
                  <div className="font-mono text-[10px] mt-1 opacity-70">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Display */}
      <Panel title="Display">
        <div className="space-y-3 py-2">
          <div className="font-mono text-sm text-cream-dim uppercase tracking-wide mb-3">Theme</div>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => settings.setSetting('theme', t.id)}
                className={cn(
                  'px-3 py-3 rounded-md text-left border transition-all duration-150',
                  settings.theme === t.id
                    ? 'bg-gold/10 border-gold text-gold shadow-[0_0_8px_rgba(212,168,67,0.2)]'
                    : 'bg-[#0d1625] border-navy-lighter text-cream-dim hover:border-gold/40 hover:text-cream',
                )}
              >
                <div className="font-mono text-sm font-semibold">{t.label}</div>
                <div className="font-mono text-[10px] mt-1 opacity-70">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Footer actions */}
      <div className="flex justify-between items-center pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => settings.resetToDefaults()}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/')}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
