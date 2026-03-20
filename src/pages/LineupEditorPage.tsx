import { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { LineupBuilder } from '@/engine/ai/LineupBuilder.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { computeFormSummary } from '@/engine/performance/HotColdEngine.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { LineupSpot } from '@/engine/types/team.ts';

const BATTING_SPOT_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const BATTING_SPOT_ROLES = ['Leadoff', 'Contact', 'Best Hitter', 'Cleanup', 'Power #2', 'Middle', 'Bottom', 'Bottom', 'Flex/P'];
const ROLE_COLORS = [
  'text-yellow-300', 'text-blue-300', 'text-gold', 'text-red-400', 'text-orange-400',
  'text-cream-dim', 'text-cream-dim/60', 'text-cream-dim/60', 'text-cream-dim/40',
];

function ovrColor(ovr: number) {
  if (ovr >= 75) return 'text-gold';
  if (ovr >= 60) return 'text-green-light';
  if (ovr >= 45) return 'text-cream';
  return 'text-red-400';
}

type DragSource =
  | { zone: 'lineup'; idx: number }
  | { zone: 'bench'; playerId: string }
  | { zone: 'rotation'; idx: number }
  | { zone: 'bullpen'; playerId: string };

function FormDot({ status }: { status: string }) {
  const cls =
    status === 'hot' ? 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.7)]' :
    status === 'warm' ? 'bg-yellow-400' :
    status === 'cool' ? 'bg-blue-400/60' :
    status === 'cold' ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.7)]' :
    'bg-cream-dim/15';
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', cls)} title={`Form: ${status}`} />;
}

function Pip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="font-mono text-[10px]">
      <span className="text-cream-dim/40">{label}</span>
      <span className="text-cream-dim/70 ml-0.5">{value}</span>
    </span>
  );
}

