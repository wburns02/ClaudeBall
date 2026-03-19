import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { LineupBuilder } from '@/engine/ai/LineupBuilder.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { LineupSpot } from '@/engine/types/team.ts';

const BATTING_SPOT_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const BATTING_SPOT_ROLES = [
  'Leadoff',
  'Contact',
  'Best Hitter',
  'Cleanup',
  'Power #2',
  'Middle',
  'Bottom',
  'Bottom',
  'Flex / P',
];

const ROLE_COLORS = [
  'text-yellow-300',
  'text-blue-300',
  'text-gold',
  'text-red-400',
  'text-orange-400',
  'text-cream-dim',
  'text-cream-dim/60',
  'text-cream-dim/60',
  'text-cream-dim/40',
];

function ovrColor(ovr: number) {
  if (ovr >= 75) return 'text-gold';
  if (ovr >= 60) return 'text-green-light';
  if (ovr >= 45) return 'text-cream';
  return 'text-red-400';
}

function PitcherGrades({ p }: { p: Player }) {
  return (
    <div className="flex gap-3 font-mono text-[10px] text-cream-dim/60 mt-0.5">
      <span>STF <span className="text-cream-dim">{p.pitching.stuff}</span></span>
      <span>MOV <span className="text-cream-dim">{p.pitching.movement}</span></span>
      <span>CTL <span className="text-cream-dim">{p.pitching.control}</span></span>
      <span className="text-cream-dim/40">{p.pitching.velocity}mph</span>
    </div>
  );
}

function BatterGrades({ p }: { p: Player }) {
  return (
    <div className="flex gap-3 font-mono text-[10px] text-cream-dim/60 mt-0.5">
      <span>CON <span className="text-cream-dim">{p.batting.contact_R}</span></span>
      <span>PWR <span className="text-cream-dim">{p.batting.power_R}</span></span>
      <span>EYE <span className="text-cream-dim">{p.batting.eye}</span></span>
      <span>SPD <span className="text-cream-dim">{p.batting.speed}</span></span>
    </div>
  );
}

