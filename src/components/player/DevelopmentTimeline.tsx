/**
 * DevelopmentTimeline — visual chart showing a player's projected development arc.
 * Shows where they are now vs where they could peak, with age markers.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';

interface AgePoint {
  age: number;
  ovr: number;
  phase: 'growth' | 'peak' | 'decline' | 'late';
  isCurrent: boolean;
}

function phaseColor(phase: AgePoint['phase']): string {
  return phase === 'growth' ? '#22c55e' : phase === 'peak' ? '#d4a843' : phase === 'decline' ? '#f59e0b' : '#ef4444';
}

function phaseLabel(phase: AgePoint['phase']): string {
  return phase === 'growth' ? 'Growth' : phase === 'peak' ? 'Peak' : phase === 'decline' ? 'Decline' : 'Late';
}

export function DevelopmentTimeline({ player }: { player: Player }) {
  const currentOvr = Math.round(evaluatePlayer(player));

  const timeline = useMemo(() => {
    const points: AgePoint[] = [];
    const baseOvr = currentOvr;

    // Project ratings at each age from 20 to 40
    for (let age = 20; age <= 40; age++) {
      let projectedOvr: number;
      const phase: AgePoint['phase'] =
        age <= 26 ? 'growth' : age <= 31 ? 'peak' : age <= 36 ? 'decline' : 'late';

      if (age < player.age) {
        // Past: estimate lower OVR based on growth curve
        const yearsToGrow = player.age - age;
        projectedOvr = Math.max(25, baseOvr - yearsToGrow * (age <= 26 ? 3 : 1));
      } else if (age === player.age) {
        projectedOvr = baseOvr;
      } else {
        // Future projection
        const yearsDiff = age - player.age;
        if (age <= 26) {
          // Still growing
          projectedOvr = Math.min(95, baseOvr + yearsDiff * 2.5);
        } else if (age <= 28) {
          // Peak plateau
          const peakOvr = player.age <= 26 ? Math.min(95, baseOvr + (26 - player.age) * 2.5) : baseOvr;
          projectedOvr = peakOvr + (28 - age) * 0.5;
        } else if (age <= 31) {
          // Late peak
          const peakOvr = player.age <= 26 ? Math.min(95, baseOvr + (26 - player.age) * 2.5) : baseOvr;
          projectedOvr = peakOvr - (age - 28) * 1;
        } else if (age <= 36) {
          // Decline
          const peakOvr = player.age <= 26 ? Math.min(95, baseOvr + (26 - player.age) * 2.5) : baseOvr;
          projectedOvr = peakOvr - (age - 28) * 2;
        } else {
          // Late career
          const peakOvr = player.age <= 26 ? Math.min(95, baseOvr + (26 - player.age) * 2.5) : baseOvr;
          projectedOvr = Math.max(20, peakOvr - (age - 28) * 3);
        }
      }

      points.push({
        age,
        ovr: Math.max(20, Math.min(95, Math.round(projectedOvr))),
        phase,
        isCurrent: age === player.age,
      });
    }

    return points;
  }, [player.age, currentOvr]);

  // Calculate chart dimensions
  const maxOvr = Math.max(...timeline.map(p => p.ovr));
  const minOvr = Math.min(...timeline.map(p => p.ovr));
  const range = Math.max(20, maxOvr - minOvr);

  const WIDTH = 300;
  const HEIGHT = 100;
  const PADDING = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartW = WIDTH - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (age: number) => PADDING.left + ((age - 20) / 20) * chartW;
  const yScale = (ovr: number) => PADDING.top + (1 - (ovr - minOvr + 5) / (range + 10)) * chartH;

  // Build SVG path
  const pathD = timeline.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.age).toFixed(1)} ${yScale(p.ovr).toFixed(1)}`).join(' ');

  // Find current point
  const currentPoint = timeline.find(p => p.isCurrent);
  const peakPoint = timeline.reduce((best, p) => p.ovr > best.ovr ? p : best, timeline[0]!);

  return (
    <div className="rounded-lg border border-navy-lighter/30 bg-navy/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[9px] text-cream-dim/40 uppercase tracking-widest">Development Arc</p>
        <div className="flex gap-2">
          {(['growth', 'peak', 'decline', 'late'] as const).map(ph => (
            <span key={ph} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: phaseColor(ph) }} />
              <span className="font-mono text-[7px] text-cream-dim/30 uppercase">{phaseLabel(ph)}</span>
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        {/* Grid lines */}
        {[20, 40, 60, 80].filter(v => v >= minOvr - 5 && v <= maxOvr + 5).map(v => (
          <g key={v}>
            <line x1={PADDING.left} y1={yScale(v)} x2={WIDTH - PADDING.right} y2={yScale(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <text x={PADDING.left - 3} y={yScale(v) + 2} textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="6" fontFamily="monospace">{v}</text>
          </g>
        ))}

        {/* Age labels */}
        {[20, 25, 30, 35, 40].map(age => (
          <text key={age} x={xScale(age)} y={HEIGHT - 3} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace">{age}</text>
        ))}

        {/* Phase background bands */}
        <rect x={xScale(20)} y={PADDING.top} width={xScale(26)-xScale(20)} height={chartH} fill="rgba(34,197,94,0.03)" />
        <rect x={xScale(27)} y={PADDING.top} width={xScale(31)-xScale(27)} height={chartH} fill="rgba(212,168,67,0.03)" />
        <rect x={xScale(32)} y={PADDING.top} width={xScale(36)-xScale(32)} height={chartH} fill="rgba(245,158,11,0.03)" />
        <rect x={xScale(37)} y={PADDING.top} width={xScale(40)-xScale(37)} height={chartH} fill="rgba(239,68,68,0.03)" />

        {/* Projection line (future = dashed) */}
        <path
          d={timeline.filter(p => p.age <= player.age).map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.age).toFixed(1)} ${yScale(p.ovr).toFixed(1)}`).join(' ')}
          fill="none" stroke="#d4a843" strokeWidth="1.5" strokeLinecap="round"
        />
        <path
          d={timeline.filter(p => p.age >= player.age).map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.age).toFixed(1)} ${yScale(p.ovr).toFixed(1)}`).join(' ')}
          fill="none" stroke="#d4a843" strokeWidth="1" strokeDasharray="3,2" opacity="0.5"
        />

        {/* Current age dot */}
        {currentPoint && (
          <circle cx={xScale(currentPoint.age)} cy={yScale(currentPoint.ovr)} r="3.5" fill="#d4a843" stroke="#0a0f1a" strokeWidth="1" />
        )}

        {/* Peak marker */}
        {peakPoint && peakPoint.age !== player.age && (
          <circle cx={xScale(peakPoint.age)} cy={yScale(peakPoint.ovr)} r="2" fill="none" stroke="#d4a843" strokeWidth="0.5" strokeDasharray="1,1" />
        )}
      </svg>

      {/* Stats below chart */}
      <div className="flex justify-between mt-1.5">
        <div>
          <span className="font-mono text-[9px] text-cream-dim/40">Now: </span>
          <span className="font-mono text-[10px] text-gold font-bold">{currentOvr} OVR</span>
          <span className="font-mono text-[8px] text-cream-dim/30"> (Age {player.age})</span>
        </div>
        <div>
          <span className="font-mono text-[9px] text-cream-dim/40">Proj Peak: </span>
          <span className="font-mono text-[10px] text-cream font-bold">{peakPoint.ovr} OVR</span>
          <span className="font-mono text-[8px] text-cream-dim/30"> (Age {peakPoint.age})</span>
        </div>
      </div>
    </div>
  );
}
