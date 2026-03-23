import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { generateHighlights, type LeagueHighlight, type HighlightType } from '@/engine/season/LeagueHighlights.ts';
import { cn } from '@/lib/cn.ts';

// ── Type meta ───────────────────────────────────────────────────
const TYPE_META: Record<HighlightType, { label: string; color: string; bgColor: string; borderColor: string }> = {
  shutout:        { label: 'SHUTOUT',       color: 'text-blue-400',     bgColor: 'bg-blue-400/10',     borderColor: 'border-blue-400/30' },
  blowout:        { label: 'BLOWOUT',       color: 'text-red-400',      bgColor: 'bg-red-400/10',      borderColor: 'border-red-400/30' },
  walk_off:       { label: 'WALK-OFF',      color: 'text-gold',         bgColor: 'bg-gold/10',         borderColor: 'border-gold/40' },
  one_run:        { label: 'NAIL-BITER',    color: 'text-emerald-400',  bgColor: 'bg-emerald-400/10',  borderColor: 'border-emerald-400/30' },
  high_scoring:   { label: 'SLUGFEST',      color: 'text-orange-400',   bgColor: 'bg-orange-400/10',   borderColor: 'border-orange-400/30' },
  win_streak:     { label: 'HOT STREAK',    color: 'text-green-light',  bgColor: 'bg-green-900/15',    borderColor: 'border-green-light/30' },
  lose_streak:    { label: 'COLD STREAK',   color: 'text-red-400',      bgColor: 'bg-red-900/15',      borderColor: 'border-red-400/30' },
  milestone_win:  { label: 'MILESTONE',     color: 'text-gold',         bgColor: 'bg-gold/10',         borderColor: 'border-gold/40' },
  best_record:    { label: 'TOP DOG',       color: 'text-gold',         bgColor: 'bg-gold/10',         borderColor: 'border-gold/40' },
  worst_record:   { label: 'STRUGGLING',    color: 'text-cream-dim',    bgColor: 'bg-navy-lighter/15', borderColor: 'border-navy-lighter/30' },
  pennant_race:   { label: 'PENNANT RACE',  color: 'text-gold',         bgColor: 'bg-gold/15',         borderColor: 'border-gold/50' },
};

// ── Importance stars ────────────────────────────────────────────
function ImportanceBadge({ level }: { level: 1 | 2 | 3 }) {
  const stars = level === 3 ? '***' : level === 2 ? '**' : '*';
  const color = level === 3 ? 'text-gold' : level === 2 ? 'text-cream' : 'text-cream-dim/40';
  return <span className={cn('font-mono text-[10px]', color)}>{stars}</span>;
}

// ── Highlight card ──────────────────────────────────────────────
function HighlightCard({ highlight, isUserTeam }: { highlight: LeagueHighlight; isUserTeam: boolean }) {
  const meta = TYPE_META[highlight.type];
  return (
    <div className={cn(
      'rounded-lg border px-4 py-3 transition-all duration-200',
      meta.bgColor, meta.borderColor,
      isUserTeam && 'ring-1 ring-gold/30',
      highlight.importance === 3 && 'shadow-lg',
    )}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border', meta.color, meta.borderColor, meta.bgColor)}>
            {meta.label}
          </span>
          <ImportanceBadge level={highlight.importance} />
        </div>
        <span className="font-mono text-[10px] text-cream-dim/40 shrink-0">Day {highlight.day}</span>
      </div>
      <p className={cn('font-display text-sm uppercase tracking-wide mb-1', meta.color)}>{highlight.headline}</p>
      <p className="font-mono text-xs text-cream-dim/70 leading-relaxed">{highlight.detail}</p>
      {isUserTeam && (
        <span className="inline-block mt-1.5 font-mono text-[9px] text-gold/60 bg-gold/10 border border-gold/20 rounded px-1.5 py-0.5">YOUR TEAM</span>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export function LeagueHighlightsPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId } = useFranchiseStore();

  const team = useMemo(() => {
    if (!engine || !userTeamId) return null;
    return engine.getTeam(userTeamId) ?? null;
  }, [engine, userTeamId]);

  const highlights = useMemo(() => {
    if (!engine || !season) return [];
    return generateHighlights(season.schedule, season.standings, engine.getAllTeams(), season.currentDay);
  }, [engine, season]);

  if (!team || !season) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Around the League</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          League-wide highlights, milestones, and dramatic moments from across all 30 teams.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  // Category counts
  const gameHighlights = highlights.filter(h => ['shutout','blowout','walk_off','one_run','high_scoring'].includes(h.type));
  const streakHighlights = highlights.filter(h => ['win_streak','lose_streak'].includes(h.type));
  const seasonHighlights = highlights.filter(h => ['milestone_win','best_record','worst_record','pennant_race'].includes(h.type));
  const historicHighlights = highlights.filter(h => h.importance === 3);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Around the League</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Day {season.currentDay} of {season.totalDays} · {highlights.length} highlight{highlights.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/news')}>League News</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Game Highlights', count: gameHighlights.length, color: 'text-blue-400' },
          { label: 'Streaks', count: streakHighlights.length, color: 'text-green-light' },
          { label: 'Season Milestones', count: seasonHighlights.length, color: 'text-gold' },
          { label: 'Historic', count: historicHighlights.length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="text-center p-3 rounded-lg bg-navy-lighter/15 border border-navy-lighter/30">
            <p className={cn('font-display text-2xl font-bold', s.color)}>{s.count}</p>
            <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Historic moments (importance 3) */}
      {historicHighlights.length > 0 && (
        <Panel title="Historic Moments">
          <div className="space-y-3">
            {historicHighlights.map(h => (
              <HighlightCard key={h.id} highlight={h} isUserTeam={h.teamIds.includes(userTeamId!)} />
            ))}
          </div>
        </Panel>
      )}

      {/* Game highlights */}
      {gameHighlights.length > 0 && (
        <Panel title="Game Highlights">
          <p className="font-mono text-[10px] text-cream-dim/40 mb-3">Notable results from the past week</p>
          <div className="space-y-2">
            {gameHighlights.map(h => (
              <HighlightCard key={h.id} highlight={h} isUserTeam={h.teamIds.includes(userTeamId!)} />
            ))}
          </div>
        </Panel>
      )}

      {/* Streaks */}
      {streakHighlights.length > 0 && (
        <Panel title="Hot & Cold Streaks">
          <div className="space-y-2">
            {streakHighlights.map(h => (
              <HighlightCard key={h.id} highlight={h} isUserTeam={h.teamIds.includes(userTeamId!)} />
            ))}
          </div>
        </Panel>
      )}

      {/* Season milestones */}
      {seasonHighlights.length > 0 && (
        <Panel title="Season Milestones">
          <div className="space-y-2">
            {seasonHighlights.map(h => (
              <HighlightCard key={h.id} highlight={h} isUserTeam={h.teamIds.includes(userTeamId!)} />
            ))}
          </div>
        </Panel>
      )}

      {/* Empty state */}
      {highlights.length === 0 && (
        <Panel>
          <div className="text-center py-12">
            <p className="font-display text-cream-dim text-lg">No highlights yet</p>
            <p className="font-mono text-cream-dim/40 text-xs mt-2">
              Simulate games from the Dashboard to generate league-wide highlights.
            </p>
          </div>
        </Panel>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 justify-center pb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/scoreboard')}>Scoreboard</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/standings')}>Standings</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/leaders')}>League Leaders</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/game-log')}>Game Log</Button>
      </div>
    </div>
  );
}