export function LineupEditorPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, reorderLineup: _reorderLineup, setRotation: _setRotation, setBullpen: _setBullpen } = useFranchiseStore();
  const { playerStats } = useStatsStore();

  const [autoFilledBatting, setAutoFilledBatting] = useState(false);
  const [autoFilledPitching, setAutoFilledPitching] = useState(false);
  const [activeTab, setActiveTab] = useState<'batting' | 'pitching'>('batting');
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  const [selectedRotSlot, setSelectedRotSlot] = useState<number | null>(null);
  const [dragSrc, setDragSrc] = useState<DragSource | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setSavedAt(Date.now());
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedAt(null), 2500);
  }, []);

  // Wrapped save actions that trigger the saved indicator
  const reorderLineup = useCallback((...args: Parameters<typeof _reorderLineup>) => {
    _reorderLineup(...args); flashSaved();
  }, [_reorderLineup, flashSaved]);
  const setRotation = useCallback((...args: Parameters<typeof _setRotation>) => {
    _setRotation(...args); flashSaved();
  }, [_setRotation, flashSaved]);
  const setBullpen = useCallback((...args: Parameters<typeof _setBullpen>) => {
    _setBullpen(...args); flashSaved();
  }, [_setBullpen, flashSaved]);
  const [dragOverLineup, setDragOverLineup] = useState<number | null>(null);
  const [dragOverRotation, setDragOverRotation] = useState<number | null>(null);

  const userTeam = useMemo(
    () => (engine && userTeamId ? engine.getTeam(userTeamId) : null),
    [engine, userTeamId],
  );

  const formMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!userTeam) return map;
    for (const player of userTeam.roster.players) {
      const stats = playerStats[player.id];
      const form = computeFormSummary(
        player.id,
        stats?.gameLog ?? [],
        player.position,
        stats?.batting.ab ? { ab: stats.batting.ab, h: stats.batting.h, bb: stats.batting.bb, hr: stats.batting.hr } : undefined,
        stats?.pitching.ip ? { ip: stats.pitching.ip / 3, er: stats.pitching.er, bb: stats.pitching.bb, so: stats.pitching.so } : undefined,
      );
      map.set(player.id, form.status);
    }
    return map;
  }, [userTeam, playerStats]);

  if (!season || !engine || !userTeamId || !userTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const roster = userTeam.roster.players;
  const currentLineup: LineupSpot[] = userTeam.lineup ?? [];
  const currentRotation: string[] = userTeam.rotation ?? [];

  const pitchers = roster.filter(p => p.position === 'P');
  const positionPlayers = roster.filter(p => p.position !== 'P');
  const lineupIds = new Set(currentLineup.map(s => s.playerId));
  const benchPlayers = positionPlayers.filter(p => !lineupIds.has(p.id));
  const rotationSet = new Set(currentRotation);
  const bullpenPitchers = pitchers.filter(p => !rotationSet.has(p.id));

  const getPlayerById = (id: string) => roster.find(p => p.id === id);

  const getBatterStats = (id: string) => {
    const s = playerStats[id]?.batting;
    if (!s || !s.ab) return null;
    return { ba: (s.h / s.ab).toFixed(3).replace('0.', '.'), hr: s.hr, rbi: s.rbi };
  };

  const getPitcherStats = (id: string) => {
    const s = playerStats[id]?.pitching;
    if (!s || !s.ip) return null;
    const ip = s.ip / 3;
    return { era: ((s.er / ip) * 9).toFixed(2), w: s.wins, l: s.losses, k: s.so };
  };

  // ── Click-to-swap (batting) ──
  const handleSpotClick = (idx: number) => {
    if (selectedSpot === null) { setSelectedSpot(idx); return; }
    if (selectedSpot === idx) { setSelectedSpot(null); return; }
    const nl = [...currentLineup];
    const a = nl[selectedSpot], b = nl[idx];
    if (a && b) { nl[selectedSpot] = b; nl[idx] = a; reorderLineup(userTeamId, nl); }
    setSelectedSpot(null);
  };

  const handleBenchToBatting = (playerId: string, spotIdx: number) => {
    const nl = [...currentLineup];
    nl[spotIdx] = { playerId, position: roster.find(p => p.id === playerId)?.position ?? 'DH' };
    reorderLineup(userTeamId, nl);
    setSelectedSpot(null);
  };

  // ── Drag-and-drop (batting) ──
  const handleLineupDrop = (targetIdx: number) => {
    if (!dragSrc) return;
    if (dragSrc.zone === 'lineup' && dragSrc.idx !== targetIdx) {
      const nl = [...currentLineup];
      const a = nl[dragSrc.idx], b = nl[targetIdx];
      if (a) nl[targetIdx] = a;
      if (b) nl[dragSrc.idx] = b;
      else nl.splice(dragSrc.idx, 1);
      reorderLineup(userTeamId, nl.filter(Boolean));
    } else if (dragSrc.zone === 'bench') {
      handleBenchToBatting(dragSrc.playerId, targetIdx);
    }
    setDragSrc(null); setDragOverLineup(null); setSelectedSpot(null);
  };

  // ── Click-to-swap (rotation) ──
  const handleRotSlotClick = (idx: number) => {
    if (selectedRotSlot === null) { setSelectedRotSlot(idx); return; }
    if (selectedRotSlot === idx) { setSelectedRotSlot(null); return; }
    const nr = [...currentRotation];
    const a = nr[selectedRotSlot], b = nr[idx];
    if (a !== undefined && b !== undefined) { nr[selectedRotSlot] = b; nr[idx] = a; setRotation(userTeamId, nr); }
    setSelectedRotSlot(null);
  };

  // ── Drag-and-drop (rotation) ──
  const handleRotationDrop = (targetIdx: number) => {
    if (!dragSrc) return;
    if (dragSrc.zone === 'rotation' && dragSrc.idx !== targetIdx) {
      const nr = [...currentRotation];
      const a = nr[dragSrc.idx], b = nr[targetIdx];
      if (a !== undefined && b !== undefined) { nr[dragSrc.idx] = b; nr[targetIdx] = a; setRotation(userTeamId, nr); }
    } else if (dragSrc.zone === 'bullpen' && currentRotation.length < 5) {
      setRotation(userTeamId, [...currentRotation, dragSrc.playerId]);
    }
    setDragSrc(null); setDragOverRotation(null); setSelectedRotSlot(null);
  };

  const handleAddToRotation = (playerId: string) => {
    if (currentRotation.length >= 5) return;
    setRotation(userTeamId, [...currentRotation, playerId]);
  };

  const handleRemoveFromRotation = (playerId: string) => {
    setRotation(userTeamId, currentRotation.filter(id => id !== playerId));
  };

  const handleAutoFillBatting = () => {
    reorderLineup(userTeamId, LineupBuilder.buildLineup(userTeam));
    setAutoFilledBatting(true);
    setTimeout(() => setAutoFilledBatting(false), 1500);
  };

  const handleAutoFillRotation = () => {
    const sorted = [...pitchers].sort((a, b) =>
      (b.pitching.stuff + b.pitching.movement + b.pitching.control) -
      (a.pitching.stuff + a.pitching.movement + a.pitching.control));
    setRotation(userTeamId, sorted.slice(0, 5).map(p => p.id));
    setAutoFilledPitching(true);
    setTimeout(() => setAutoFilledPitching(false), 1500);
  };

  const handleAutoFillBullpen = () => {
    const rotSet = new Set(currentRotation);
    setBullpen(userTeamId, pitchers.filter(p => !rotSet.has(p.id)).map(p => p.id));
  };

  const bullpenRoles = ['Closer', 'Setup', 'Long Relief', 'Middle Relief', 'Spot Starter'];
  const isDragging = dragSrc !== null;

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
          {savedAt !== null && (
            <span className="font-mono text-xs text-green-light/70 flex items-center gap-1.5 transition-opacity duration-300">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-light animate-pulse" />
              Saved
            </span>
          )}
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

      {/* Drag hint tooltip */}
      {isDragging && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy-light border border-gold/50 rounded-lg px-4 py-2 font-mono text-xs text-gold shadow-xl pointer-events-none">
          Drop on a slot to place
        </div>
      )}

      {activeTab === 'batting' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
          <Panel title={`Batting Order (${currentLineup.length}/9)`}>
            <div className="flex justify-between items-center mb-4">
              <p className="font-mono text-[10px] text-cream-dim/40 flex items-center gap-2">
                <span className="border border-cream-dim/20 rounded px-1.5 py-0.5 font-mono">⠿ drag</span>
                <span>or click two spots to swap</span>
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
                const player = spot ? getPlayerById(spot.playerId) : null;
                const ovr = player ? Math.round(evaluatePlayer(player)) : 0;
                const isSelected = selectedSpot === i;
                const isSrcSlot = dragSrc?.zone === 'lineup' && (dragSrc as { zone: 'lineup'; idx: number }).idx === i;
                const isDropTarget = dragOverLineup === i && isDragging && !isSrcSlot;
                const stats = player ? getBatterStats(player.id) : null;
                const formStatus = player ? (formMap.get(player.id) ?? 'neutral') : 'neutral';

                return (
                  <div
                    key={i}
                    draggable={!!player}
                    onDragStart={player ? () => { setDragSrc({ zone: 'lineup', idx: i }); setSelectedSpot(null); } : undefined}
                    onDragOver={e => { e.preventDefault(); setDragOverLineup(i); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverLineup(null); }}
                    onDrop={e => { e.preventDefault(); handleLineupDrop(i); }}
                    onDragEnd={() => { setDragSrc(null); setDragOverLineup(null); }}
                    onClick={() => handleSpotClick(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSpotClick(i); } }}
                    className={cn(
                      'w-full text-left rounded-lg border transition-all p-3 select-none',
                      isSrcSlot && 'opacity-40',
                      isDropTarget
                        ? 'border-gold bg-gold/15 shadow-[0_0_0_2px_rgba(212,168,67,0.25)]'
                        : isSelected
                          ? 'bg-gold/20 border-gold/70 ring-1 ring-gold/40'
                          : player
                            ? 'bg-navy-lighter/20 border-navy-lighter hover:border-gold/30 hover:bg-navy-lighter/35 cursor-grab active:cursor-grabbing'
                            : 'bg-navy-lighter/5 border-dashed border-navy-lighter/40 hover:border-gold/30 cursor-pointer',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Position number + drag handle */}
                      <div className="w-10 flex flex-col items-center shrink-0">
                        {player && <span className="font-mono text-cream-dim/10 text-sm select-none leading-none">⠿</span>}
                        <span className="font-display text-xl font-bold text-cream-dim/25 leading-tight">{i + 1}</span>
                        <span className={cn('font-mono text-[8px] uppercase tracking-wide', ROLE_COLORS[i])}>{BATTING_SPOT_LABELS[i]}</span>
                      </div>

                      {/* Role label */}
                      <div className="w-14 shrink-0 hidden sm:block">
                        <div className="font-mono text-[9px] text-cream-dim/35">{BATTING_SPOT_ROLES[i]}</div>
                      </div>

                      {/* Player info */}
                      {player ? (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-body text-sm text-cream font-semibold truncate">{getPlayerName(player)}</span>
                            <span className="font-mono text-[10px] bg-navy-lighter px-1.5 py-0.5 rounded text-gold/60 shrink-0">
                              {spot?.position ?? player.position}
                            </span>
                            <FormDot status={formStatus} />
                            {isSelected && <span className="font-mono text-[10px] text-gold animate-pulse shrink-0">← selected</span>}
                          </div>
                          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                            {stats ? (
                              <><Pip label="BA " value={stats.ba} /><Pip label="HR " value={stats.hr} /><Pip label="RBI " value={stats.rbi} /></>
                            ) : (
                              <span className="font-mono text-[10px] text-cream-dim/25">
                                CON {player.batting.contact_R} · PWR {player.batting.power_R} · EYE {player.batting.eye}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <span className="font-mono text-xs text-cream-dim/25 italic">
                            {isDropTarget ? 'Drop here' : (selectedSpot !== null || dragSrc?.zone === 'bench') ? 'Drop or click bench player →' : 'Empty'}
                          </span>
                        </div>
                      )}

                      {player && <span className={cn('font-mono text-sm font-bold shrink-0', ovrColor(ovr))}>{ovr}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {currentLineup.length < 9 && (
              <div className="mt-3 px-3 py-2 bg-gold/5 border border-gold/20 rounded-lg">
                <p className="font-mono text-xs text-gold/70">
                  ⚠ {9 - currentLineup.length} spot{9 - currentLineup.length !== 1 ? 's' : ''} empty — drag from bench or click to select then click a bench player
                </p>
              </div>
            )}
          </Panel>

          {/* Bench */}
          <div className="space-y-4">
            <Panel title={`Bench (${benchPlayers.length})`}>
              <p className="font-mono text-[10px] text-cream-dim/40 mb-3">
                {selectedSpot !== null
                  ? `Spot #${selectedSpot + 1} selected — click to assign`
                  : 'Drag into lineup order'}
              </p>
              {benchPlayers.length === 0 ? (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-3">All position players in lineup</p>
              ) : (
                <div className="space-y-1.5">
                  {benchPlayers.map(p => {
                    const ovr = Math.round(evaluatePlayer(p));
                    const stats = getBatterStats(p.id);
                    const formStatus = formMap.get(p.id) ?? 'neutral';
                    const isSrc = dragSrc?.zone === 'bench' && (dragSrc as { zone: 'bench'; playerId: string }).playerId === p.id;
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => { setDragSrc({ zone: 'bench', playerId: p.id }); setSelectedSpot(null); }}
                        onDragEnd={() => { setDragSrc(null); setDragOverLineup(null); }}
                        onClick={() => selectedSpot !== null && handleBenchToBatting(p.id, selectedSpot)}
                        className={cn(
                          'flex items-center gap-2 p-2.5 rounded-md border transition-all',
                          isSrc ? 'opacity-40 border-gold/30 bg-navy-lighter/15' :
                          selectedSpot !== null
                            ? 'bg-gold/10 border-gold/30 cursor-pointer hover:bg-gold/20'
                            : 'bg-navy-lighter/15 border-navy-lighter/30 cursor-grab active:cursor-grabbing hover:border-navy-lighter/60',
                        )}
                      >
                        <span className="text-cream-dim/15 font-mono text-sm select-none">⠿</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-body text-xs text-cream truncate">{getPlayerName(p)}</p>
                            <FormDot status={formStatus} />
                          </div>
                          <div className="flex gap-2 mt-0.5">
                            {stats
                              ? <><Pip label="BA " value={stats.ba} /><Pip label="HR " value={stats.hr} /></>
                              : <span className="font-mono text-[10px] text-cream-dim/25">CON {p.batting.contact_R} PWR {p.batting.power_R}</span>
                            }
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-gold/50 shrink-0">{p.position}</span>
                        <span className={cn('font-mono text-xs font-bold shrink-0', ovrColor(ovr))}>{ovr}</span>
                        {selectedSpot !== null && (
                          <span className="font-mono text-[10px] text-gold border border-gold/40 px-1.5 py-0.5 rounded shrink-0">→ {selectedSpot + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Order Analysis">
              {currentLineup.length > 0 ? (() => {
                const top3 = currentLineup.slice(0, 3).map(s => getPlayerById(s.playerId)).filter(Boolean) as Player[];
                const mid3 = currentLineup.slice(3, 6).map(s => getPlayerById(s.playerId)).filter(Boolean) as Player[];
                const avgOBP = top3.length ? Math.round(top3.reduce((s, p) => s + p.batting.eye + p.batting.contact_R, 0) / top3.length) : 0;
                const avgPwr = mid3.length ? Math.round(mid3.reduce((s, p) => s + p.batting.power_R, 0) / mid3.length) : 0;
                const avgSpd = currentLineup.length
                  ? Math.round(currentLineup.map(s => getPlayerById(s.playerId)).filter(Boolean).reduce((s, p) => s + p!.batting.speed, 0) / currentLineup.length)
                  : 0;
                const hotCount = currentLineup.filter(s => { const st = formMap.get(s.playerId); return st === 'hot' || st === 'warm'; }).length;
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-cream-dim/50">Top 3 OBP rating</span>
                      <span className={cn('font-bold', avgOBP >= 65 ? 'text-green-light' : avgOBP >= 55 ? 'text-gold' : 'text-red-400')}>{avgOBP}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-cream-dim/50">Cleanup power avg</span>
                      <span className={cn('font-bold', avgPwr >= 65 ? 'text-green-light' : avgPwr >= 50 ? 'text-gold' : 'text-red-400')}>{avgPwr}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-cream-dim/50">Team speed avg</span>
                      <span className={cn('font-bold', avgSpd >= 65 ? 'text-green-light' : avgSpd >= 50 ? 'text-gold' : 'text-red-400')}>{avgSpd}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-cream-dim/50">Hot starters</span>
                      <span className={cn('font-bold', hotCount >= 3 ? 'text-orange-400' : hotCount >= 1 ? 'text-yellow-400' : 'text-cream-dim/30')}>
                        {hotCount} / {currentLineup.length}
                      </span>
                    </div>
                  </div>
                );
              })() : (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-2">Set lineup to see analysis</p>
              )}
            </Panel>
          </div>
        </div>
      )}

      {activeTab === 'pitching' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
          <div className="space-y-5">
            <Panel title={`Starting Rotation (${currentRotation.length}/5)`}>
              <div className="flex justify-between items-center mb-4">
                <p className="font-mono text-[10px] text-cream-dim/40 flex items-center gap-2">
                  <span className="border border-cream-dim/20 rounded px-1.5 py-0.5 font-mono">⠿ drag</span>
                  <span>or click two slots to swap</span>
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
                  const pitcher = pid ? getPlayerById(pid) : null;
                  const ovr = pitcher ? Math.round(evaluatePlayer(pitcher)) : 0;
                  const isSelected = selectedRotSlot === i;
                  const isSrc = dragSrc?.zone === 'rotation' && (dragSrc as { zone: 'rotation'; idx: number }).idx === i;
                  const isDropTarget = dragOverRotation === i && isDragging && !isSrc;
                  const pitchStats = pitcher ? getPitcherStats(pitcher.id) : null;
                  const formStatus = pitcher ? (formMap.get(pitcher.id) ?? 'neutral') : 'neutral';

                  return (
                    <div
                      key={i}
                      draggable={!!pitcher}
                      onDragStart={pitcher ? () => { setDragSrc({ zone: 'rotation', idx: i }); setSelectedRotSlot(null); } : undefined}
                      onDragOver={e => { e.preventDefault(); setDragOverRotation(i); }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverRotation(null); }}
                      onDrop={e => { e.preventDefault(); handleRotationDrop(i); }}
                      onDragEnd={() => { setDragSrc(null); setDragOverRotation(null); }}
                      onClick={() => pitcher && handleRotSlotClick(i)}
                      role="button"
                      tabIndex={pitcher ? 0 : -1}
                      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && pitcher) { e.preventDefault(); handleRotSlotClick(i); } }}
                      className={cn(
                        'w-full text-left rounded-lg border transition-all p-3 select-none',
                        isSrc && 'opacity-40',
                        isDropTarget
                          ? 'border-gold bg-gold/15'
                          : isSelected
                            ? 'bg-gold/20 border-gold/70 ring-1 ring-gold/40'
                            : pitcher
                              ? 'bg-navy-lighter/20 border-navy-lighter hover:border-gold/30 cursor-grab active:cursor-grabbing'
                              : 'bg-navy-lighter/5 border-dashed border-navy-lighter/40 hover:border-gold/30 cursor-default',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 flex flex-col items-center shrink-0">
                          {pitcher && <span className="font-mono text-cream-dim/10 text-sm select-none leading-none">⠿</span>}
                          <span className={cn('font-display text-sm font-bold uppercase leading-tight',
                            i === 0 ? 'text-gold' : i === 1 ? 'text-green-light' : 'text-cream-dim/50')}>
                            SP{i + 1}
                          </span>
                          {i === 0 && <div className="font-mono text-[8px] text-gold/40">ACE</div>}
                        </div>

                        {pitcher ? (
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-body text-sm text-cream font-semibold truncate">{getPlayerName(pitcher)}</span>
                              <FormDot status={formStatus} />
                              {isSelected && <span className="font-mono text-[10px] text-gold animate-pulse shrink-0">← selected</span>}
                            </div>
                            <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                              {pitchStats ? (
                                <><Pip label="ERA " value={pitchStats.era} /><Pip label="W-L " value={`${pitchStats.w}-${pitchStats.l}`} /><Pip label="K " value={pitchStats.k} /></>
                              ) : (
                                <span className="font-mono text-[10px] text-cream-dim/25">
                                  STF {pitcher.pitching.stuff} · MOV {pitcher.pitching.movement} · CTL {pitcher.pitching.control}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1">
                            <span className="font-mono text-xs text-cream-dim/25 italic">
                              {isDropTarget ? 'Drop pitcher here' : 'Empty — drag from available →'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                          {pitcher && <span className={cn('font-mono text-sm font-bold', ovrColor(ovr))}>{ovr}</span>}
                          {pitcher && (
                            <button
                              onClick={e => { e.stopPropagation(); handleRemoveFromRotation(pid!); setSelectedRotSlot(null); }}
                              className="text-cream-dim/25 hover:text-red-400 transition-colors font-mono text-xs cursor-pointer"
                              title="Remove from rotation"
                            >✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title={`Bullpen (${bullpenPitchers.length})`}>
              <div className="flex justify-between items-center mb-3">
                <p className="font-mono text-xs text-cream-dim/50">Pitchers not in starting rotation</p>
                <Button size="sm" variant="ghost" onClick={handleAutoFillBullpen}>Reset</Button>
              </div>
              {bullpenPitchers.length === 0 ? (
                <p className="font-mono text-xs text-cream-dim/40 text-center py-3">All pitchers assigned to rotation</p>
              ) : (
                <div className="space-y-1.5">
                  {bullpenPitchers.map((p, i) => {
                    const ovr = Math.round(evaluatePlayer(p));
                    const pitchStats = getPitcherStats(p.id);
                    const formStatus = formMap.get(p.id) ?? 'neutral';
                    return (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-md bg-navy-lighter/15 border border-navy-lighter/30">
                        <div className="w-20 shrink-0">
                          <span className="font-mono text-[9px] text-cream-dim/50 uppercase">{bullpenRoles[i] ?? 'Reliever'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-body text-xs text-cream truncate">{getPlayerName(p)}</p>
                            <FormDot status={formStatus} />
                          </div>
                          <div className="flex gap-2 mt-0.5">
                            {pitchStats
                              ? <><Pip label="ERA " value={pitchStats.era} /><Pip label="K " value={pitchStats.k} /></>
                              : <span className="font-mono text-[10px] text-cream-dim/25">STF {p.pitching.stuff} CTL {p.pitching.control}</span>
                            }
                          </div>
                        </div>
                        <span className={cn('font-mono text-xs font-bold shrink-0', ovrColor(ovr))}>{ovr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Available starters sidebar */}
          <Panel title={`Available (${bullpenPitchers.length})`}>
            <p className="font-mono text-xs text-cream-dim/50 mb-3">
              {currentRotation.length >= 5 ? 'Rotation full — remove a SP to swap' : 'Drag to rotation slot or click + Add'}
            </p>
            {pitchers.length === 0 ? (
              <p className="font-mono text-xs text-cream-dim/40 text-center py-3">No pitchers on roster</p>
            ) : bullpenPitchers.length === 0 ? (
              <p className="font-mono text-xs text-green-light/60 text-center py-3">All pitchers in rotation</p>
            ) : (
              <div className="space-y-1.5">
                {[...bullpenPitchers]
                  .sort((a, b) => (b.pitching.stuff + b.pitching.movement + b.pitching.control) - (a.pitching.stuff + a.pitching.movement + a.pitching.control))
                  .map(p => {
                    const ovr = Math.round(evaluatePlayer(p));
                    const pitchStats = getPitcherStats(p.id);
                    const isSrc = dragSrc?.zone === 'bullpen' && (dragSrc as { zone: 'bullpen'; playerId: string }).playerId === p.id;
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => setDragSrc({ zone: 'bullpen', playerId: p.id })}
                        onDragEnd={() => { setDragSrc(null); setDragOverRotation(null); }}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-md border transition-all cursor-grab active:cursor-grabbing',
                          isSrc ? 'opacity-40 border-gold/30' : 'bg-navy-lighter/15 border-navy-lighter/30 hover:border-navy-lighter/60',
                        )}
                      >
                        <span className="text-cream-dim/15 font-mono text-sm select-none">⠿</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs text-cream truncate">{getPlayerName(p)}</p>
                          <div className="flex gap-2 mt-0.5">
                            {pitchStats
                              ? <><Pip label="ERA " value={pitchStats.era} /><Pip label="K " value={pitchStats.k} /></>
                              : <span className="font-mono text-[10px] text-cream-dim/25">STF {p.pitching.stuff} CTL {p.pitching.control}</span>
                            }
                          </div>
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
                        >+ Add</button>
                      </div>
                    );
                  })}
              </div>
            )}

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
                const ace = getPlayerById(currentRotation[0]);
                if (!ace) return null;
                return (
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-cream-dim/50">Ace OVR</span>
                    <span className={ovrColor(Math.round(evaluatePlayer(ace)))}>{Math.round(evaluatePlayer(ace))}</span>
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