export function LineupEditorPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, reorderLineup, setRotation, setBullpen } = useFranchiseStore();
  const [saved, setSaved] = useState(false);
  const [autoFilledBatting, setAutoFilledBatting] = useState(false);
  const [autoFilledPitching, setAutoFilledPitching] = useState(false);
  const [activeTab, setActiveTab] = useState<'batting' | 'pitching'>('batting');
  // Selected batting spot index for swap
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  // Selected rotation slot for swap
  const [selectedRotSlot, setSelectedRotSlot] = useState<number | null>(null);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  if (!userTeam) return null;

  const roster = userTeam.roster.players;
  const currentLineup: LineupSpot[] = userTeam.lineup ?? [];
  const currentRotation: string[] = userTeam.rotation ?? [];
  const currentBullpen: string[] = userTeam.bullpen ?? [];

  // Categorize roster
  const pitchers = roster.filter(p => p.position === 'P');
  const positionPlayers = roster.filter(p => p.position !== 'P');

  // Players NOT in the current lineup
  const lineupIds = new Set(currentLineup.map(s => s.playerId));
  const benchPlayers = positionPlayers.filter(p => !lineupIds.has(p.id));

  // Pitchers NOT in rotation
  const rotationSet = new Set(currentRotation);
  const bullpenPitchers = pitchers.filter(p => !rotationSet.has(p.id));
  const rotationPitchers = currentRotation.map(id => pitchers.find(p => p.id === id)).filter(Boolean) as Player[];

  const getPlayer = (id: string) => roster.find(p => p.id === id);

  // Auto-fill batting order using LineupBuilder AI
  const handleAutoFillBatting = () => {
    const builtLineup = LineupBuilder.buildLineup(userTeam);
    reorderLineup(userTeamId, builtLineup);
    setSaved(false);
    setAutoFilledBatting(true);
    setTimeout(() => setAutoFilledBatting(false), 1500);
  };

  // Auto-fill rotation: top 5 starters by stuff+movement+control
  const handleAutoFillRotation = () => {
    const sorted = [...pitchers].sort((a, b) =>
      (b.pitching.stuff + b.pitching.movement + b.pitching.control) -
      (a.pitching.stuff + a.pitching.movement + a.pitching.control)
    );
    setRotation(userTeamId, sorted.slice(0, 5).map(p => p.id));
    setSaved(false);
    setAutoFilledPitching(true);
    setTimeout(() => setAutoFilledPitching(false), 1500);
  };

  // Auto-fill bullpen: remaining pitchers after rotation
  const handleAutoFillBullpen = () => {
    const rotSet = new Set(currentRotation);
    const relievers = pitchers.filter(p => !rotSet.has(p.id)).map(p => p.id);
    setBullpen(userTeamId, relievers);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Batting order swap logic ──
  const handleSpotClick = (spotIdx: number) => {
    if (selectedSpot === null) {
      setSelectedSpot(spotIdx);
    } else if (selectedSpot === spotIdx) {
      setSelectedSpot(null);
    } else {
      // Swap the two spots
      const newLineup = [...currentLineup];
      const a = newLineup[selectedSpot];
      const b = newLineup[spotIdx];
      if (a && b) {
        newLineup[selectedSpot] = b;
        newLineup[spotIdx] = a;
        reorderLineup(userTeamId, newLineup);
      }
      setSelectedSpot(null);
      setSaved(false);
    }
  };

  const handleBenchToBatting = (playerId: string, spotIdx: number) => {
    // Place bench player into batting spot, sending current occupant to bench
    const newLineup = [...currentLineup];
    newLineup[spotIdx] = { playerId, position: roster.find(p => p.id === playerId)?.position ?? 'DH' };
    reorderLineup(userTeamId, newLineup);
    setSelectedSpot(null);
    setSaved(false);
  };

  // ── Rotation slot swap logic ──
  const handleRotSlotClick = (slotIdx: number) => {
    if (selectedRotSlot === null) {
      setSelectedRotSlot(slotIdx);
    } else if (selectedRotSlot === slotIdx) {
      setSelectedRotSlot(null);
    } else {
      const newRot = [...currentRotation];
      const a = newRot[selectedRotSlot];
      const b = newRot[slotIdx];
      if (a !== undefined && b !== undefined) {
        newRot[selectedRotSlot] = b;
        newRot[slotIdx] = a;
        setRotation(userTeamId, newRot);
      }
      setSelectedRotSlot(null);
      setSaved(false);
    }
  };

  const handleAddToRotation = (playerId: string) => {
    if (currentRotation.length >= 5) return;
    setRotation(userTeamId, [...currentRotation, playerId]);
    setSaved(false);
  };

  const handleRemoveFromRotation = (playerId: string) => {
    setRotation(userTeamId, currentRotation.filter(id => id !== playerId));
    setSaved(false);
  };

  const bullpenRoles = ['Closer', 'Setup', 'Long Relief', 'Middle Relief', 'Spot Starter'];

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Lineup Editor</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam.city} {userTeam.name} · {season.year} Season
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            variant="primary"
            size="sm"
            className={saved ? '!bg-green-700 !shadow-green-900/50' : ''}
          >
            {saved ? '✓ Saved' : 'Save Lineup'}
          </Button>
          <Button onClick={() => navigate('/franchise/roster')} variant="ghost" size="sm">Roster</Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-navy-lighter/30 rounded-xl p-1 mb-5 w-fit">
        {(['batting', 'pitching'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all',
              activeTab === tab ? 'bg-gold text-navy shadow-sm' : 'text-cream-dim hover:text-cream',
            )}
          >
            {tab === 'batting' ? '⚾ Batting Order' : '🔥 Pitching Staff'}
          </button>
        ))}
      </div>

      {activeTab === 'batting' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,320px] gap-5">
          {/* Batting Order */}
          <Panel title={`Batting Order (${currentLineup.length}/9)`}>
            <div className="flex justify-between items-center mb-4">
              <p className="font-mono text-xs text-cream-dim/50">
                {selectedSpot !== null
                  ? `Spot #${selectedSpot + 1} selected — click another spot to swap`
                  : 'Click two spots to swap them'}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAutoFillBatting}
                className={autoFilledBatting ? '!bg-green-700/30 !border-green-600/50 !text-green-400' : ''}
              >
                {autoFilledBatting ? '✓ Filled!' : 'Auto-Fill (AI)'}
              </Button>
            </div>

            <div className="space-y-1.5">
              {Array.from({ length: 9 }, (_, i) => {
                const spot = currentLineup[i];
                const player = spot ? getPlayer(spot.playerId) : null;
                const ovr = player ? Math.round(evaluatePlayer(player)) : 0;
                const isSelected = selectedSpot === i;

                return (
                  <button
                    key={i}
                    onClick={() => handleSpotClick(i)}
                    className={cn(
                      'w-full text-left rounded-lg border transition-all p-3',
                      isSelected
                        ? 'bg-gold/20 border-gold/70 ring-1 ring-gold/40'
                        : player
                          ? 'bg-navy-lighter/20 border-navy-lighter hover:border-gold/30 hover:bg-navy-lighter/40'
                          : 'bg-navy-lighter/5 border-dashed border-navy-lighter/40 hover:border-gold/30',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Batting position number */}
                      <div className="w-8 text-center shrink-0">
                        <span className="font-display text-2xl font-bold text-cream-dim/30">{i + 1}</span>
                      </div>

                      {/* Role label */}
                      <div className="w-16 shrink-0">
                        <span className={cn('font-mono text-[9px] uppercase tracking-wider', ROLE_COLORS[i])}>
                          {BATTING_SPOT_LABELS[i]}
                        </span>
                        <div className={cn('font-mono text-[8px] text-cream-dim/40')}>
                          {BATTING_SPOT_ROLES[i]}
                        </div>
                      </div>

                      {/* Player info */}
                      {player ? (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-body text-sm text-cream font-semibold truncate">
                              {getPlayerName(player)}
                            </span>
                            <span className="font-mono text-[10px] text-gold/70 shrink-0">
                              {spot?.position ?? player.position}
                            </span>
                            {isSelected && (
                              <span className="font-mono text-[10px] text-gold animate-pulse shrink-0">← selected</span>
                            )}
                          </div>
                          <BatterGrades p={player} />
                        </div>
                      ) : (
                        <div className="flex-1">
                          <span className="font-mono text-xs text-cream-dim/30 italic">Empty — click bench player to assign</span>
                        </div>
                      )}

                      {/* OVR badge */}
                      {player && (
                        <span className={cn('font-mono text-sm font-bold shrink-0', ovrColor(ovr))}>{ovr}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {currentLineup.length < 9 && (
              <div className="mt-3 px-3 py-2 bg-gold/5 border border-gold/20 rounded-lg">
                <p className="font-mono text-xs text-gold/70">
                  ⚠ Lineup incomplete — {9 - currentLineup.length} spots empty. Use Auto-Fill or drag from bench.
                </p>
              </div>
            )}
          </Panel>

          {/* Bench / Available Players */}
          <div className="space-y-4">
            <Panel title={`Bench (${benchPlayers.length})`}>
              {benchPlayers.length === 0 ? (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-3">All position players are in the lineup</p>
              ) : (
                <div className="space-y-1.5">
                  {benchPlayers.map(p => {
                    const ovr = Math.round(evaluatePlayer(p));
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-navy-lighter/15 border border-navy-lighter/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs text-cream truncate">{getPlayerName(p)}</p>
                          <BatterGrades p={p} />
                        </div>
                        <span className="font-mono text-[10px] text-gold/60 shrink-0">{p.position}</span>
                        <span className={cn('font-mono text-xs font-bold shrink-0', ovrColor(ovr))}>{ovr}</span>
                        {selectedSpot !== null && (
                          <button
                            onClick={() => handleBenchToBatting(p.id, selectedSpot)}
                            className="text-[10px] font-mono text-gold border border-gold/40 px-2 py-0.5 rounded hover:bg-gold/10 transition-colors shrink-0"
                          >
                            → {selectedSpot + 1}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* Quick stats */}
            <Panel title="Order Analysis">
              {currentLineup.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const lineup3 = currentLineup.slice(0, 3).map(s => getPlayer(s.playerId)).filter(Boolean) as Player[];
                    const lineup456 = currentLineup.slice(3, 6).map(s => getPlayer(s.playerId)).filter(Boolean) as Player[];
                    const avgTop3OBP = lineup3.length
                      ? Math.round(lineup3.reduce((sum, p) => sum + p.batting.eye + p.batting.contact_R, 0) / lineup3.length)
                      : 0;
                    const avgCleanupPwr = lineup456.length
                      ? Math.round(lineup456.reduce((sum, p) => sum + p.batting.power_R, 0) / lineup456.length)
                      : 0;
                    const avgSpd = currentLineup.length
                      ? Math.round(currentLineup.map(s => getPlayer(s.playerId)).filter(Boolean).reduce((sum, p) => sum + p!.batting.speed, 0) / currentLineup.length)
                      : 0;
                    return (
                      <>
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-cream-dim/50">Top of order OBP</span>
                          <span className={cn('font-bold', avgTop3OBP >= 65 ? 'text-green-light' : avgTop3OBP >= 55 ? 'text-gold' : 'text-red-400')}>
                            {avgTop3OBP}
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-cream-dim/50">Cleanup power avg</span>
                          <span className={cn('font-bold', avgCleanupPwr >= 65 ? 'text-green-light' : avgCleanupPwr >= 50 ? 'text-gold' : 'text-red-400')}>
                            {avgCleanupPwr}
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-xs">
                          <span className="text-cream-dim/50">Team speed avg</span>
                          <span className={cn('font-bold', avgSpd >= 65 ? 'text-green-light' : avgSpd >= 50 ? 'text-gold' : 'text-red-400')}>
                            {avgSpd}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-2">Set lineup to see analysis</p>
              )}
            </Panel>
          </div>
        </div>
      )}

      {activeTab === 'pitching' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr,320px] gap-5">
          {/* Starting Rotation */}
          <div className="space-y-5">
            <Panel title={`Starting Rotation (${rotationPitchers.length}/5)`}>
              <div className="flex justify-between items-center mb-4">
                <p className="font-mono text-xs text-cream-dim/50">
                  {selectedRotSlot !== null
                    ? `SP${selectedRotSlot + 1} selected — click another slot to swap`
                    : 'Click two slots to swap • Click + to add from available'}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAutoFillRotation}
                  className={autoFilledPitching ? '!bg-green-700/30 !border-green-600/50 !text-green-400' : ''}
                >
                  {autoFilledPitching ? '✓ Filled!' : 'Auto-Fill (AI)'}
                </Button>
              </div>

              <div className="space-y-1.5">
                {Array.from({ length: 5 }, (_, i) => {
                  const pid = currentRotation[i];
                  const pitcher = pid ? getPlayer(pid) : null;
                  const ovr = pitcher ? Math.round(evaluatePlayer(pitcher)) : 0;
                  const isSelected = selectedRotSlot === i;
                  const startDayLabel = `SP${i + 1}`;
                  const aceDividerColors = ['border-gold/50', 'border-green-light/40', 'border-blue-400/30', 'border-cream-dim/20', 'border-cream-dim/10'];

                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={pid ? 0 : -1}
                      onClick={() => pid ? handleRotSlotClick(i) : undefined}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (pid) handleRotSlotClick(i); } }}
                      className={cn(
                        'w-full text-left rounded-lg border-l-2 border border-t-0 border-r-0 border-b-0 transition-all p-3',
                        aceDividerColors[i],
                        isSelected
                          ? 'bg-gold/20 border-gold/70 border ring-1 ring-gold/40'
                          : pitcher
                            ? 'bg-navy-lighter/20 border border-navy-lighter hover:border-gold/30 hover:bg-navy-lighter/40 cursor-pointer'
                            : 'bg-navy-lighter/5 border border-dashed border-navy-lighter/40 hover:border-gold/30',
                        !pid && 'cursor-default',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Slot label */}
                        <div className="w-12 text-center shrink-0">
                          <span className={cn(
                            'font-display text-sm font-bold uppercase',
                            i === 0 ? 'text-gold' : i === 1 ? 'text-green-light' : 'text-cream-dim/50',
                          )}>
                            {startDayLabel}
                          </span>
                          {i === 0 && <div className="font-mono text-[8px] text-gold/50">ACE</div>}
                          {i === 4 && <div className="font-mono text-[8px] text-cream-dim/30">#5</div>}
                        </div>

                        {pitcher ? (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-body text-sm text-cream font-semibold truncate">{getPlayerName(pitcher)}</span>
                              <span className="font-mono text-[10px] text-cream-dim/50">Age {pitcher.age}</span>
                              {isSelected && <span className="font-mono text-[10px] text-gold animate-pulse shrink-0">← selected</span>}
                            </div>
                            <PitcherGrades p={pitcher} />
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-2">
                            <span className="font-mono text-xs text-cream-dim/30 italic">Empty slot</span>
                            <span className="font-mono text-[10px] text-cream-dim/30">— assign from available pitchers →</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                          {pitcher && (
                            <span className={cn('font-mono text-sm font-bold', ovrColor(ovr))}>{ovr}</span>
                          )}
                          {pitcher && (
                            <button
                              onClick={e => { e.stopPropagation(); handleRemoveFromRotation(pid!); setSelectedRotSlot(null); }}
                              className="text-cream-dim/30 hover:text-red-400 transition-colors font-mono text-xs cursor-pointer"
                              title="Remove from rotation"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Bullpen */}
            <Panel title={`Bullpen (${bullpenPitchers.length})`}>
              <div className="flex justify-between items-center mb-3">
                <p className="font-mono text-xs text-cream-dim/50">Pitchers not in the starting rotation</p>
                <Button size="sm" variant="ghost" onClick={handleAutoFillBullpen}>Reset</Button>
              </div>
              {bullpenPitchers.length === 0 ? (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-3">All pitchers assigned to rotation</p>
              ) : (
                <div className="space-y-1.5">
                  {bullpenPitchers.map((p, i) => {
                    const ovr = Math.round(evaluatePlayer(p));
                    const role = bullpenRoles[i] ?? 'Reliever';
                    return (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-md bg-navy-lighter/15 border border-navy-lighter/30">
                        <div className="w-20 shrink-0">
                          <span className="font-mono text-[9px] text-cream-dim/50 uppercase">{role}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs text-cream truncate">{getPlayerName(p)}</p>
                          <PitcherGrades p={p} />
                        </div>
                        <span className={cn('font-mono text-xs font-bold shrink-0', ovrColor(ovr))}>{ovr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Available pitchers to add to rotation */}
          <Panel title={`Available Starters (${bullpenPitchers.length})`}>
            <p className="font-mono text-xs text-cream-dim/50 mb-3">
              {currentRotation.length >= 5 ? 'Rotation full — remove a starter to swap' : 'Click + to add to rotation (max 5)'}
            </p>
            {pitchers.length === 0 ? (
              <p className="font-mono text-xs text-cream-dim/40 text-center py-3">No pitchers on roster</p>
            ) : bullpenPitchers.length === 0 ? (
              <p className="font-mono text-xs text-green-light/60 text-center py-3">All pitchers assigned to rotation</p>
            ) : (
              <div className="space-y-1.5">
                {[...bullpenPitchers]
                  .sort((a, b) =>
                    (b.pitching.stuff + b.pitching.movement + b.pitching.control) -
                    (a.pitching.stuff + a.pitching.movement + a.pitching.control)
                  )
                  .map(p => {
                    const ovr = Math.round(evaluatePlayer(p));
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded-md border transition-all bg-navy-lighter/15 border-navy-lighter/30 hover:border-navy-lighter/60"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs text-cream truncate">{getPlayerName(p)}</p>
                          <PitcherGrades p={p} />
                        </div>
                        <span className={cn('font-mono text-xs font-bold shrink-0', ovrColor(ovr))}>{ovr}</span>
                        <button
                          onClick={() => handleAddToRotation(p.id)}
                          disabled={currentRotation.length >= 5}
                          className={cn(
                            'font-mono text-[10px] border px-2 py-0.5 rounded transition-colors shrink-0',
                            currentRotation.length >= 5
                              ? 'text-cream-dim/20 border-navy-lighter/20 cursor-not-allowed'
                              : 'text-green-light border-green-light/40 hover:bg-green-light/10 cursor-pointer',
                          )}
                        >
                          + Add
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Staff summary */}
            <div className="mt-4 pt-3 border-t border-navy-lighter/30 space-y-1.5">
              <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider mb-2">Staff Summary</p>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-cream-dim/50">Starters</span>
                <span className="text-cream">{currentRotation.length} / 5</span>
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-cream-dim/50">Bullpen</span>
                <span className="text-cream">{bullpenPitchers.length}</span>
              </div>
              {currentRotation.length > 0 && (() => {
                const ace = getPlayer(currentRotation[0]);
                if (!ace) return null;
                const aceOvr = Math.round(evaluatePlayer(ace));
                return (
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-cream-dim/50">Ace OVR</span>
                    <span className={ovrColor(aceOvr)}>{aceOvr}</span>
                  </div>
                );
              })()}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
