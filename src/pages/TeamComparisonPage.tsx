/**
 * TeamComparisonPage — side-by-side comparison of any two teams.
 * Strengths, weaknesses, head-to-head, roster comparison.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';

function CompBar({ label, leftVal, rightVal, leftColor, rightColor }: {
  label: string; leftVal: number; rightVal: number; leftColor?: string; rightColor?: string;
}) {
  const max = Math.max(leftVal, rightVal, 1);
  const lPct = (leftVal / max) * 100;
  const rPct = (rightVal / max) * 100;
  const lWins = leftVal > rightVal;
  const rWins = rightVal > leftVal;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className={cn('font-mono text-xs font-bold w-12 text-right', lWins ? (leftColor ?? 'text-gold') : 'text-cream-dim/50')}>{leftVal}</span>
        <span className="font-mono text-[10px] text-cream-dim/60 uppercase tracking-wider flex-1 text-center">{label}</span>
        <span className={cn('font-mono text-xs font-bold w-12', rWins ? (rightColor ?? 'text-blue-400') : 'text-cream-dim/50')}>{rightVal}</span>
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 bg-navy-lighter/20 rounded-full overflow-hidden flex justify-end">
          <div className={cn('h-full rounded-full transition-all duration-700', lWins ? 'bg-gold' : 'bg-gold/30')} style={{ width: `${lPct}%` }} />
        </div>
        <div className="flex-1 bg-navy-lighter/20 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-700', rWins ? 'bg-blue-400' : 'bg-blue-400/30')} style={{ width: `${rPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function TeamComparisonPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId } = useFranchiseStore();

  const allTeams = useMemo(() => engine?.getAllTeams() ?? [], [engine]);
  const [leftId, setLeftId] = useState<string>(userTeamId ?? '');
  const [rightId, setRightId] = useState<string>('');

  // Auto-pick opponent on mount
  useEffect(() => {
    if (!rightId && allTeams.length > 1) {
      const other = allTeams.find(t => t.id !== leftId);
      if (other) setRightId(other.id);
    }
  }, [allTeams, leftId, rightId]);

  if (!engine || !season) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Team Comparison</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Compare any two teams side-by-side — rosters, stats, strengths, and head-to-head.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const leftTeam = engine.getTeam(leftId);
  const rightTeam = engine.getTeam(rightId);
  const leftRecord = leftId ? season.standings.getRecord(leftId) : null;
  const rightRecord = rightId ? season.standings.getRecord(rightId) : null;

  // Team OVR calculations
  const calcTeamOvr = (teamId: string) => {
    const t = engine.getTeam(teamId);
    if (!t) return { off: 0, pit: 0, def: 0, ovr: 0 };
    const batters = t.roster.players.filter(p => p.position !== 'P');
    const pitchers = t.roster.players.filter(p => p.position === 'P');
    const off = batters.length > 0 ? Math.round(batters.reduce((s, p) => s + evaluatePlayer(p), 0) / batters.length) : 0;
    const pit = pitchers.length > 0 ? Math.round(pitchers.reduce((s, p) => s + evaluatePlayer(p), 0) / pitchers.length) : 0;
    const def = off; // simplified
    const ovr = Math.round((off + pit) / 2);
    return { off, pit, def, ovr };
  };

  const leftStats = calcTeamOvr(leftId);
  const rightStats = calcTeamOvr(rightId);

  // Head-to-head record
  const h2h = useMemo(() => {
    if (!leftId || !rightId) return { left: 0, right: 0 };
    let left = 0, right = 0;
    for (const g of season.schedule) {
      if (!g.played || g.awayScore === undefined) continue;
      if ((g.awayId === leftId && g.homeId === rightId) || (g.homeId === leftId && g.awayId === rightId)) {
        const leftScore = g.awayId === leftId ? g.awayScore : g.homeScore!;
        const rightScore = g.awayId === rightId ? g.awayScore : g.homeScore!;
        if (leftScore > rightScore) left++;
        else right++;
      }
    }
    return { left, right };
  }, [season.schedule, leftId, rightId]);

  // Top players per team
  const getTopPlayers = (teamId: string) => {
    const t = engine.getTeam(teamId);
    if (!t) return [];
    return t.roster.players
      .map(p => ({ player: p, ovr: Math.round(evaluatePlayer(p)) }))
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 5);
  };

  const leftTop = getTopPlayers(leftId);
  const rightTop = getTopPlayers(rightId);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Team Comparison</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">Side-by-side analysis of any two teams</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise')}>Dashboard</Button>
      </div>

      {/* Team Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-mono text-[10px] text-gold/50 uppercase tracking-widest mb-1">Team A</p>
          <select
            value={leftId}
            onChange={e => setLeftId(e.target.value)}
            className="w-full bg-navy-light border border-gold/30 rounded-md px-3 py-2 font-mono text-sm text-cream focus:outline-none focus:border-gold/60 appearance-none cursor-pointer"
          >
            {allTeams.map(t => (
              <option key={t.id} value={t.id} style={{ background: '#0f1829', color: '#e8e0d4' }}>
                {t.city} {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="font-mono text-[10px] text-blue-400/50 uppercase tracking-widest mb-1">Team B</p>
          <select
            value={rightId}
            onChange={e => setRightId(e.target.value)}
            className="w-full bg-navy-light border border-blue-400/30 rounded-md px-3 py-2 font-mono text-sm text-cream focus:outline-none focus:border-blue-400/60 appearance-none cursor-pointer"
          >
            {allTeams.filter(t => t.id !== leftId).map(t => (
              <option key={t.id} value={t.id} style={{ background: '#0f1829', color: '#e8e0d4' }}>
                {t.city} {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Head-to-Head + Records */}
      {leftTeam && rightTeam && (
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl border border-gold/30 bg-gold/5">
            <p className="font-display text-3xl text-gold font-bold">{leftRecord ? `${leftRecord.wins}-${leftRecord.losses}` : '—'}</p>
            <p className="font-mono text-[10px] text-gold/60 uppercase tracking-widest mt-1">{leftTeam.abbreviation}</p>
          </div>
          <div className="text-center p-4 rounded-xl border border-navy-lighter/40 bg-navy-lighter/10 flex flex-col justify-center">
            <p className="font-mono text-[9px] text-cream-dim/40 uppercase tracking-widest mb-1">Head-to-Head</p>
            <p className="font-display text-2xl text-cream">
              <span className="text-gold">{h2h.left}</span>
              <span className="text-cream-dim/30 mx-1">-</span>
              <span className="text-blue-400">{h2h.right}</span>
            </p>
          </div>
          <div className="text-center p-4 rounded-xl border border-blue-400/30 bg-blue-400/5">
            <p className="font-display text-3xl text-blue-400 font-bold">{rightRecord ? `${rightRecord.wins}-${rightRecord.losses}` : '—'}</p>
            <p className="font-mono text-[10px] text-blue-400/60 uppercase tracking-widest mt-1">{rightTeam.abbreviation}</p>
          </div>
        </div>
      )}

      {/* Stat Comparison Bars */}
      <Panel title="Team Ratings">
        <CompBar label="OVR" leftVal={leftStats.ovr} rightVal={rightStats.ovr} />
        <CompBar label="Offense" leftVal={leftStats.off} rightVal={rightStats.off} />
        <CompBar label="Pitching" leftVal={leftStats.pit} rightVal={rightStats.pit} />
        <CompBar label="Wins" leftVal={leftRecord?.wins ?? 0} rightVal={rightRecord?.wins ?? 0} />
        <CompBar label="Losses" leftVal={leftRecord?.losses ?? 0} rightVal={rightRecord?.losses ?? 0} />
        <CompBar label="Roster Size" leftVal={leftTeam?.roster.players.length ?? 0} rightVal={rightTeam?.roster.players.length ?? 0} />
      </Panel>

      {/* Top Players */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title={`${leftTeam?.abbreviation ?? 'A'} Top Players`}>
          <div className="space-y-1.5">
            {leftTop.map(({ player: p, ovr }) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gold/5 transition-colors">
                <span className={cn('font-mono text-xs font-bold w-8', ovr >= 70 ? 'text-gold' : ovr >= 55 ? 'text-green-light' : 'text-cream-dim')}>{ovr}</span>
                <span className="font-body text-sm text-cream flex-1 truncate">{getPlayerName(p)}</span>
                <span className="font-mono text-[10px] text-cream-dim/40">{p.position}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={`${rightTeam?.abbreviation ?? 'B'} Top Players`}>
          <div className="space-y-1.5">
            {rightTop.map(({ player: p, ovr }) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-400/5 transition-colors">
                <span className={cn('font-mono text-xs font-bold w-8', ovr >= 70 ? 'text-gold' : ovr >= 55 ? 'text-green-light' : 'text-cream-dim')}>{ovr}</span>
                <span className="font-body text-sm text-cream flex-1 truncate">{getPlayerName(p)}</span>
                <span className="font-mono text-[10px] text-cream-dim/40">{p.position}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2 justify-center pb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/standings')}>Standings</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/power-rankings')}>Power Rankings</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/compare')}>Player Compare</Button>
      </div>
    </div>
  );
}
