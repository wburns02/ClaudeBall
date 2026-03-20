import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useMoraleStore, getMoraleLabel, getMoraleColor } from '@/stores/moraleStore.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/index.ts';
import { cn } from '@/lib/cn.ts';

// ── Morale bar component ─────────────────────────────────────────────────────

function MoraleBar({
  value,
  size = 'md',
  showLabel = false,
}: {
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  const color = getMoraleColor(value);
  const label = getMoraleLabel(value);
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="flex items-center gap-2 w-full">
      <div className={cn('flex-1 rounded-full bg-navy-lighter/50 overflow-hidden', h)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', h)}
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-xs w-7 text-right tabular-nums" style={{ color }}>
        {Math.round(value)}
      </span>
      {showLabel && (
        <span className="font-mono text-xs text-cream-dim/60 w-16">{label}</span>
      )}
    </div>
  );
}

// ── Chemistry gauge ──────────────────────────────────────────────────────────

function ChemistryGauge({ score, label }: { score: number; label: string }) {
  const color = getMoraleColor(score);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="font-display text-sm tracking-widest uppercase" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ── Delta arrow ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-cream-dim/40 text-xs">—</span>;
  const positive = delta > 0;
  return (
    <span className={cn('text-xs font-mono font-bold', positive ? 'text-green-400' : 'text-red-400')}>
      {positive ? '+' : ''}{delta}
    </span>
  );
}

// ── Trend icon ───────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <span className="text-green-400 text-lg">↑</span>;
  if (trend === 'down') return <span className="text-red-400 text-lg">↓</span>;
  return <span className="text-cream-dim/50 text-lg">→</span>;
}

// ── Morale tips ──────────────────────────────────────────────────────────────

const MORALE_TIPS = [
  { icon: '🏆', title: 'Win Games', desc: 'Nothing boosts morale like a winning streak. Every win adds +3 morale across the roster.' },
  { icon: '⏱️', title: 'Regular Playing Time', desc: 'Starters who play every day stay happy. Benching veterans frequently tanks their morale.' },
  { icon: '📝', title: 'Contract Security', desc: 'Players on long-term deals are more settled. Walk-year players get -1.5/day anxiety.' },
  { icon: '💰', title: 'Fair Pay', desc: 'Players who discover they\'re underpaid vs market become resentful over time.' },
  { icon: '👑', title: 'Veteran Leaders', desc: 'High-morale, high-leadership veterans spread positivity through the clubhouse.' },
];

// ── Main Page ────────────────────────────────────────────────────────────────

type SortMode = 'morale' | 'name' | 'pos' | 'ovr';

