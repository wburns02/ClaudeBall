import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { usePlayerModal } from '@/stores/playerModalStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';

// ── Projection Engine ────────────────────────────────────────────────────────

interface YearProjection {
  age: number;
  ovr: number;
  phase: 'growth' | 'peak' | 'decline' | 'steep';
}

function projectPlayer(player: Player, yearsAhead = 5): YearProjection[] {
  const currentOvr = Math.round(evaluatePlayer(player));
  const workEthic = player.mental?.work_ethic ?? 50;
  const we = workEthic / 100; // 0-1

  const projections: YearProjection[] = [
    { age: player.age, ovr: currentOvr, phase: getPhase(player.age) },
  ];

  let ovr = currentOvr;
  for (let y = 1; y <= yearsAhead; y++) {
    const age = player.age + y;
    const phase = getPhase(age);
    let delta = 0;

    if (phase === 'growth') {
      // Expected growth: peaks at 20 (~4pts), tapers to ~1pt at 26
      const growthRate = Math.max(0.5, 4 - (age - 20) * 0.5);
      delta = Math.round(growthRate * (0.5 + we * 0.5));
    } else if (phase === 'peak') {
      // Small fluctuation around 0
      delta = 0;
    } else if (phase === 'decline') {
      // Gradual decline: -1 at 32, -3 at 36
      const declineRate = 1 + (age - 31) * 0.4;
      delta = -Math.round(declineRate * (1 - we * 0.2));
    } else {
      // Steep decline: -3 at 37, gets worse
      const steepRate = 3 + (age - 36) * 0.8;
      delta = -Math.round(steepRate);
    }

    ovr = Math.max(20, Math.min(99, ovr + delta));
    projections.push({ age, ovr, phase });
  }

  return projections;
}

function getPhase(age: number): 'growth' | 'peak' | 'decline' | 'steep' {
  if (age <= 26) return 'growth';
  if (age <= 31) return 'peak';
  if (age <= 36) return 'decline';
  return 'steep';
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'growth': return 'text-green-light';
    case 'peak': return 'text-gold';
    case 'decline': return 'text-orange-400';
    case 'steep': return 'text-red-400';
    default: return 'text-cream-dim';
  }
}

function phaseBg(phase: string): string {
  switch (phase) {
    case 'growth': return 'bg-green-light';
    case 'peak': return 'bg-gold';
    case 'decline': return 'bg-orange-400';
    case 'steep': return 'bg-red-400';
    default: return 'bg-cream-dim';
  }
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'growth': return 'Rising';
    case 'peak': return 'Prime';
    case 'decline': return 'Aging';
    case 'steep': return 'Twilight';
    default: return '—';
  }
}

// ── SVG Mini Curve ───────────────────────────────────────────────────────────

function MiniCurve({ projections, width = 120, height = 32 }: { projections: YearProjection[]; width?: number; height?: number }) {
  if (projections.length < 2) return null;
  const pad = 2;
  const minOvr = Math.min(...projections.map(p => p.ovr)) - 5;
  const maxOvr = Math.max(...projections.map(p => p.ovr)) + 5;
  const range = Math.max(1, maxOvr - minOvr);

  const points = projections.map((p, i) => {
    const x = pad + (i / (projections.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (p.ovr - minOvr) / range) * (height - pad * 2);
    return { x, y, phase: p.phase };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <path d={linePath} fill="none" stroke="#d4a843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x} cy={p.y} r={i === 0 ? 3 : 2}
          fill={i === 0 ? '#d4a843' : p.phase === 'growth' ? '#4ade80' : p.phase === 'peak' ? '#d4a843' : p.phase === 'decline' ? '#fb923c' : '#f87171'}
          opacity={i === 0 ? 1 : 0.7}
        />
      ))}
    </svg>
  );
}

// ── Large Projection Chart ──────────────────────────────────────────────────

