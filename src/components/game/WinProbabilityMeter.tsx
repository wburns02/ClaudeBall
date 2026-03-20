import { useMemo } from 'react';
import { cn } from '@/lib/cn.ts';
import { calcWinProbability, calcLeverage } from '@/engine/stats/WinProbability.ts';
import type { WPSnapshot } from '@/engine/stats/WinProbability.ts';
import type { GameState } from '@/engine/types/index.ts';

interface WinProbabilityMeterProps {
  game: GameState;
  history: WPSnapshot[];
  className?: string;
}

// ── Sparkline SVG ──────────────────────────────────────────────
function WPSparkline({ history, currentWP }: { history: WPSnapshot[]; currentWP: number }) {
  const W = 140;
  const H = 28;
  const all = [...history.map(h => h.homeWP), currentWP];

  if (all.length < 2) {
    return (
      <svg width={W} height={H}>
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="rgba(232,224,212,0.1)" strokeWidth={1} />
        <circle cx={W / 2} cy={H / 2} r={2} fill="rgba(212,168,67,0.5)" />
      </svg>
    );
  }

  const pts = all.map((wp, i) => {
    const x = (i / (all.length - 1)) * W;
    const y = H - (wp / 100) * H;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');

  // Gradient fill from below the line to 50% midline
  const fillPts = [
    `0,${H / 2}`,
    ...pts,
    `${W},${H / 2}`,
  ].join(' ');

  const lastWP = all[all.length - 1]!;
  const lineColor = lastWP > 52 ? '#4ade80' : lastWP < 48 ? '#f87171' : '#d4a843';

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {/* 50% midline */}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(232,224,212,0.12)" strokeWidth={1} strokeDasharray="2,3" />
      {/* Fill under curve */}
      <polygon points={fillPts} fill={lastWP >= 50 ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)'} />
      {/* WP line */}
      <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Current point dot */}
      <circle
        cx={(all.length - 1) / (all.length - 1) * W}
        cy={H - (lastWP / 100) * H}
        r={2.5}
        fill={lineColor}
        stroke="rgba(10,15,26,0.8)"
        strokeWidth={1}
      />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────
export function WinProbabilityMeter({ game, history, className }: WinProbabilityMeterProps) {
  const awayScore = game.score.away.reduce((a, b) => a + b, 0);
  const homeScore = game.score.home.reduce((a, b) => a + b, 0);
  const runnersOnBase = [game.inning.bases.first, game.inning.bases.second, game.inning.bases.third]
    .filter(Boolean).length;

  const homeWP = useMemo(() => {
    if (game.phase === 'final') {
      return homeScore > awayScore ? 100 : homeScore < awayScore ? 0 : 50;
    }
    return calcWinProbability(
      game.inning.inning,
      game.inning.half,
      game.inning.outs,
      homeScore - awayScore,
      runnersOnBase,
    );
  }, [game.phase, game.inning.inning, game.inning.half, game.inning.outs, homeScore, awayScore, runnersOnBase]);

  const awayWP = 100 - homeWP;

  const leverage = useMemo(() => calcLeverage(
    game.inning.inning,
    game.inning.half,
    game.inning.outs,
    homeScore - awayScore,
  ), [game.inning.inning, game.inning.half, game.inning.outs, homeScore, awayScore]);

  const isHighLeverage = leverage >= 0.6;
  const isFinalOrOver = game.phase === 'final';

  // Bar fill pct — away team on left, home on right
  const awayPct = awayWP;
  const homePct = homeWP;

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden select-none',
        className,
      )}
      style={{
        background: 'rgba(10,15,26,0.88)',
        border: '1px solid rgba(212,168,67,0.2)',
        backdropFilter: 'blur(6px)',
        width: 200,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{ borderColor: 'rgba(212,168,67,0.12)' }}
      >
        <span
          className="font-mono text-[9px] uppercase tracking-widest"
          style={{ color: 'rgba(212,168,67,0.55)' }}
        >
          Win Probability
        </span>
        {isHighLeverage && !isFinalOrOver && (
          <span
            className="font-mono text-[8px] font-bold uppercase tracking-widest animate-pulse"
            style={{ color: '#f87171' }}
          >
            HIGH LEV
          </span>
        )}
      </div>

      {/* Team labels + percentages */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <div className="text-center">
          <div className="font-mono text-[9px] text-cream-dim/50 uppercase">{game.away.abbreviation}</div>
          <div
            className="font-display text-lg font-bold leading-none"
            style={{ color: awayWP > homePct ? '#d4a843' : 'rgba(232,224,212,0.5)' }}
          >
            {awayWP}%
          </div>
        </div>
        <div className="font-mono text-[10px] text-cream-dim/30">vs</div>
        <div className="text-center">
          <div className="font-mono text-[9px] text-cream-dim/50 uppercase">{game.home.abbreviation}</div>
          <div
            className="font-display text-lg font-bold leading-none"
            style={{ color: homePct > awayWP ? '#d4a843' : 'rgba(232,224,212,0.5)' }}
          >
            {homePct}%
          </div>
        </div>
      </div>

      {/* WP bar */}
      <div className="px-3 pb-2">
        <div
          className="relative h-3 rounded-full overflow-hidden"
          style={{ background: 'rgba(232,224,212,0.06)' }}
        >
          {/* Away side (left) */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-full transition-all duration-700"
            style={{
              width: `${awayPct}%`,
              background: awayPct > homePct
                ? 'linear-gradient(to right, rgba(212,168,67,0.8), rgba(212,168,67,0.5))'
                : 'linear-gradient(to right, rgba(232,224,212,0.3), rgba(232,224,212,0.15))',
            }}
          />
          {/* Home side (right) */}
          <div
            className="absolute inset-y-0 right-0 rounded-r-full transition-all duration-700"
            style={{
              width: `${homePct}%`,
              background: homePct > awayPct
                ? 'linear-gradient(to left, rgba(212,168,67,0.8), rgba(212,168,67,0.5))'
                : 'linear-gradient(to left, rgba(232,224,212,0.3), rgba(232,224,212,0.15))',
            }}
          />
          {/* Center marker */}
          <div
            className="absolute inset-y-0"
            style={{ left: '50%', width: 1, background: 'rgba(232,224,212,0.2)', transform: 'translateX(-50%)' }}
          />
        </div>
      </div>

      {/* Sparkline history */}
      {history.length >= 1 && (
        <div className="px-3 pb-2">
          <WPSparkline history={history} currentWP={homeWP} />
          <div className="flex justify-between mt-0.5">
            <span className="font-mono text-[8px]" style={{ color: 'rgba(232,224,212,0.2)' }}>Start</span>
            <span className="font-mono text-[8px]" style={{ color: 'rgba(232,224,212,0.2)' }}>Now</span>
          </div>
        </div>
      )}

      {/* Situation label */}
      {!isFinalOrOver && (
        <div
          className="px-3 pb-2 font-mono text-[9px] text-center"
          style={{ color: 'rgba(232,224,212,0.35)' }}
        >
          {game.inning.half === 'top' ? '▲' : '▼'}{game.inning.inning}
          {' · '}{game.inning.outs} out{game.inning.outs !== 1 ? 's' : ''}
          {awayScore !== homeScore && ` · ${awayScore > homeScore ? game.away.abbreviation : game.home.abbreviation} +${Math.abs(awayScore - homeScore)}`}
        </div>
      )}
    </div>
  );
}
