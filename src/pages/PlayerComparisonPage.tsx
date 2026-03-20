import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import {
  calcBattingAdvanced, calcPitchingAdvanced, deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT,
  fmtAvg, fmtStat,
} from '@/engine/stats/AdvancedStats.ts';
import { battingAvg, onBasePct, slugging, era, whip, formatIP } from '@/engine/types/stats.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';

// ── Palette helpers ──────────────────────────────────────────
const SLOT_COLORS = [
  { border: 'border-gold/60', text: 'text-gold', bg: 'bg-gold/10', bar: 'bg-gold', badge: 'bg-gold/20 text-gold' },
  { border: 'border-blue-400/60', text: 'text-blue-400', bg: 'bg-blue-400/10', bar: 'bg-blue-400', badge: 'bg-blue-400/20 text-blue-400' },
  { border: 'border-emerald-400/60', text: 'text-emerald-400', bg: 'bg-emerald-400/10', bar: 'bg-emerald-400', badge: 'bg-emerald-400/20 text-emerald-400' },
];

// ── Comparison bar row ──────────────────────────────────────
function CompareBar({ label, values, max = 100 }: { label: string; values: (number | null)[]; max?: number }) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-cream-dim/70 w-28 shrink-0">{label}</span>
        <div className="flex gap-2">
          {values.map((v, i) => (
            <span key={i} className={cn('font-mono text-xs font-bold w-8 text-right', v === null ? 'text-cream-dim/30' : SLOT_COLORS[i]?.text)}>
              {v === null ? '—' : v}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-1 items-center">
        <div className="w-28 shrink-0" />
        <div className="flex-1 flex flex-col gap-0.5">
          {values.map((v, i) => {
            if (v === null) return <div key={i} className="h-1.5 bg-navy-lighter/20 rounded-full" />;
            const maxV = Math.max(...(values.filter(x => x !== null) as number[]));
            const isMax = maxV > 0 && v === maxV && values.filter(x => x !== null && x === maxV).length === 1;
            return (
              <div key={i} className="h-1.5 bg-navy-lighter/30 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', SLOT_COLORS[i]?.bar, isMax && 'opacity-100', !isMax && 'opacity-60')}
                  style={{ width: `${Math.min(100, (v / max) * 100)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Stat row (text only, no bar) ─────────────────────────────
function StatRow({ label, values, highlight }: { label: string; values: (string | null)[]; highlight?: boolean[] }) {
  return (
    <div className={cn('flex items-center py-1.5 border-b border-navy-lighter/20 last:border-0', )}>
      <span className="font-mono text-xs text-cream-dim/60 w-28 shrink-0">{label}</span>
      {values.map((v, i) => {
        const isTop = highlight?.[i];
        return (
          <span key={i} className={cn(
            'font-mono text-xs flex-1 text-center',
            v === null ? 'text-cream-dim/25' : isTop ? cn('font-bold', SLOT_COLORS[i]?.text) : 'text-cream',
          )}>
            {v ?? '—'}
          </span>
        );
      })}
    </div>
  );
}

// ── Section header ───────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <div className="h-px flex-1 bg-navy-lighter/40" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-cream-dim/50 shrink-0">{title}</span>
      <div className="h-px flex-1 bg-navy-lighter/40" />
    </div>
  );
}

// ── Player slot picker ──────────────────────────────────────
function PlayerSlot({
  idx,
  selectedId,
  players,
  onSelect,
  onClear,
}: {
  idx: number;
  selectedId: string | null;
  players: { id: string; name: string; pos: string; teamAbbr: string; ovr: number }[];
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const color = SLOT_COLORS[idx]!;
  const selected = selectedId ? players.find(p => p.id === selectedId) : null;

  const filtered = useMemo(() => {
    if (!query.trim()) return players.slice(0, 12);
    const q = query.toLowerCase();
    return players.filter(p =>
      p.name.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q) || p.teamAbbr.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [query, players]);

  return (
    <div className={cn('relative border rounded-xl p-3 transition-all', selected ? color.border : 'border-navy-lighter/40 border-dashed')}>
      {selected ? (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={cn('font-body text-sm font-bold', color.text)}>{selected.name}</p>
            <p className="font-mono text-xs text-cream-dim">{selected.pos} · {selected.teamAbbr} · OVR {selected.ovr}</p>
          </div>
          <button
            onClick={onClear}
            className="text-cream-dim/40 hover:text-red-400 text-sm font-mono transition-colors shrink-0"
            title="Remove player"
          >
            ✕
          </button>
        </div>
      ) : (
        <div>
          <p className="font-mono text-xs text-cream-dim/50 mb-1.5 uppercase tracking-wider">Player {idx + 1}</p>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search by name, position, or team…"
            className="w-full bg-navy-lighter/30 border border-navy-lighter/50 rounded px-2 py-1 font-mono text-xs text-cream placeholder-cream-dim/30 focus:outline-none focus:border-gold/40"
          />
          {open && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 border border-navy-lighter bg-navy rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onMouseDown={() => { onSelect(p.id); setQuery(''); setOpen(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-navy-lighter/40 transition-colors text-left"
                >
                  <span className="font-body text-xs text-cream truncate">{p.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-cream-dim">{p.teamAbbr}</span>
                    <span className="font-mono text-[10px] text-gold">{p.pos}</span>
                    <span className="font-mono text-[10px] text-cream-dim font-bold">{p.ovr}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini radar polygon (SVG) ────────────────────────────────
function RadarChart({ datasets }: { datasets: { label: string; values: number[] }[] }) {
  const AXES = ['CON', 'PWR', 'EYE', 'SPD', 'DEF'];
  const N = AXES.length;
  const SIZE = 100;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 38;

  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, v: number) => {
    const r = (v / 100) * R;
    return { x: CX + r * Math.cos(angle(i)), y: CY + r * Math.sin(angle(i)) };
  };

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[200px] mx-auto">
      {/* Grid rings */}
      {gridLevels.map(lvl => {
        const pts = Array.from({ length: N }, (_, i) => pt(i, lvl));
        return (
          <polygon
            key={lvl}
            points={pts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        );
      })}
      {/* Axis lines */}
      {Array.from({ length: N }, (_, i) => {
        const outer = pt(i, 100);
        return <line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />;
      })}
      {/* Data polygons */}
      {datasets.map((ds, di) => {
        const pts = ds.values.map((v, i) => pt(i, v));
        const color = di === 0 ? 'rgba(212,168,67,0.55)' : di === 1 ? 'rgba(96,165,250,0.55)' : 'rgba(52,211,153,0.55)';
        const stroke = di === 0 ? '#d4a843' : di === 1 ? '#60a5fa' : '#34d399';
        return (
          <polygon
            key={di}
            points={pts.map(p => `${p.x},${p.y}`).join(' ')}
            fill={color}
            stroke={stroke}
            strokeWidth="1"
            fillOpacity="0.35"
          />
        );
      })}
      {/* Axis labels */}
      {AXES.map((ax, i) => {
        const pos = pt(i, 115);
        return (
          <text key={ax} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: '6px', fill: 'rgba(232,224,212,0.5)', fontFamily: 'IBM Plex Mono' }}>
            {ax}
          </text>
        );
      })}
    </svg>
  );
}

function PitcherRadarChart({ datasets }: { datasets: { label: string; values: number[] }[] }) {
  const AXES = ['STU', 'MOV', 'CTL', 'STA', 'VEL'];
  const N = AXES.length;
  const SIZE = 100;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 38;

  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2;
  const pt = (i: number, v: number) => {
    const r = (v / 100) * R;
    return { x: CX + r * Math.cos(angle(i)), y: CY + r * Math.sin(angle(i)) };
  };

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[200px] mx-auto">
      {[20,40,60,80,100].map(lvl => (
        <polygon key={lvl}
          points={Array.from({length:N},(_,i)=>pt(i,lvl)).map(p=>`${p.x},${p.y}`).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      ))}
      {Array.from({length:N},(_,i)=>pt(i,100)).map((outer,i)=>(
        <line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      ))}
      {datasets.map((ds, di) => {
        const pts = ds.values.map((v, i) => pt(i, v));
        const color = di===0?'rgba(212,168,67,0.55)':di===1?'rgba(96,165,250,0.55)':'rgba(52,211,153,0.55)';
        const stroke = di===0?'#d4a843':di===1?'#60a5fa':'#34d399';
        return <polygon key={di} points={pts.map(p=>`${p.x},${p.y}`).join(' ')} fill={color} stroke={stroke} strokeWidth="1" fillOpacity="0.35" />;
      })}
      {AXES.map((ax,i)=>{
        const pos=pt(i,115);
        return <text key={ax} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
          style={{fontSize:'6px',fill:'rgba(232,224,212,0.5)',fontFamily:'IBM Plex Mono'}}>{ax}</text>;
      })}
    </svg>
  );
}

// ── Win probability indicator (overall edge) ─────────────────
function EdgeBadge({ values }: { values: (number | null)[] }) {
  const valids = values.map((v, i) => ({ v, i })).filter(x => x.v !== null) as { v: number; i: number }[];
  if (valids.length < 2) return null;
  const max = valids.reduce((a, b) => a.v > b.v ? a : b);
  const min = valids.reduce((a, b) => a.v < b.v ? a : b);
  const diff = max.v - min.v;
  if (diff < 2) return <span className="font-mono text-xs text-cream-dim">Nearly equal players</span>;
  const color = SLOT_COLORS[max.i]!;
  const label = diff >= 15 ? 'Clear edge' : diff >= 8 ? 'Solid edge' : 'Slight edge';
  return (
    <span className={cn('font-mono text-xs px-2 py-0.5 rounded-full border', color.badge, color.border)}>
      {label}: Player {max.i + 1} (+{diff} OVR)
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────
export function PlayerComparisonPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { engine } = useFranchiseStore();
  const { getPlayerStats, leagueTotals } = useStatsStore();

  // Read initial slots from URL params (?p1=id&p2=id&p3=id)
  const [slots, setSlots] = useState<(string | null)[]>([
    searchParams.get('p1'),
    searchParams.get('p2'),
    searchParams.get('p3'),
  ]);

  // Sync slots → URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (slots[0]) params.p1 = slots[0];
    if (slots[1]) params.p2 = slots[1];
    if (slots[2]) params.p3 = slots[2];
    setSearchParams(params, { replace: true });
  }, [slots, setSearchParams]);

  const leagueCtx = useMemo(() => {
    const lt = leagueTotals;
    if (!lt || lt.gamesPlayed === 0) return DEFAULT_LEAGUE_CONTEXT;
    return deriveLeagueContext(
      lt.totalAB, lt.totalPA, lt.totalH, lt.totalDoubles, lt.totalTriples,
      lt.totalHR, lt.totalBB, lt.totalHBP, lt.totalSF, lt.totalSO,
      lt.totalRuns, lt.gamesPlayed, lt.totalER, lt.totalIP,
      (lt as typeof lt & { totalGameRuns?: number }).totalGameRuns
    );
  }, [leagueTotals]);

  // All players flat list for search
  const allPlayers = useMemo(() => {
    if (!engine) return [];
    return engine.getAllTeams().flatMap(team => {
      const abbr = team.abbreviation;
      return team.roster.players.map(p => ({
        id: p.id,
        name: getPlayerName(p),
        pos: p.position,
        teamAbbr: abbr,
        ovr: Math.round(evaluatePlayer(p)),
        player: p,
      }));
    }).sort((a, b) => b.ovr - a.ovr);
  }, [engine]);

  // Resolve full data for each slot
  const slotData = useMemo(() => slots.map(id => {
    if (!id || !engine) return null;
    const found = allPlayers.find(p => p.id === id);
    if (!found) return null;
    const ps = getPlayerStats(id);
    const team = engine.getAllTeams().find(t => t.roster.players.some(p => p.id === id));
    return {
      player: found.player,
      ps,
      teamAbbr: found.teamAbbr,
      teamName: team?.name ?? '',
      ovr: found.ovr,
    };
  }), [slots, allPlayers, engine, getPlayerStats]);

  const selectedCount = slots.filter(Boolean).length;

  // Check if all selected players are the same role
  const allPitchers = slotData.every(d => !d || d.player.position === 'P');
  const allBatters = slotData.every(d => !d || d.player.position !== 'P');
  const mixed = !allPitchers && !allBatters;

  if (!engine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-cream-dim mb-4">No franchise loaded.</p>
          <Button onClick={() => navigate('/')}>Back to Menu</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Compare Players</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Head-to-head ratings, stats, and advanced metrics
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
      </div>

      {/* Slot selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {slots.map((id, i) => (
          <PlayerSlot
            key={i}
            idx={i}
            selectedId={id}
            players={allPlayers.filter(p => !slots.some((sid, si) => si !== i && sid === p.id))}
            onSelect={pid => setSlots(prev => { const n = [...prev]; n[i] = pid; return n; })}
            onClear={() => setSlots(prev => { const n = [...prev]; n[i] = null; return n; })}
          />
        ))}
      </div>

      {selectedCount < 2 && (
        <Panel>
          <p className="font-mono text-cream-dim text-center py-10 text-sm">
            Select at least 2 players above to compare them side-by-side.
          </p>
        </Panel>
      )}

      {selectedCount >= 2 && (
        <>
          {/* Mixed role warning */}
          {mixed && (
            <div className="mb-4 px-4 py-2 rounded border border-gold/30 bg-gold/5 font-mono text-xs text-gold/70">
              Mixed pitchers and position players — some stat sections won't apply to all players.
            </div>
          )}

          {/* Column headers */}
          <div className="flex items-center mb-1 px-1">
            <span className="w-28 shrink-0" />
            {slotData.map((d, i) => d ? (
              <div key={i} className="flex-1 text-center">
                <p className={cn('font-body text-xs font-bold truncate', SLOT_COLORS[i]?.text)}>{getPlayerName(d.player)}</p>
                <p className="font-mono text-[10px] text-cream-dim">{d.player.position} · {d.teamAbbr}</p>
              </div>
            ) : null)}
          </div>

          {/* Overall OVR */}
          <Panel className="mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <span className="font-mono text-xs text-cream-dim uppercase tracking-wider">Overall</span>
              <EdgeBadge values={slotData.map(d => d?.ovr ?? null)} />
            </div>
            <CompareBar
              label="OVR"
              values={slotData.map(d => d?.ovr ?? null)}
              max={100}
            />

            {/* Radar chart for batter or pitcher */}
            {(allBatters || allPitchers) && (() => {
              const datasets = slotData
                .map((d, i) => {
                  if (!d) return null;
                  const p = d.player;
                  const vals = allBatters
                    ? [
                        Math.round((p.batting.contact_L + p.batting.contact_R) / 2),
                        Math.round((p.batting.power_L + p.batting.power_R) / 2),
                        p.batting.eye,
                        p.batting.speed,
                        Math.round(Object.values(p.fielding).reduce((s, f) => s + (f?.range ?? 50), 0) / Math.max(1, Object.values(p.fielding).length)),
                      ]
                    : [p.pitching.stuff, p.pitching.movement, p.pitching.control, p.pitching.stamina, p.pitching.velocity];
                  return { label: `Player ${i + 1}`, values: vals };
                })
                .filter(Boolean) as { label: string; values: number[] }[];

              return (
                <div className="mt-4 flex justify-center">
                  {allBatters ? <RadarChart datasets={datasets} /> : <PitcherRadarChart datasets={datasets} />}
                </div>
              );
            })()}
          </Panel>

          {/* Position player ratings */}
          {!allPitchers && (
            <Panel className="mb-4" title="Batting Ratings">
              <CompareBar label="Contact L" values={slotData.map(d => d && d.player.position !== 'P' ? d.player.batting.contact_L : null)} />
              <CompareBar label="Contact R" values={slotData.map(d => d && d.player.position !== 'P' ? d.player.batting.contact_R : null)} />
              <CompareBar label="Power L" values={slotData.map(d => d && d.player.position !== 'P' ? d.player.batting.power_L : null)} />
              <CompareBar label="Power R" values={slotData.map(d => d && d.player.position !== 'P' ? d.player.batting.power_R : null)} />
              <CompareBar label="Eye / BB" values={slotData.map(d => d && d.player.position !== 'P' ? d.player.batting.eye : null)} />
              <CompareBar label="Speed" values={slotData.map(d => d && d.player.position !== 'P' ? d.player.batting.speed : null)} />
              <CompareBar label="Gap Power" values={slotData.map(d => d && d.player.position !== 'P' ? d.player.batting.gap_power : null)} />
            </Panel>
          )}

          {/* Pitcher ratings */}
          {!allBatters && (
            <Panel className="mb-4" title="Pitching Ratings">
              <CompareBar label="Stuff" values={slotData.map(d => d && d.player.position === 'P' ? d.player.pitching.stuff : null)} />
              <CompareBar label="Movement" values={slotData.map(d => d && d.player.position === 'P' ? d.player.pitching.movement : null)} />
              <CompareBar label="Control" values={slotData.map(d => d && d.player.position === 'P' ? d.player.pitching.control : null)} />
              <CompareBar label="Stamina" values={slotData.map(d => d && d.player.position === 'P' ? d.player.pitching.stamina : null)} />
              <CompareBar label="Velocity" values={slotData.map(d => d && d.player.position === 'P' ? d.player.pitching.velocity : null)} />
            </Panel>
          )}

          {/* In-season stats */}
          {(() => {
            const hasStats = slotData.some(d => d?.ps);
            if (!hasStats) {
              return (
                <Panel className="mb-4">
                  <p className="font-mono text-xs text-cream-dim/50 text-center py-4">No in-season stats yet — stats appear after games are played.</p>
                </Panel>
              );
            }

            if (!allPitchers) {
              // Batting stats
              const getBA = (d: typeof slotData[number]) => d?.ps ? fmtAvg(battingAvg(d.ps.batting)) : null;
              const getOBP = (d: typeof slotData[number]) => d?.ps ? fmtAvg(onBasePct(d.ps.batting)) : null;
              const getSLG = (d: typeof slotData[number]) => d?.ps ? fmtAvg(slugging(d.ps.batting)) : null;
              const getOPS = (d: typeof slotData[number]) => {
                if (!d?.ps) return null;
                return fmtAvg(onBasePct(d.ps.batting) + slugging(d.ps.batting));
              };
              const getHR = (d: typeof slotData[number]) => d?.ps ? String(d.ps.batting.hr) : null;
              const getRBI = (d: typeof slotData[number]) => d?.ps ? String(d.ps.batting.rbi) : null;
              const getR = (d: typeof slotData[number]) => d?.ps ? String(d.ps.batting.r) : null;
              const getSB = (d: typeof slotData[number]) => d?.ps ? String(d.ps.batting.sb) : null;

              const advData = slotData.map(d => d?.ps ? calcBattingAdvanced(d.ps.batting, leagueCtx, d.ps.position) : null);
              const getWRC = (i: number) => advData[i] ? fmtStat(advData[i]!.wrcPlus, 0) : null;
              const getWAR = (i: number) => advData[i] ? fmtStat(advData[i]!.war, 1) : null;

              // Determine top for highlighting
              const topOf = (vals: (string | null)[]) => {
                const nums = vals.map(v => v !== null ? parseFloat(v) : -Infinity);
                const max = Math.max(...nums);
                return vals.map((_, i) => nums[i] === max && max !== -Infinity);
              };

              const baVals = slotData.map(getBA);
              const obpVals = slotData.map(getOBP);
              const slgVals = slotData.map(getSLG);
              const opsVals = slotData.map(getOPS);
              const hrVals = slotData.map(getHR);
              const rbiVals = slotData.map(getRBI);
              const rVals = slotData.map(getR);
              const sbVals = slotData.map(getSB);
              const wrcVals = slotData.map((_, i) => getWRC(i));
              const warVals = slotData.map((_, i) => getWAR(i));

              return (
                <Panel className="mb-4" title="Season Stats">
                  <SectionHeader title="Standard" />
                  <StatRow label="AVG" values={baVals} highlight={topOf(baVals)} />
                  <StatRow label="OBP" values={obpVals} highlight={topOf(obpVals)} />
                  <StatRow label="SLG" values={slgVals} highlight={topOf(slgVals)} />
                  <StatRow label="OPS" values={opsVals} highlight={topOf(opsVals)} />
                  <StatRow label="HR" values={hrVals} highlight={topOf(hrVals)} />
                  <StatRow label="RBI" values={rbiVals} highlight={topOf(rbiVals)} />
                  <StatRow label="R" values={rVals} highlight={topOf(rVals)} />
                  <StatRow label="SB" values={sbVals} highlight={topOf(sbVals)} />
                  <SectionHeader title="Advanced" />
                  <StatRow label="wRC+" values={wrcVals} highlight={topOf(wrcVals)} />
                  <StatRow label="WAR" values={warVals} highlight={topOf(warVals)} />
                </Panel>
              );
            }

            // Pitching stats
            const getERA = (d: typeof slotData[number]) => d?.ps ? fmtStat(era(d.ps.pitching), 2) : null;
            const getWHIP = (d: typeof slotData[number]) => d?.ps ? fmtStat(whip(d.ps.pitching), 2) : null;
            const getIP = (d: typeof slotData[number]) => d?.ps ? formatIP(d.ps.pitching.ip) : null;
            const getW = (d: typeof slotData[number]) => d?.ps ? String(d.ps.pitching.wins) : null;
            const getK = (d: typeof slotData[number]) => d?.ps ? String(d.ps.pitching.so) : null;

            const advData = slotData.map(d => d?.ps ? calcPitchingAdvanced(d.ps.pitching, leagueCtx) : null);
            const getFIP = (i: number) => advData[i] ? fmtStat(advData[i]!.fip, 2) : null;
            const getWAR = (i: number) => advData[i] ? fmtStat(advData[i]!.war, 1) : null;

            // Lower ERA/WHIP/FIP is better — inverse highlight
            const topOfLow = (vals: (string | null)[]) => {
              const nums = vals.map(v => v !== null ? parseFloat(v) : Infinity);
              const min = Math.min(...nums);
              return vals.map((_, i) => nums[i] === min && min !== Infinity);
            };
            const topOfHigh = (vals: (string | null)[]) => {
              const nums = vals.map(v => v !== null ? parseFloat(v) : -Infinity);
              const max = Math.max(...nums);
              return vals.map((_, i) => nums[i] === max && max !== -Infinity);
            };

            const eraVals = slotData.map(getERA);
            const whipVals = slotData.map(getWHIP);
            const ipVals = slotData.map(getIP);
            const wVals = slotData.map(getW);
            const kVals = slotData.map(getK);
            const fipVals = slotData.map((_, i) => getFIP(i));
            const warVals = slotData.map((_, i) => getWAR(i));

            return (
              <Panel className="mb-4" title="Season Stats">
                <SectionHeader title="Standard" />
                <StatRow label="ERA" values={eraVals} highlight={topOfLow(eraVals)} />
                <StatRow label="WHIP" values={whipVals} highlight={topOfLow(whipVals)} />
                <StatRow label="IP" values={ipVals} highlight={topOfHigh(ipVals)} />
                <StatRow label="W" values={wVals} highlight={topOfHigh(wVals)} />
                <StatRow label="K" values={kVals} highlight={topOfHigh(kVals)} />
                <SectionHeader title="Advanced" />
                <StatRow label="FIP" values={fipVals} highlight={topOfLow(fipVals)} />
                <StatRow label="WAR" values={warVals} highlight={topOfHigh(warVals)} />
              </Panel>
            );
          })()}

          {/* Contract & Age */}
          <Panel className="mb-4" title="Contract & Age">
            <StatRow
              label="Age"
              values={slotData.map(d => d ? String(d.player.age) : null)}
              highlight={slotData.map(d => d ? d.player.age <= 26 : false)}
            />
            {(() => {
              const contracts = slotData.map(d => {
                if (!d || !engine) return null;
                return engine.contractEngine.getContract(d.player.id) ?? null;
              });
              const salaryVals = contracts.map(c => c ? `$${(c.salaryPerYear / 1000).toFixed(1)}M` : null);
              const yearsVals = contracts.map(c => c ? `${c.yearsRemaining}yr` : null);

              return (
                <>
                  <StatRow label="Salary/yr" values={salaryVals} />
                  <StatRow label="Years Left" values={yearsVals} />
                </>
              );
            })()}
          </Panel>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-2">
            {slotData.map((d, i) => d ? (
              <Button
                key={i}
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/franchise/player-stats/${d.player.id}`)}
              >
                <span className={SLOT_COLORS[i]?.text}>●</span>{' '}
                {getPlayerName(d.player)} Full Profile
              </Button>
            ) : null)}
          </div>
        </>
      )}
    </div>
  );
}
