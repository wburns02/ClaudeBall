import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { computeFormSummary, FORM_STATUS_CONFIG } from '@/engine/performance/HotColdEngine.ts';
import type { FormSummary, FormStatus } from '@/engine/performance/HotColdEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';

function StatusBadge({ status }: { status: FormStatus }) {
  const cfg = FORM_STATUS_CONFIG[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold border',
      cfg.bgColor, cfg.borderColor, cfg.color,
    )}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function FormBar({ score }: { score: number }) {
  // -20..+20 → 0..100%
  const pct = Math.round(((score + 20) / 40) * 100);
  const color = score >= 12 ? 'bg-orange-500' : score >= 4 ? 'bg-yellow-400' : score <= -12 ? 'bg-blue' : score <= -4 ? 'bg-blue/60' : 'bg-cream-dim';
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-20 h-2 bg-navy-lighter rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-navy-lighter/60" />
        <div
          className={cn('absolute inset-y-0 rounded-full transition-all', color)}
          style={{
            left: pct >= 50 ? '50%' : `${pct}%`,
            right: pct < 50 ? '50%' : `${100 - pct}%`,
          }}
        />
      </div>
      <span className={cn('text-xs font-mono', score > 0 ? 'text-yellow-400' : score < 0 ? 'text-blue' : 'text-cream-dim')}>
        {score > 0 ? '+' : ''}{score}
      </span>
    </div>
  );
}

type SortKey = 'name' | 'pos' | 'form' | 'status' | 'recent';
type FilterMode = 'all' | 'hot' | 'cold' | 'batters' | 'pitchers';

