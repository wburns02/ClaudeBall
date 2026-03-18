/**
 * Sprint C Visual Test Page
 * Verifies PitchingInterface, PitchSelectionPanel, LocationGrid,
 * AccuracyMeter, ManagerDecisionPanel, and BullpenStatus render correctly.
 * Remove after sprint integration.
 */
import { useState } from 'react';
import type { PitchType } from '@/engine/types/enums.ts';
import type { ManagerDecision } from '@/engine/types/manager.ts';
import { getSampleTeams } from '@/engine/data/sampleTeams.ts';
import { PitchingInterface } from '@/components/game/PitchingInterface.tsx';
import { ManagerDecisionPanel } from '@/components/game/ManagerDecisionPanel.tsx';
import { BullpenStatus } from '@/components/game/BullpenStatus.tsx';
import { PitchSelectionPanel } from '@/components/game/PitchSelectionPanel.tsx';
import { LocationGrid } from '@/components/game/LocationGrid.tsx';
import { AccuracyMeter } from '@/components/game/AccuracyMeter.tsx';
import { Button } from '@/components/ui/Button.tsx';

type Tab = 'pitching' | 'manager' | 'components';

function getTeamData() {
  const { away } = getSampleTeams();
  const pitcher = away.roster.players.find(p => p.id === away.pitcherId)!;
  const batter  = away.roster.players.find(p => p.id !== away.pitcherId && p.position !== 'P')!;
  return { away, pitcher, batter };
}

export function SprintCTestPage() {
  const [tab, setTab] = useState<Tab>('pitching');
  const { away, pitcher, batter } = getTeamData();

  const [lastDecision, setLastDecision] = useState<string>('—');
  const [lastPitch, setLastPitch]       = useState<string>('—');
  const [selectedPitch, setSelectedPitch] = useState<PitchType | null>('fastball');
  const [selectedCell, setSelectedCell]   = useState<{ row: number; col: number } | null>(null);
  const [meterActive, setMeterActive]     = useState(false);
  const [meterResult, setMeterResult]     = useState<string>('—');

  const count = { balls: 2, strikes: 1 };
  const bases = { first: 'runner-1', second: null, third: null };

  const tabs: Tab[] = ['pitching', 'manager', 'components'];

  return (
    <div className="min-h-screen bg-navy p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Sprint C Test</h1>
        <p className="font-mono text-cream-dim text-xs mt-1">Pitching Interface + Manager Decisions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-navy-lighter pb-3">
        {tabs.map(t => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'primary' : 'secondary'}
            onClick={() => setTab(t)}
            className="capitalize"
          >
            {t}
          </Button>
        ))}
      </div>

      {/* Tab: Full Pitching Interface */}
      {tab === 'pitching' && (
        <div className="bg-navy-light border border-navy-lighter rounded-lg p-4">
          <PitchingInterface
            pitcher={pitcher}
            batter={batter}
            count={count}
            onPitchSubmit={(pitchType, targetZone, acc) => {
              setLastPitch(
                `${pitchType} → row ${targetZone.row} col ${targetZone.col}${acc !== undefined ? ` acc=${acc.toFixed(2)}` : ''}`
              );
            }}
            lastPitch={undefined}
          />
          <div className="mt-4 border-t border-navy-lighter pt-3 font-mono text-xs text-cream-dim">
            Last pitch: <span className="text-gold">{lastPitch}</span>
          </div>
        </div>
      )}

      {/* Tab: Manager Decision Panel */}
      {tab === 'manager' && (
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-xs text-cream-dim font-mono mb-2 uppercase">Pitching role</p>
            <ManagerDecisionPanel
              role="pitching"
              team={away}
              bases={bases}
              outs={1}
              onDecision={(d: ManagerDecision) => setLastDecision(JSON.stringify(d))}
            />
          </div>
          <div className="flex-1">
            <p className="text-xs text-cream-dim font-mono mb-2 uppercase">Batting role</p>
            <ManagerDecisionPanel
              role="batting"
              team={away}
              bases={bases}
              outs={1}
              onDecision={(d: ManagerDecision) => setLastDecision(JSON.stringify(d))}
            />
          </div>
          <div className="w-48 font-mono text-xs text-cream-dim mt-4">
            Last decision:<br />
            <span className="text-gold break-all">{lastDecision}</span>
          </div>
        </div>
      )}

      {/* Tab: Individual components */}
      {tab === 'components' && (
        <div className="flex flex-wrap gap-6 items-start">
          {/* PitchSelectionPanel */}
          <div>
            <p className="text-xs text-cream-dim font-mono mb-2 uppercase">PitchSelectionPanel</p>
            <PitchSelectionPanel
              repertoire={pitcher.pitching.repertoire}
              stuff={pitcher.pitching.stuff}
              selectedPitch={selectedPitch}
              onSelect={p => setSelectedPitch(p)}
            />
          </div>

          {/* LocationGrid */}
          <div>
            <p className="text-xs text-cream-dim font-mono mb-2 uppercase">LocationGrid</p>
            <LocationGrid
              onSelect={(row, col) => setSelectedCell({ row, col })}
              selectedCell={selectedCell}
              lastPitchCell={{ row: 2, col: 2, wasStrike: true }}
            />
            {selectedCell && (
              <p className="font-mono text-xs text-gold mt-1">
                Selected: ({selectedCell.row}, {selectedCell.col})
              </p>
            )}
          </div>

          {/* AccuracyMeter */}
          <div>
            <p className="text-xs text-cream-dim font-mono mb-2 uppercase">AccuracyMeter</p>
            <AccuracyMeter
              speed={180}
              active={meterActive}
              onComplete={acc => {
                setMeterResult(acc.toFixed(3));
                setMeterActive(false);
              }}
            />
            <div className="mt-2 flex flex-col gap-1">
              <Button size="sm" variant="secondary" onClick={() => { setMeterActive(true); setMeterResult('—'); }}>
                Start
              </Button>
              <p className="font-mono text-xs text-gold">Result: {meterResult}</p>
            </div>
          </div>

          {/* BullpenStatus */}
          <div className="min-w-[280px]">
            <p className="text-xs text-cream-dim font-mono mb-2 uppercase">BullpenStatus</p>
            <BullpenStatus
              bullpen={away.bullpen.map(id => away.roster.players.find(p => p.id === id)!).filter(Boolean)}
              currentPitcherId={away.pitcherId}
              onSelect={id => setLastDecision(`bullpen → ${id}`)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
