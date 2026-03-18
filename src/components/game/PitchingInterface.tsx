import { useState, useEffect, useCallback } from 'react';
import type { Player } from '@/engine/types/player.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import type { PitchType, PitchResult } from '@/engine/types/enums.ts';
import { cn } from '@/lib/cn.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { PitchSelectionPanel } from './PitchSelectionPanel.tsx';
import { LocationGrid } from './LocationGrid.tsx';
import { AccuracyMeter } from './AccuracyMeter.tsx';

interface PitchCount {
  balls: number;
  strikes: number;
}

interface CellCoord {
  row: number;
  col: number;
}

interface LastPitch {
  cell: CellCoord;
  wasStrike: boolean;
  result: PitchResult;
}

interface PitchingInterfaceProps {
  pitcher: Player;
  batter: Player;
  count: PitchCount;
  onPitchSubmit: (pitchType: PitchType, targetZone: CellCoord, meterAccuracy?: number) => void;
  lastPitch?: LastPitch;
}

/** Meter speeds by pitch type (pixels per second) */
const METER_SPEEDS: Record<PitchType, number> = {
  fastball:    220,
  sinker:      200,
  cutter:      190,
  slider:      170,
  curveball:   160,
  changeup:    120,
  splitter:    155,
  knuckleball: 100,
};

function PitchResultBadge({ result }: { result: PitchResult }) {
  const config: Record<PitchResult, { label: string; className: string }> = {
    ball:            { label: 'Ball',            className: 'bg-blue-600 text-white' },
    called_strike:   { label: 'Called Strike',   className: 'bg-red-600 text-white' },
    swinging_strike: { label: 'Swing & Miss',    className: 'bg-red-500 text-white' },
    foul:            { label: 'Foul Ball',        className: 'bg-yellow-600 text-white' },
    contact:         { label: 'In Play!',         className: 'bg-green-600 text-white' },
  };
  const cfg = config[result];
  return (
    <span className={cn('px-3 py-1 rounded font-semibold text-sm animate-pulse', cfg.className)}>
      {cfg.label}
    </span>
  );
}

function CountDisplay({ count }: { count: PitchCount }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'w-3 h-3 rounded-full border',
              i < count.balls ? 'bg-green-500 border-green-400' : 'border-cream-dim/40',
            )}
          />
        ))}
        <span className="text-xs text-cream-dim ml-1 font-mono">B</span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 3 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'w-3 h-3 rounded-full border',
              i < count.strikes ? 'bg-red-500 border-red-400' : 'border-cream-dim/40',
            )}
          />
        ))}
        <span className="text-xs text-cream-dim ml-1 font-mono">K</span>
      </div>
    </div>
  );
}