export function HotColdPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, teams } = useFranchiseStore();
  const playerStats = useStatsStore(s => s.playerStats);

  const [sortKey, setSortKey] = useState<SortKey>('form');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [showLeague, setShowLeague] = useState(false);

  const userTeam = useMemo(
    () => teams.find(t => t.id === userTeamId) ?? engine?.getTeam(userTeamId ?? '') ?? null,
    [teams, userTeamId, engine],
  );

  // Build form summaries
  const summaries: FormSummary[] = useMemo(() => {
    const source = showLeague ? teams : (userTeam ? [userTeam] : []);
    const result: FormSummary[] = [];
    for (const team of source) {
      for (const player of team.roster.players) {
        const stats = playerStats[player.id];
        const form = computeFormSummary(
          player.id,
          stats?.gameLog ?? [],
          player.position,
          stats?.batting.ab ? { ab: stats.batting.ab, h: stats.batting.h, bb: stats.batting.bb, hr: stats.batting.hr } : undefined,
          stats?.pitching.ip ? { ip: stats.pitching.ip / 3, er: stats.pitching.er, bb: stats.pitching.bb, so: stats.pitching.so } : undefined,
        );
        result.push(form);
      }
    }
    return result;
  }, [showLeague, teams, userTeam, playerStats]);

  // Sorted + filtered list
  const rows = useMemo(() => {
    let filtered = summaries;
    if (filter === 'hot') filtered = filtered.filter(s => s.status === 'hot' || s.status === 'warm');
    if (filter === 'cold') filtered = filtered.filter(s => s.status === 'cold' || s.status === 'cool');
    if (filter === 'batters') filtered = filtered.filter(s => !s.isPitcher);
    if (filter === 'pitchers') filtered = filtered.filter(s => s.isPitcher);

    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'form') diff = a.formScore - b.formScore;
      else if (sortKey === 'status') diff = a.formScore - b.formScore; // same as form
      else if (sortKey === 'recent') diff = (a.recentBA ?? a.recentERA ?? 0) - (b.recentBA ?? b.recentERA ?? 0);
      return sortAsc ? diff : -diff;
    });
  }, [summaries, filter, sortKey, sortAsc]);

  // Get player objects for display
  const allRosterPlayers = useMemo(() => {
    const map = new Map<string, { player: import('@/engine/types/player.ts').Player; teamName: string }>();
    for (const team of teams) {
      for (const p of team.roster.players) {
        map.set(p.id, { player: p, teamName: `${team.city} ${team.name}` });
      }
    }
    return map;
  }, [teams]);

  if (!userTeam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Hot &amp; Cold</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Track which players are on hot streaks and who's slumping based on recent game performance.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const hotCount = summaries.filter(s => s.status === 'hot' || s.status === 'warm').length;
  const coldCount = summaries.filter(s => s.status === 'cold' || s.status === 'cool').length;

  const sortCol = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => sortCol(k)}
      className="px-3 py-2 text-left text-xs font-mono text-cream-dim uppercase tracking-wider cursor-pointer hover:text-cream select-none"
    >
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Hot &amp; Cold Tracker</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          Player performance trends — based on last 7 games (batters) / 3 starts (pitchers)
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3 text-center">
          <p className="font-display text-2xl text-orange-400">{summaries.filter(s => s.status === 'hot').length}</p>
          <p className="font-mono text-xs text-orange-300/70 uppercase tracking-wider mt-0.5">🔥 On Fire</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-center">
          <p className="font-display text-2xl text-yellow-400">{summaries.filter(s => s.status === 'warm').length}</p>
          <p className="font-mono text-xs text-yellow-300/70 uppercase tracking-wider mt-0.5">↑ Trending Up</p>
        </div>
        <div className="bg-blue/10 border border-blue/30 rounded-lg px-4 py-3 text-center">
          <p className="font-display text-2xl text-blue">{summaries.filter(s => s.status === 'cool').length}</p>
          <p className="font-mono text-xs text-blue/70 uppercase tracking-wider mt-0.5">↓ Slowing Down</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 text-center">
          <p className="font-display text-2xl text-blue-300">{summaries.filter(s => s.status === 'cold').length}</p>
          <p className="font-mono text-xs text-blue-200/70 uppercase tracking-wider mt-0.5">❄ Ice Cold</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex gap-1 flex-wrap">
          {(['all', 'hot', 'cold', 'batters', 'pitchers'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer',
                filter === f
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'text-cream-dim hover:text-cream bg-navy-lighter/20 border border-navy-lighter hover:bg-navy-lighter/40',
              )}
            >
              {f === 'hot' ? `🔥 Hot (${hotCount})` : f === 'cold' ? `❄ Cold (${coldCount})` : f}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowLeague(v => !v)}
            className={cn(
              'px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer border',
              showLeague
                ? 'bg-gold/20 text-gold border-gold/40'
                : 'text-cream-dim hover:text-cream bg-navy-lighter/20 border-navy-lighter',
            )}
          >
            {showLeague ? 'Your Team' : 'League View'}
          </button>
        </div>
      </div>

      {/* Preseason hint — all players start neutral, so the table shows but trends are flat */}
      {summaries.length > 0 && summaries.every(s => s.recentGames === 0) && (
        <div className="mb-4 px-4 py-3 rounded-md bg-gold/5 border border-gold/20 font-mono text-sm text-gold/80 flex items-start gap-2">
          <span>ℹ</span>
          <span>All players are at baseline — advance days or simulate games to see hot &amp; cold trends develop.</span>
        </div>
      )}

      {rows.length === 0 ? (
        <Panel title="No Data">
          <div className="py-12 text-center">
            <p className="font-mono text-cream-dim text-sm">No performance data yet.</p>
            <p className="font-mono text-cream-dim/60 text-xs mt-2">
              Play or simulate some games to see hot &amp; cold trends appear.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel title={`Performance Tracker — ${rows.length} Players`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="px-3 py-2 text-left text-xs font-mono text-cream-dim uppercase tracking-wider">Player</th>
                  <th className="px-3 py-2 text-left text-xs font-mono text-cream-dim uppercase tracking-wider">Pos</th>
                  <SortTh k="status" label="Status" />
                  <SortTh k="form" label="Form" />
                  <th className="px-3 py-2 text-left text-xs font-mono text-cream-dim uppercase tracking-wider">Recent (7G)</th>
                  <th className="px-3 py-2 text-left text-xs font-mono text-cream-dim uppercase tracking-wider">Season</th>
                  <th className="px-3 py-2 text-left text-xs font-mono text-cream-dim uppercase tracking-wider">Streak</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((form, i) => {
                  const entry = allRosterPlayers.get(form.playerId);
                  if (!entry) return null;
                  const { player, teamName } = entry;
                  return (
                    <tr
                      key={form.playerId}
                      onClick={() => navigate(`/franchise/player-stats/${form.playerId}`)}
                      className={cn(
                        'border-b border-navy-lighter/30 cursor-pointer transition-colors',
                        i % 2 === 0 ? 'bg-navy-lighter/5' : 'bg-transparent',
                        'hover:bg-navy-lighter/40',
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <p className="text-cream text-sm font-body">{getPlayerName(player)}</p>
                        {showLeague && (
                          <p className="text-cream-dim/60 text-xs font-mono">{teamName}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-cream-dim">{player.position}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={form.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <FormBar score={form.formScore} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {form.recentGames === 0 ? (
                          <span className="text-cream-dim/30">—</span>
                        ) : form.isPitcher ? (
                          <span className={form.recentERA !== undefined && form.recentERA < 3 ? 'text-green-light' : form.recentERA !== undefined && form.recentERA > 6 ? 'text-red' : 'text-cream'}>
                            {form.recentERA?.toFixed(2) ?? '—'} ERA / {form.recentK ?? 0}K
                          </span>
                        ) : (
                          <span className={form.recentBA !== undefined && form.recentBA > 0.320 ? 'text-gold' : form.recentBA !== undefined && form.recentBA < 0.180 ? 'text-red' : 'text-cream'}>
                            .{((form.recentBA ?? 0) * 1000).toFixed(0).padStart(3, '0')} / {form.recentHR ?? 0}HR / {form.recentRBI ?? 0}RBI
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-cream-dim">
                        {form.isPitcher
                          ? (form.seasonERA !== undefined ? `${form.seasonERA.toFixed(2)} ERA` : '—')
                          : (form.seasonBA !== undefined ? `.${Math.round(form.seasonBA * 1000).toString().padStart(3, '0')}` : '—')}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {form.streakLabel !== '—' ? (
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-xs',
                            form.status === 'hot' ? 'text-orange-400' : form.status === 'warm' ? 'text-yellow-400' :
                            form.status === 'cold' ? 'text-blue-300' : form.status === 'cool' ? 'text-blue' : 'text-cream-dim',
                          )}>
                            {form.streakLabel}
                          </span>
                        ) : (
                          <span className="text-cream-dim/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-navy-lighter flex flex-wrap gap-4">
            {(Object.entries(FORM_STATUS_CONFIG) as [FormStatus, typeof FORM_STATUS_CONFIG[FormStatus]][]).map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={cn('font-mono text-xs', cfg.color)}>{cfg.icon}</span>
                <span className="font-mono text-xs text-cream-dim">{cfg.label}</span>
                <span className="font-mono text-xs text-cream-dim/50">
                  {cfg.ratingMod > 0 ? `+${Math.round(cfg.ratingMod * 100)}%` : cfg.ratingMod < 0 ? `${Math.round(cfg.ratingMod * 100)}%` : '±0%'} ratings
                </span>
              </div>
            ))}
            <p className="font-mono text-xs text-cream-dim/40 ml-auto">Morale affects QuickSim game outcomes</p>
          </div>
        </Panel>
      )}
    </div>
  );
}