function ProjectionChart({ projections }: { projections: YearProjection[] }) {
  if (projections.length < 2) return null;

  const W = 500, H = 160;
  const pad = { top: 15, right: 20, bottom: 25, left: 35 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const minOvr = Math.min(...projections.map(p => p.ovr)) - 8;
  const maxOvr = Math.max(...projections.map(p => p.ovr)) + 8;
  const range = Math.max(1, maxOvr - minOvr);

  const x = (i: number) => pad.left + (i / (projections.length - 1)) * plotW;
  const y = (ovr: number) => pad.top + (1 - (ovr - minOvr) / range) * plotH;

  const linePath = projections.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.ovr).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(projections.length - 1).toFixed(1)} ${y(minOvr).toFixed(1)} L ${x(0).toFixed(1)} ${y(minOvr).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a843" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#d4a843" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[minOvr, Math.round((minOvr + maxOvr) / 2), maxOvr].map(v => (
        <g key={v}>
          <line x1={pad.left} y1={y(v)} x2={W - pad.right} y2={y(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          <text x={pad.left - 5} y={y(v) + 3} textAnchor="end" className="fill-cream-dim/30 text-[8px] font-mono">{v}</text>
        </g>
      ))}

      {/* Area + Line */}
      <path d={areaPath} fill="url(#projGrad)" />
      <path d={linePath} fill="none" stroke="#d4a843" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {projections.map((p, i) => (
        <g key={i}>
          <circle
            cx={x(i)} cy={y(p.ovr)}
            r={i === 0 ? 5 : 3.5}
            fill={i === 0 ? '#d4a843' : p.phase === 'growth' ? '#4ade80' : p.phase === 'peak' ? '#d4a843' : p.phase === 'decline' ? '#fb923c' : '#f87171'}
            stroke="#0a0f1a" strokeWidth="1.5"
          />
          {/* OVR label */}
          <text x={x(i)} y={y(p.ovr) - 8} textAnchor="middle" className="fill-cream text-[9px] font-mono font-bold">
            {p.ovr}
          </text>
          {/* Age label */}
          <text x={x(i)} y={H - 5} textAnchor="middle" className="fill-cream-dim/50 text-[9px] font-mono">
            {p.age}
          </text>
        </g>
      ))}

      {/* Phase labels */}
      {projections.slice(1).map((p, i) => {
        if (i === 0 || projections[i].phase !== p.phase) {
          return (
            <text
              key={`phase-${i}`}
              x={x(i + 1)} y={pad.top - 3}
              textAnchor="middle"
              className={cn('text-[7px] font-mono', phaseColor(p.phase))}
            >
              {phaseLabel(p.phase)}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

type SortKey = 'ovr' | 'age' | 'delta' | 'peakOvr' | 'name';
type FilterPhase = 'all' | 'growth' | 'peak' | 'decline' | 'steep';

export function ProjectionsPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, season } = useFranchiseStore();
  const openPlayer = usePlayerModal(s => s.openPlayer);
  const [sortKey, setSortKey] = useState<SortKey>('delta');
  const [filterPhase, setFilterPhase] = useState<FilterPhase>('all');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  if (!engine || !userTeamId || !season) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Player Projections</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          See where every player on your roster is headed — projected OVR curves based on age, development phase, and work ethic.
        </p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  const roster = userTeam?.roster.players ?? [];

  const playerData = useMemo(() => {
    return roster.map(p => {
      const ovr = Math.round(evaluatePlayer(p));
      const projections = projectPlayer(p, 5);
      const peakProjection = projections.reduce((best, proj) => proj.ovr > best.ovr ? proj : best, projections[0]);
      const endOvr = projections[projections.length - 1].ovr;
      const delta = endOvr - ovr;
      const phase = getPhase(p.age);

      return {
        player: p,
        name: getPlayerName(p),
        ovr,
        projections,
        peakOvr: peakProjection.ovr,
        peakAge: peakProjection.age,
        endOvr,
        delta,
        phase,
      };
    });
  }, [roster]);

  // Filter and sort
  const filtered = useMemo(() => {
    let data = playerData;
    if (filterPhase !== 'all') data = data.filter(d => d.phase === filterPhase);

    return [...data].sort((a, b) => {
      switch (sortKey) {
        case 'ovr': return b.ovr - a.ovr;
        case 'age': return a.player.age - b.player.age;
        case 'delta': return b.delta - a.delta; // most improvement first
        case 'peakOvr': return b.peakOvr - a.peakOvr;
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
  }, [playerData, filterPhase, sortKey]);

  const selectedData = selectedPlayer ? playerData.find(d => d.player.id === selectedPlayer) : null;

  // Phase distribution
  const phaseCounts = {
    growth: playerData.filter(d => d.phase === 'growth').length,
    peak: playerData.filter(d => d.phase === 'peak').length,
    decline: playerData.filter(d => d.phase === 'decline').length,
    steep: playerData.filter(d => d.phase === 'steep').length,
  };

  // Roster trend: how many improving vs declining
  const improving = playerData.filter(d => d.delta > 0).length;
  const declining = playerData.filter(d => d.delta < 0).length;
  const stable = playerData.filter(d => d.delta === 0).length;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Player Projections</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam?.city} {userTeam?.name} — 5-Year Development Outlook
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/franchise/development')}>← Dev Hub</Button>
      </div>

      {/* Roster Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-cream-dim/50 uppercase tracking-wider">Roster Age</p>
          <p className="font-mono text-2xl font-bold text-cream mt-1">
            {(playerData.reduce((sum, d) => sum + d.player.age, 0) / Math.max(1, playerData.length)).toFixed(1)}
          </p>
          <p className="font-mono text-xs text-cream-dim/50">avg age</p>
        </div>
        <div className="rounded-lg border border-green-light/20 bg-green-light/5 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-green-light/60 uppercase tracking-wider">Improving</p>
          <p className="font-mono text-2xl font-bold text-green-light mt-1">{improving}</p>
          <p className="font-mono text-xs text-cream-dim/50">players trending up</p>
        </div>
        <div className="rounded-lg border border-gold/20 bg-gold/5 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-gold/60 uppercase tracking-wider">In Prime</p>
          <p className="font-mono text-2xl font-bold text-gold mt-1">{phaseCounts.peak}</p>
          <p className="font-mono text-xs text-cream-dim/50">ages 27-31</p>
        </div>
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-center">
          <p className="font-mono text-[10px] text-red-400/60 uppercase tracking-wider">Declining</p>
          <p className="font-mono text-2xl font-bold text-red-400 mt-1">{declining}</p>
          <p className="font-mono text-xs text-cream-dim/50">players trending down</p>
        </div>
      </div>

      {/* Selected Player Detail */}
      {selectedData && (
        <Panel title={`Projection: ${selectedData.name}`} className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <ProjectionChart projections={selectedData.projections} />
            </div>
            <div className="space-y-3 md:w-48 shrink-0">
              <div>
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Current OVR</p>
                <p className="font-mono text-2xl font-bold text-cream">{selectedData.ovr}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Projected Peak</p>
                <p className="font-mono text-2xl font-bold text-gold">{selectedData.peakOvr}</p>
                <p className="font-mono text-xs text-cream-dim/40">at age {selectedData.peakAge}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase">5-Year Change</p>
                <p className={cn('font-mono text-xl font-bold',
                  selectedData.delta > 0 ? 'text-green-light' : selectedData.delta < 0 ? 'text-red-400' : 'text-cream-dim',
                )}>
                  {selectedData.delta > 0 ? '+' : ''}{selectedData.delta}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Phase</p>
                <p className={cn('font-mono text-sm font-bold', phaseColor(selectedData.phase))}>
                  {phaseLabel(selectedData.phase)}
                </p>
              </div>
              <button
                onClick={() => openPlayer(selectedData.player.id)}
                className="w-full py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-xs font-mono font-semibold hover:bg-gold/25 transition-colors cursor-pointer"
              >
                View Full Profile →
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* Filters & Sort */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {(['all', 'growth', 'peak', 'decline', 'steep'] as const).map(phase => (
            <button
              key={phase}
              onClick={() => setFilterPhase(phase)}
              className={cn(
                'px-3 py-1 rounded font-mono text-xs transition-all cursor-pointer',
                filterPhase === phase
                  ? cn('border', phase === 'all' ? 'bg-navy-lighter text-cream border-navy-lighter' : cn(phaseBg(phase) + '/15 border-current/30', phaseColor(phase)))
                  : 'text-cream-dim/40 hover:text-cream-dim border border-transparent',
              )}
            >
              {phase === 'all' ? `All (${playerData.length})` : `${phaseLabel(phase)} (${phaseCounts[phase]})`}
            </button>
          ))}
        </div>
        <span className="text-cream-dim/20 mx-1">|</span>
        <div className="flex gap-1">
          {([
            ['delta', '5Y Change'],
            ['ovr', 'Current OVR'],
            ['peakOvr', 'Peak OVR'],
            ['age', 'Age'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={cn(
                'px-2 py-0.5 rounded font-mono text-[10px] transition-all cursor-pointer',
                sortKey === key ? 'bg-gold/15 text-gold' : 'text-cream-dim/30 hover:text-cream-dim/60',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Player List */}
      <div className="space-y-1">
        {filtered.map((d, i) => (
          <div
            key={d.player.id}
            onClick={() => setSelectedPlayer(selectedPlayer === d.player.id ? null : d.player.id)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer',
              selectedPlayer === d.player.id
                ? 'bg-gold/10 border border-gold/30'
                : 'hover:bg-navy-lighter/20 border border-transparent',
            )}
          >
            {/* Phase indicator */}
            <div className={cn('w-1.5 h-8 rounded-full shrink-0', phaseBg(d.phase))} style={{ opacity: 0.6 }} />

            {/* Player info */}
            <div className="w-36 shrink-0 min-w-0">
              <p className="font-body text-sm text-cream truncate">{d.name}</p>
              <p className="font-mono text-[10px] text-cream-dim/50">{d.player.position} · Age {d.player.age}</p>
            </div>

            {/* Current OVR */}
            <div className="w-10 text-center shrink-0">
              <p className={cn('font-mono text-sm font-bold',
                d.ovr >= 70 ? 'text-gold' : d.ovr >= 55 ? 'text-green-light' : d.ovr >= 40 ? 'text-cream' : 'text-red-400',
              )}>
                {d.ovr}
              </p>
              <p className="font-mono text-[8px] text-cream-dim/30">NOW</p>
            </div>

            {/* Mini curve */}
            <MiniCurve projections={d.projections} />

            {/* Peak OVR */}
            <div className="w-10 text-center shrink-0">
              <p className="font-mono text-sm font-bold text-gold/80">{d.peakOvr}</p>
              <p className="font-mono text-[8px] text-cream-dim/30">PEAK</p>
            </div>

            {/* 5-Year Delta */}
            <div className="w-12 text-right shrink-0">
              <p className={cn('font-mono text-sm font-bold',
                d.delta > 0 ? 'text-green-light' : d.delta < 0 ? 'text-red-400' : 'text-cream-dim',
              )}>
                {d.delta > 0 ? '+' : ''}{d.delta}
              </p>
              <p className="font-mono text-[8px] text-cream-dim/30">5YR</p>
            </div>

            {/* Phase badge */}
            <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded border shrink-0 hidden sm:block',
              d.phase === 'growth' ? 'text-green-light border-green-light/20 bg-green-light/5'
              : d.phase === 'peak' ? 'text-gold border-gold/20 bg-gold/5'
              : d.phase === 'decline' ? 'text-orange-400 border-orange-400/20 bg-orange-400/5'
              : 'text-red-400 border-red-400/20 bg-red-400/5',
            )}>
              {phaseLabel(d.phase)}
            </span>
          </div>
        ))}
      </div>

      {/* Phase Legend */}
      <Panel title="Development Phases" className="mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { phase: 'growth', ages: '20-26', desc: 'Ratings improve each season. High work ethic accelerates growth.' },
            { phase: 'peak', ages: '27-31', desc: 'Prime years. Ratings hold steady with small fluctuations.' },
            { phase: 'decline', ages: '32-36', desc: 'Gradual decline begins. Work ethic can slow the loss.' },
            { phase: 'steep', ages: '37+', desc: 'Rapid decline. Consider trade or retirement.' },
          ] as const).map(p => (
            <div key={p.phase} className="text-center space-y-1.5 py-2">
              <div className={cn('w-3 h-3 rounded-full mx-auto', phaseBg(p.phase))} style={{ opacity: 0.7 }} />
              <p className={cn('font-mono text-xs font-bold', phaseColor(p.phase))}>{phaseLabel(p.phase)}</p>
              <p className="font-mono text-[10px] text-cream-dim/40">Ages {p.ages}</p>
              <p className="font-mono text-[10px] text-cream-dim/60 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