export function MoralePage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId } = useFranchiseStore();
  const { playerMorales, recentEvents, teamChemistry, applyManualBoost } = useMoraleStore();

  const [sortMode, setSortMode] = useState<SortMode>('morale');
  const [showTips, setShowTips] = useState(false);

  const team = useMemo(() => {
    if (!engine || !userTeamId) return null;
    return engine.getTeam(userTeamId) ?? null;
  }, [engine, userTeamId]);

  const record = useMemo(() => {
    if (!season || !userTeamId) return null;
    return season.standings.getRecord(userTeamId);
  }, [season, userTeamId]);

  const currentDay = season?.currentDay ?? 0;

  const rosterWithMorale = useMemo(() => {
    if (!team) return [];
    return team.roster.players.map(p => {
      const morale = playerMorales[p.id] ?? 60;
      const ovr = Math.round(evaluatePlayer(p));
      // Recent change: find the latest event for this player
      const lastEvent = recentEvents.find(e => e.playerId === p.id);
      return { player: p, morale, ovr, lastDelta: lastEvent?.delta ?? 0 };
    });
  }, [team, playerMorales, recentEvents]);

  const sortedRoster = useMemo(() => {
    return [...rosterWithMorale].sort((a, b) => {
      switch (sortMode) {
        case 'morale': return b.morale - a.morale;
        case 'name': return getPlayerName(a.player).localeCompare(getPlayerName(b.player));
        case 'pos': return a.player.position.localeCompare(b.player.position);
        case 'ovr': return b.ovr - a.ovr;
      }
    });
  }, [rosterWithMorale, sortMode]);

  const positionGroups = useMemo(() => {
    const groups: Record<string, typeof rosterWithMorale> = {
      'Starting Rotation': [],
      'Bullpen': [],
      'Position Players': [],
    };
    for (const item of rosterWithMorale) {
      const pos = item.player.position;
      if (pos === 'P') {
        // SP vs RP — check bullpen assignment (simplified: SP1-5 are starters)
        const spIds = team?.rotation ?? [];
        if (spIds.includes(item.player.id)) {
          groups['Starting Rotation'].push(item);
        } else {
          groups['Bullpen'].push(item);
        }
      } else {
        groups['Position Players'].push(item);
      }
    }
    return groups;
  }, [rosterWithMorale, team]);

  const chemistry = teamChemistry ?? { score: 60, label: 'Neutral', trend: 'stable' as const, factors: [] };

  // Empty state
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-navy-lighter/40 flex items-center justify-center">
          <span className="text-3xl">😐</span>
        </div>
        <p className="font-display text-gold text-xl">No Active Franchise</p>
        <Button variant="primary" onClick={() => navigate('/franchise/new')}>Start a Franchise</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Team Morale</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {team.city} {team.name} · Day {currentDay}
            {record ? ` · ${record.wins}-${record.losses}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowTips(v => !v)}>
            {showTips ? 'Hide Tips' : 'How It Works'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise/roster')}>
            Roster
          </Button>
        </div>
      </div>

      {/* Tips banner */}
      {showTips && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-in slide-in-from-top-2 duration-200">
          {MORALE_TIPS.map(tip => (
            <div key={tip.title} className="bg-navy-lighter/30 border border-navy-lighter/50 rounded-lg p-3">
              <div className="text-xl mb-1">{tip.icon}</div>
              <div className="font-display text-gold text-xs uppercase tracking-wide mb-1">{tip.title}</div>
              <div className="font-mono text-cream-dim/70 text-xs leading-relaxed">{tip.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chemistry + Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chemistry gauge */}
        <Panel className="flex flex-col items-center justify-center py-6 gap-4">
          <h2 className="font-display text-lg text-gold uppercase tracking-wide text-center">
            Team Chemistry
          </h2>
          <ChemistryGauge score={chemistry.score} label={chemistry.label} />
          <div className="flex items-center gap-2">
            <span className="font-mono text-cream-dim/50 text-xs">Trend:</span>
            <TrendIcon trend={chemistry.trend} />
          </div>
        </Panel>

        {/* Chemistry factors */}
        <Panel title="Chemistry Factors" className="md:col-span-2">
          {chemistry.factors.length === 0 ? (
            <p className="font-mono text-cream-dim/50 text-sm text-center py-4">
              Sim more games to reveal chemistry factors.
            </p>
          ) : (
            <div className="space-y-3">
              {chemistry.factors.map(f => (
                <div key={f.label} className="flex items-start gap-3">
                  <div className={cn(
                    'flex-shrink-0 w-10 text-right font-mono text-sm font-bold',
                    f.impact >= 0 ? 'text-green-400' : 'text-red-400'
                  )}>
                    {f.impact >= 0 ? '+' : ''}{f.impact}
                  </div>
                  <div>
                    <div className="font-display text-cream text-sm">{f.label}</div>
                    <div className="font-mono text-cream-dim/60 text-xs">{f.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Position group averages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(positionGroups).map(([group, items]) => {
          if (items.length === 0) return null;
          const avg = Math.round(items.reduce((s, i) => s + i.morale, 0) / items.length);
          const color = getMoraleColor(avg);
          const label = getMoraleLabel(avg);
          return (
            <div key={group} className="bg-navy-lighter/20 border border-navy-lighter/40 rounded-lg p-4">
              <div className="font-display text-xs text-cream-dim/70 uppercase tracking-wide mb-1">{group}</div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl" style={{ color }}>{avg}</span>
                <span className="font-mono text-xs" style={{ color }}>{label}</span>
              </div>
              <MoraleBar value={avg} size="sm" />
              <div className="font-mono text-cream-dim/40 text-xs mt-1">{items.length} players</div>
            </div>
          );
        })}
      </div>

      {/* Roster morale table */}
      <Panel>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-display text-gold text-lg tracking-wide uppercase">
            Roster Morale ({rosterWithMorale.length})
          </h3>
          <div className="flex gap-1">
            {(['morale', 'pos', 'ovr', 'name'] as SortMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wide transition-colors',
                  sortMode === mode
                    ? 'bg-gold/20 text-gold border border-gold/40'
                    : 'text-cream-dim/50 hover:text-cream-dim border border-transparent'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-navy-lighter/50">
                <th className="text-left px-3 py-2 font-mono text-xs text-cream-dim/50 uppercase">Player</th>
                <th className="text-center px-2 py-2 font-mono text-xs text-cream-dim/50 uppercase w-10">Pos</th>
                <th className="text-center px-2 py-2 font-mono text-xs text-cream-dim/50 uppercase w-10">OVR</th>
                <th className="px-3 py-2 font-mono text-xs text-cream-dim/50 uppercase w-48">Morale</th>
                <th className="text-center px-2 py-2 font-mono text-xs text-cream-dim/50 uppercase w-16">Status</th>
                <th className="text-center px-2 py-2 font-mono text-xs text-cream-dim/50 uppercase w-14">Change</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map(({ player, morale, ovr, lastDelta }) => {
                const color = getMoraleColor(morale);
                const label = getMoraleLabel(morale);
                return (
                  <tr
                    key={player.id}
                    className="border-b border-navy-lighter/30 hover:bg-navy-lighter/20 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/franchise/player-stats/${player.id}`)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-body text-cream group-hover:text-gold transition-colors text-sm">
                        {getPlayerName(player)}
                      </span>
                      <span className="ml-2 font-mono text-cream-dim/40 text-xs">
                        {player.age}y
                      </span>
                    </td>
                    <td className="text-center px-2 py-2.5">
                      <span className="font-mono text-xs text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                        {player.position}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2.5 font-mono text-sm text-cream">
                      {ovr}
                    </td>
                    <td className="px-3 py-2.5">
                      <MoraleBar value={morale} size="sm" />
                    </td>
                    <td className="text-center px-2 py-2.5">
                      <span className="font-mono text-xs" style={{ color }}>
                        {label}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2.5">
                      <DeltaBadge delta={lastDelta} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Recent morale events */}
      {recentEvents.length > 0 && (
        <Panel title="Recent Morale Events">
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {recentEvents.slice(0, 20).map((evt, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-navy-lighter/20 last:border-0">
                <span className="font-mono text-cream-dim/40 text-xs w-10 shrink-0">
                  D{evt.day}
                </span>
                <DeltaBadge delta={evt.delta} />
                <div className="flex-1 min-w-0">
                  <span className="font-body text-cream text-sm">{evt.playerName}</span>
                  <span className="font-mono text-cream-dim/50 text-xs ml-2">
                    {evt.reason}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* GM Actions */}
      <Panel title="GM Actions">
        <p className="font-mono text-cream-dim/60 text-sm mb-4">
          Targeted morale boosts cost budget room but can turn around a slumping player or revive the clubhouse.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionCard
            title="Team Meeting"
            cost="Free"
            effect="+5 morale all players"
            description="Address the team. Most effective when chemistry is below 50."
            available={chemistry.score < 65}
            onActivate={() => {
              if (!team) return;
              team.roster.players.forEach(p => {
                applyManualBoost(p.id, getPlayerName(p), 5, 'team meeting', currentDay);
              });
            }}
          />
          <ActionCard
            title="Team Dinner"
            cost="$250K"
            effect="+8 chemistry, +3 all"
            description="Invest in team bonding. Great for spreading positivity."
            available={chemistry.score < 80}
            onActivate={() => {
              if (!team) return;
              team.roster.players.forEach(p => {
                applyManualBoost(p.id, getPlayerName(p), 8, 'team dinner', currentDay);
              });
            }}
          />
          <ActionCard
            title="1-on-1 Coaching"
            cost="Free"
            effect="+12 to lowest"
            description="Focus on your most unhappy player to prevent clubhouse issues."
            available={sortedRoster.length > 0 && sortedRoster[sortedRoster.length - 1]?.morale < 50}
            onActivate={() => {
              if (sortedRoster.length === 0) return;
              const lowest = [...sortedRoster].sort((a, b) => a.morale - b.morale)[0];
              applyManualBoost(
                lowest.player.id,
                getPlayerName(lowest.player),
                12,
                'personal coaching session',
                currentDay
              );
            }}
          />
        </div>
      </Panel>
    </div>
  );
}

// ── Action Card ──────────────────────────────────────────────────────────────

function ActionCard({
  title, cost, effect, description, available, onActivate,
}: {
  title: string;
  cost: string;
  effect: string;
  description: string;
  available: boolean;
  onActivate: () => void;
}) {
  const [used, setUsed] = useState(false);

  return (
    <div className={cn(
      'border rounded-lg p-4 flex flex-col gap-2 transition-colors',
      available && !used
        ? 'border-gold/30 bg-gold/5 hover:bg-gold/10'
        : 'border-navy-lighter/30 bg-navy-lighter/10 opacity-60'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-display text-cream text-sm uppercase tracking-wide">{title}</div>
        <div className="font-mono text-xs text-gold bg-gold/10 px-2 py-0.5 rounded shrink-0">{cost}</div>
      </div>
      <div className="font-mono text-green-400 text-xs">{effect}</div>
      <p className="font-mono text-cream-dim/60 text-xs flex-1">{description}</p>
      <Button
        size="sm"
        variant={available && !used ? 'primary' : 'secondary'}
        disabled={!available || used}
        onClick={() => {
          if (!available || used) return;
          onActivate();
          setUsed(true);
        }}
      >
        {used ? 'Applied' : available ? 'Activate' : 'Not Available'}
      </Button>
    </div>
  );
}