function BatterCard({ batter }: { batter: Player }) {
  const hand = batter.bats === 'S' ? 'S' : batter.bats;
  return (
    <Panel title="Batter" className="min-w-[180px]">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-cream font-semibold text-base leading-tight">
            #{batter.number} {getPlayerName(batter)}
          </p>
          <p className="text-cream-dim text-xs font-mono mt-0.5">
            {batter.position} · Bats {hand} · Age {batter.age}
          </p>
        </div>

        <div className="border-t border-navy-lighter pt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          <div>
            <p className="text-xs text-cream-dim">Contact</p>
            <p className="font-mono text-sm text-cream">
              {batter.bats === 'L' ? batter.batting.contact_L : batter.batting.contact_R}
            </p>
          </div>
          <div>
            <p className="text-xs text-cream-dim">Power</p>
            <p className="font-mono text-sm text-cream">
              {batter.bats === 'L' ? batter.batting.power_L : batter.batting.power_R}
            </p>
          </div>
          <div>
            <p className="text-xs text-cream-dim">Eye</p>
            <p className="font-mono text-sm text-cream">{batter.batting.eye}</p>
          </div>
          <div>
            <p className="text-xs text-cream-dim">K-Avoid</p>
            <p className="font-mono text-sm text-cream">{batter.batting.avoid_k}</p>
          </div>
          <div>
            <p className="text-xs text-cream-dim">Speed</p>
            <p className="font-mono text-sm text-cream">{batter.batting.speed}</p>
          </div>
          <div>
            <p className="text-xs text-cream-dim">Clutch</p>
            <p className="font-mono text-sm text-cream">{batter.batting.clutch}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

type Step = 'select_pitch' | 'select_location' | 'accuracy' | 'done';

export function PitchingInterface({
  pitcher,
  batter,
  count,
  onPitchSubmit,
  lastPitch,
}: PitchingInterfaceProps) {
  const repertoire = pitcher.pitching.repertoire;

  const [selectedPitch, setSelectedPitch] = useState<PitchType | null>(
    repertoire.length > 0 ? repertoire[0] : null,
  );
  const [selectedCell, setSelectedCell] = useState<CellCoord | null>(null);
  const [step, setStep] = useState<Step>('select_pitch');
  const [meterActive, setMeterActive] = useState(false);

  // Keyboard shortcuts for pitch selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (step !== 'select_pitch' && step !== 'select_location') return;
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        const pitch = repertoire[num - 1];
        if (pitch) {
          setSelectedPitch(pitch);
          if (step === 'select_pitch') setStep('select_location');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, repertoire]);

  const handlePitchSelect = useCallback((pitch: PitchType) => {
    setSelectedPitch(pitch);
    setStep('select_location');
  }, []);

  const handleLocationSelect = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
    setStep('accuracy');
    setMeterActive(true);
  }, []);

  const handleAccuracyComplete = useCallback(
    (accuracy: number) => {
      setMeterActive(false);
      setStep('done');
      if (selectedPitch && selectedCell) {
        onPitchSubmit(selectedPitch, selectedCell, accuracy);
      }
    },
    [selectedPitch, selectedCell, onPitchSubmit],
  );

  const handleThrowNow = useCallback(() => {
    if (selectedPitch && selectedCell) {
      setStep('done');
      onPitchSubmit(selectedPitch, selectedCell);
    }
  }, [selectedPitch, selectedCell, onPitchSubmit]);

  const meterSpeed = selectedPitch ? METER_SPEEDS[selectedPitch] : 160;

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-cream-dim font-mono uppercase tracking-widest">
            Pitching
          </span>
          <span className="text-cream font-semibold text-sm">
            #{pitcher.number} {getPlayerName(pitcher)}
          </span>
          <span className="text-cream-dim text-xs font-mono">
            {pitcher.state.pitchCount} pitches · {Math.round(pitcher.state.fatigue)}% fatigue
          </span>
        </div>

        <div className="flex items-center gap-3">
          <CountDisplay count={count} />
          {lastPitch && <PitchResultBadge result={lastPitch.result} />}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 px-1">
        {(['select_pitch', 'select_location', 'accuracy'] as Step[]).map((s, i) => {
          const isComplete = (
            (s === 'select_pitch' && step !== 'select_pitch') ||
            (s === 'select_location' && (step === 'accuracy' || step === 'done')) ||
            (s === 'accuracy' && step === 'done')
          );
          const isCurrent = step === s;
          const labels = ['1. Pick Pitch', '2. Pick Location', '3. Throw'];

          return (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <span className="text-cream-dim/30 mx-1">›</span>}
              <span
                className={cn(
                  'text-xs font-mono px-2 py-0.5 rounded',
                  isComplete ? 'text-green-400' : isCurrent ? 'text-gold' : 'text-cream-dim/40',
                )}
              >
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main content: three-column layout */}
      <div className="flex items-start gap-4">
        {/* Left: pitch selection */}
        <PitchSelectionPanel
          repertoire={repertoire}
          stuff={pitcher.pitching.stuff}
          selectedPitch={selectedPitch}
          onSelect={handlePitchSelect}
        />

        {/* Center: location grid + accuracy */}
        <div className="flex flex-col items-center gap-4">
          <LocationGrid
            onSelect={handleLocationSelect}
            selectedCell={selectedCell}
            lastPitchCell={lastPitch ? { ...lastPitch.cell, wasStrike: lastPitch.wasStrike } : undefined}
          />

          {/* Throw Now button when location is chosen but accuracy not started */}
          {step === 'select_location' && selectedCell && (
            <Button variant="secondary" size="sm" onClick={handleThrowNow}>
              Throw Now (skip meter)
            </Button>
          )}

          {step === 'accuracy' && (
            <AccuracyMeter
              speed={meterSpeed}
              active={meterActive}
              onComplete={handleAccuracyComplete}
            />
          )}
        </div>

        {/* Right: batter card */}
        <BatterCard batter={batter} />
      </div>

      {/* Pitcher stats footer */}
      <div className="flex items-center gap-4 px-1 border-t border-navy-lighter pt-2">
        <span className="text-xs text-cream-dim font-mono">
          Stuff <span className="text-cream">{pitcher.pitching.stuff}</span>
        </span>
        <span className="text-xs text-cream-dim font-mono">
          Ctl <span className="text-cream">{pitcher.pitching.control}</span>
        </span>
        <span className="text-xs text-cream-dim font-mono">
          Mov <span className="text-cream">{pitcher.pitching.movement}</span>
        </span>
        <span className="text-xs text-cream-dim font-mono">
          Vel <span className="text-cream">{pitcher.pitching.velocity} mph</span>
        </span>
        <span className="text-xs text-cream-dim font-mono">
          Stam <span className="text-cream">{pitcher.pitching.stamina}</span>
        </span>
      </div>
    </div>
  );
}
