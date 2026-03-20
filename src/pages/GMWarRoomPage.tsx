/**
 * GM War Room — Strategic overview & decision support
 * Inspired by OOTP Baseball's GM Dashboard and Baseball Mogul's trade finder.
 *
 * Shows: roster needs, available upgrades (FA + trade targets), motivated sellers,
 * trade asset tiers, schedule strength, and quick-action links.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { winPct, gamesBehind } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Position } from '@/engine/types/enums.ts';

// ── Grade helpers ──────────────────────────────────────────────────────────────

function ovr(p: Player) { return Math.round(evaluatePlayer(p)); }

function letterGrade(v: number): string {
  if (v >= 78) return 'A+';
  if (v >= 72) return 'A';
  if (v >= 66) return 'B+';
  if (v >= 60) return 'B';
  if (v >= 54) return 'C+';
  if (v >= 48) return 'C';
  if (v >= 42) return 'D';
  return 'F';
}

function gradeColor(v: number): string {
  if (v >= 72) return 'text-gold';
  if (v >= 60) return 'text-green-400';
  if (v >= 48) return 'text-cream';
  if (v >= 42) return 'text-yellow-500';
  return 'text-red-400';
}

function gradeBg(v: number): string {
  if (v >= 72) return 'bg-gold/15 border-gold/40';
  if (v >= 60) return 'bg-green-400/10 border-green-400/30';
  if (v >= 48) return 'bg-navy-lighter/30 border-navy-lighter/50';
  if (v >= 42) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-red-400/10 border-red-400/30';
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FIELD_POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const POS_FULL: Record<string, string> = {
  C: 'Catcher', '1B': '1st Base', '2B': '2nd Base', '3B': '3rd Base',
  SS: 'Shortstop', LF: 'Left Field', CF: 'Center Field', RF: 'Right Field', DH: 'DH',
};

type NeedLevel = 'critical' | 'high' | 'medium';

interface RosterNeed {
  pos: Position;
  label: string;
  level: NeedLevel;
  currentOvr: number;
  reason: string;
}

interface TradeTarget {
  player: Player;
  teamId: string;
  teamAbbr: string;
  teamRecord: string;
  teamNeedsPos: boolean; // does this team need your surplus?
}

// ── Micro components ───────────────────────────────────────────────────────────

function NeedBadge({ level }: { level: NeedLevel }) {
  const styles = {
    critical: 'bg-red-400/20 border-red-400/50 text-red-400',
    high:     'bg-orange-400/20 border-orange-400/50 text-orange-400',
    medium:   'bg-yellow-500/15 border-yellow-500/40 text-yellow-400',
  };
  const labels = { critical: '🔴 CRITICAL', high: '🟠 HIGH', medium: '🟡 MEDIUM' };
  return (
    <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider shrink-0', styles[level])}>
      {labels[level]}
    </span>
  );
}

function TargetCard({
  player,
  teamAbbr,
  source,
  onClick,
}: {
  player: Player;
  teamAbbr: string;
  source: 'fa' | 'trade';
  onClick: () => void;
}) {
  const o = ovr(player);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-navy-lighter/30 bg-navy-light/20 hover:border-gold/30 hover:bg-navy-lighter/20 transition-all text-left group cursor-pointer"
    >
      <div className={cn('w-8 h-8 rounded border flex items-center justify-center font-mono text-xs font-bold shrink-0', gradeBg(o))}>
        <span className={gradeColor(o)}>{letterGrade(o)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-cream truncate group-hover:text-gold transition-colors">
          {getPlayerName(player)}
        </p>
        <p className="font-mono text-[10px] text-cream-dim/50">
          {player.position} · Age {player.age} · {teamAbbr}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn(
          'font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wide',
          source === 'fa'
            ? 'text-green-400 border-green-400/30 bg-green-400/10'
            : 'text-blue-400 border-blue-400/30 bg-blue-400/10',
        )}>
          {source === 'fa' ? 'FA' : 'TRADE'}
        </span>
        <span className={cn('font-mono text-sm font-bold', gradeColor(o))}>{o}</span>
      </div>
    </button>
  );
}

function AssetCard({ player, tier, onClick }: { player: Player; tier: string; onClick: () => void }) {
  const o = ovr(player);
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-navy-lighter/30 bg-navy-light/20 hover:border-gold/30 transition-all cursor-pointer text-left w-full group"
    >
      <div className="flex-1 min-w-0">
        <p className="font-body text-xs text-cream truncate group-hover:text-gold transition-colors">{getPlayerName(player)}</p>
        <p className="font-mono text-[10px] text-cream-dim/40">{player.position} · {player.age}y</p>
      </div>
      <span className={cn('font-mono text-sm font-bold shrink-0', gradeColor(o))}>{o}</span>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function GMWarRoomPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId, teams, getTeamPayroll, getTeamInjuries, teamBudgets } = useFranchiseStore();
  const userTeam = engine && userTeamId ? engine.getTeam(userTeamId) : null;

  const {
    rosterNeeds,
    upgradeTargets,
    motivatedSellers,
    tradeAssets,
    scheduleStrength,
    teamOvr,
    payrollRoom,
    deadlineDays,
  } = useMemo(() => {
    if (!userTeam || !engine || !season || !userTeamId) return {
      rosterNeeds: [], upgradeTargets: new Map<Position, TradeTarget[]>(), motivatedSellers: [], tradeAssets: {
        untouchable: [], premium: [], tradeable: [], filler: [],
      }, scheduleStrength: 0, teamOvr: 0, payrollRoom: 0, deadlineDays: null,
    };

    const myPlayers = userTeam.roster.players;
    const myPositionPlayers = myPlayers.filter(p => p.position !== 'P');
    const allTeams = teams.length > 0 ? teams : engine.getAllTeams();
    const otherTeams = allTeams.filter(t => t.id !== userTeamId);

    // ── Roster Needs ───────────────────────────────────────────────────────────
    const rosterNeeds: RosterNeed[] = [];
    for (const pos of FIELD_POSITIONS) {
      const eligible = myPositionPlayers.filter(p =>
        p.position === pos || p.fielding.some(f => f.position === pos)
      ).sort((a, b) => ovr(b) - ovr(a));
      const starter = eligible[0];
      const starterOvr = starter ? ovr(starter) : 0;

      if (!starter || starterOvr < 42) {
        rosterNeeds.push({
          pos, label: POS_FULL[pos],
          level: 'critical',
          currentOvr: starterOvr,
          reason: !starter ? 'No player at this position' : `Starter is D/F grade (${starterOvr} OVR)`,
        });
      } else if (starterOvr < 55) {
        rosterNeeds.push({
          pos, label: POS_FULL[pos],
          level: 'high',
          currentOvr: starterOvr,
          reason: `Starter is below average (${starterOvr} OVR)`,
        });
      } else if (eligible.length < 2 && starterOvr < 68) {
        rosterNeeds.push({
          pos, label: POS_FULL[pos],
          level: 'medium',
          currentOvr: starterOvr,
          reason: `No backup at this position`,
        });
      }
    }

    // ── Available Upgrades (FA + Trade Targets) ───────────────────────────────
    // Free agents: players on teams with record < .400 (motivated sellers) who play needed positions
    const upgradeTargets = new Map<Position, TradeTarget[]>();
    const currentDay = season.currentDay;
    const injuredIds = new Set(getTeamInjuries(userTeamId).map(r => r.playerId));

    for (const need of rosterNeeds.slice(0, 5)) {
      const targets: TradeTarget[] = [];
      for (const team of otherTeams) {
        const rec = season.standings.getRecord(team.id);
        const gp = rec ? rec.wins + rec.losses : 0;
        const wp = rec && gp > 0 ? rec.wins / gp : 0.5;
        const isSeller = wp < 0.45 || (gp < 20 && currentDay > 30);
        const teamAbbr = team.abbreviation ?? team.id.slice(0, 3).toUpperCase();
        const recStr = rec ? `${rec.wins}-${rec.losses}` : '0-0';

        const candidates = team.roster.players.filter(p =>
          (p.position === need.pos || p.fielding.some(f => f.position === need.pos)) &&
          ovr(p) > need.currentOvr + 5 &&
          !injuredIds.has(p.id)
        ).sort((a, b) => ovr(b) - ovr(a)).slice(0, 2);

        for (const p of candidates) {
          targets.push({
            player: p,
            teamId: team.id,
            teamAbbr,
            teamRecord: recStr,
            teamNeedsPos: isSeller,
          });
        }
      }
      targets.sort((a, b) => ovr(b.player) - ovr(a.player));
      upgradeTargets.set(need.pos, targets.slice(0, 4));
    }

    // ── Motivated Sellers ─────────────────────────────────────────────────────
    const motivatedSellers: { teamId: string; name: string; record: string; wp: number; topPlayers: Player[] }[] = [];
    for (const team of otherTeams) {
      const rec = season.standings.getRecord(team.id);
      const gp = rec ? rec.wins + rec.losses : 0;
      if (gp < 10) continue; // Not enough games
      const wp = rec ? rec.wins / gp : 0.5;
      if (wp < 0.42) {
        const topPlayers = team.roster.players
          .filter(p => ovr(p) >= 60)
          .sort((a, b) => ovr(b) - ovr(a))
          .slice(0, 3);
        if (topPlayers.length > 0) {
          motivatedSellers.push({
            teamId: team.id,
            name: `${team.city} ${team.name}`,
            record: rec ? `${rec.wins}-${rec.losses}` : '0-0',
            wp,
            topPlayers,
          });
        }
      }
    }
    motivatedSellers.sort((a, b) => a.wp - b.wp).splice(6);

    // ── Trade Assets ───────────────────────────────────────────────────────────
    const allMyPlayers = [...myPlayers].sort((a, b) => ovr(b) - ovr(a));
    const tradeAssets = {
      untouchable: allMyPlayers.filter(p => ovr(p) >= 75).slice(0, 4),
      premium: allMyPlayers.filter(p => ovr(p) >= 65 && ovr(p) < 75).slice(0, 6),
      tradeable: allMyPlayers.filter(p => ovr(p) >= 50 && ovr(p) < 65).slice(0, 8),
      filler: allMyPlayers.filter(p => ovr(p) < 50).slice(0, 5),
    };

    // ── Schedule Strength (next 10 games) ──────────────────────────────────────
    const upcoming = season.schedule
      .filter(g =>
        !g.played &&
        g.date > currentDay &&
        (g.awayId === userTeamId || g.homeId === userTeamId)
      )
      .sort((a, b) => a.date - b.date)
      .slice(0, 10);

    let oppWpSum = 0;
    for (const g of upcoming) {
      const oppId = g.awayId === userTeamId ? g.homeId : g.awayId;
      const rec = season.standings.getRecord(oppId);
      const gp = rec ? rec.wins + rec.losses : 0;
      oppWpSum += rec && gp > 0 ? rec.wins / gp : 0.5;
    }
    const scheduleStrength = upcoming.length > 0 ? (oppWpSum / upcoming.length) : 0.5;

    // ── Team OVR ───────────────────────────────────────────────────────────────
    const top14 = [...myPlayers].sort((a, b) => ovr(b) - ovr(a)).slice(0, 14);
    const teamOvr = top14.length > 0 ? Math.round(top14.reduce((s, p) => s + ovr(p), 0) / top14.length) : 0;

    // ── Payroll Room ───────────────────────────────────────────────────────────
    const budget = teamBudgets[userTeamId] ?? 150_000;
    const payroll = getTeamPayroll(userTeamId);
    const payrollRoom = Math.max(0, budget - payroll);

    // ── Trade Deadline ─────────────────────────────────────────────────────────
    const deadlineDays = currentDay < 120 ? 120 - currentDay : null;

    return { rosterNeeds, upgradeTargets, motivatedSellers, tradeAssets, scheduleStrength, teamOvr, payrollRoom, deadlineDays };
  }, [userTeam, engine, season, userTeamId, teams, getTeamInjuries, getTeamPayroll, teamBudgets]);

  if (!engine || !userTeam || !season || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">No franchise loaded</p>
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const myRecord = season.standings.getRecord(userTeamId);
  const myGp = myRecord ? myRecord.wins + myRecord.losses : 0;
  const myWp = myRecord && myGp > 0 ? myRecord.wins / myGp : null;
  const teamName = `${userTeam.city} ${userTeam.name}`;
  const scheduleLabel = scheduleStrength >= 0.55 ? 'Hard' : scheduleStrength >= 0.48 ? 'Average' : 'Easy';
  const scheduleColor = scheduleStrength >= 0.55 ? 'text-red-400' : scheduleStrength >= 0.48 ? 'text-cream' : 'text-green-400';

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">GM War Room</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {teamName} · Day {season.currentDay}/{season.totalDays}
            {myRecord && <> · <span className="text-cream">{myRecord.wins}–{myRecord.losses}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/trade')}>
            Trade Center
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/free-agency')}>
            Free Agents
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>
            Dashboard
          </Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Team Grade',
            value: letterGrade(teamOvr),
            sub: `${teamOvr} OVR`,
            color: gradeColor(teamOvr),
            bg: gradeBg(teamOvr),
          },
          {
            label: 'Budget Room',
            value: payrollRoom >= 1000 ? `$${(payrollRoom / 1000).toFixed(1)}M` : `$${payrollRoom}K`,
            sub: 'available',
            color: payrollRoom > 20_000 ? 'text-green-400' : payrollRoom > 5_000 ? 'text-cream' : 'text-red-400',
            bg: payrollRoom > 20_000 ? 'bg-green-400/10 border-green-400/30' : payrollRoom > 5_000 ? 'bg-navy-lighter/30 border-navy-lighter/50' : 'bg-red-400/10 border-red-400/30',
          },
          {
            label: 'Sched. Strength',
            value: scheduleLabel,
            sub: 'next 10 games',
            color: scheduleColor,
            bg: 'bg-navy-lighter/30 border-navy-lighter/50',
          },
          {
            label: deadlineDays !== null ? 'Trade Deadline' : 'Roster Needs',
            value: deadlineDays !== null ? `${deadlineDays}d` : `${rosterNeeds.length}`,
            sub: deadlineDays !== null ? 'days away' : 'positions',
            color: deadlineDays !== null && deadlineDays < 15 ? 'text-red-400' : 'text-cream',
            bg: deadlineDays !== null && deadlineDays < 15 ? 'bg-red-400/10 border-red-400/30' : 'bg-navy-lighter/30 border-navy-lighter/50',
          },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={cn('px-4 py-3 rounded-xl border text-center', bg)}>
            <div className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider">{label}</div>
            <div className={cn('font-display text-2xl font-bold mt-0.5', color)}>{value}</div>
            <div className="font-mono text-[10px] text-cream-dim/50 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* LEFT: Roster Needs + Upgrade Targets */}
        <div className="xl:col-span-2 space-y-6">

          {/* Roster Needs */}
          <Panel title="Roster Needs">
            {rosterNeeds.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-mono text-sm text-green-400">No critical roster holes</p>
                <p className="font-mono text-xs text-cream-dim/40 mt-1">All positions are average or better</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rosterNeeds.slice(0, 5).map(need => (
                  <div key={need.pos}>
                    {/* Need header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-display text-sm text-gold w-10 shrink-0">{need.pos}</span>
                      <span className="font-body text-sm text-cream flex-1">{need.label}</span>
                      <NeedBadge level={need.level} />
                    </div>
                    <p className="font-mono text-[10px] text-cream-dim/50 mb-2 ml-10">{need.reason}</p>

                    {/* Upgrade targets */}
                    {(upgradeTargets.get(need.pos) ?? []).length > 0 ? (
                      <div className="ml-10 space-y-1.5">
                        <p className="font-mono text-[10px] text-cream-dim/40 uppercase tracking-wider mb-1">
                          Available upgrades:
                        </p>
                        {(upgradeTargets.get(need.pos) ?? []).map(target => (
                          <TargetCard
                            key={target.player.id}
                            player={target.player}
                            teamAbbr={target.teamAbbr}
                            source="trade"
                            onClick={() => navigate(`/franchise/trade?targetPlayer=${target.player.id}`)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="ml-10 px-3 py-2 rounded-lg border border-dashed border-navy-lighter/30 text-center">
                        <p className="font-mono text-[10px] text-cream-dim/30">No available upgrades found</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Motivated Sellers */}
          <Panel title="Motivated Sellers">
            <p className="font-mono text-xs text-cream-dim/50 mb-4">
              Teams below .420 with quality players — most likely to accept trades
            </p>
            {motivatedSellers.length === 0 ? (
              <div className="py-6 text-center">
                <p className="font-mono text-sm text-cream-dim/50">
                  {myGp < 10
                    ? 'Not enough games played to identify sellers'
                    : 'No clear sellers identified yet this season'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {motivatedSellers.map(seller => (
                  <div key={seller.teamId} className="rounded-lg border border-navy-lighter/30 bg-navy-light/20 overflow-hidden">
                    {/* Team header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-navy-lighter/20">
                      <div>
                        <button
                          onClick={() => navigate(`/franchise/team-stats/${seller.teamId}`)}
                          className="font-body text-sm text-cream hover:text-gold transition-colors cursor-pointer"
                        >
                          {seller.name}
                        </button>
                        <span className="font-mono text-xs text-cream-dim/50 ml-2">{seller.record}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-red-400 border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 rounded uppercase">
                          Seller
                        </span>
                        <button
                          onClick={() => navigate(`/franchise/trade?partner=${seller.teamId}`)}
                          className="font-mono text-[10px] text-gold border border-gold/30 bg-gold/10 hover:bg-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wide transition-colors cursor-pointer"
                        >
                          Trade →
                        </button>
                      </div>
                    </div>
                    {/* Top players */}
                    <div className="p-2 space-y-1">
                      {seller.topPlayers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => navigate(`/franchise/player-stats/${p.id}`)}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-navy-lighter/30 transition-colors text-left cursor-pointer group"
                        >
                          <span className="font-mono text-xs text-gold/60 w-8 shrink-0">{p.position}</span>
                          <span className="font-body text-sm text-cream truncate flex-1 group-hover:text-gold transition-colors">
                            {getPlayerName(p)}
                          </span>
                          <span className="font-mono text-xs text-cream-dim/50">{p.age}y</span>
                          <span className={cn('font-mono text-sm font-bold shrink-0', gradeColor(ovr(p)))}>{ovr(p)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

        </div>

        {/* RIGHT: Trade Assets + Schedule */}
        <div className="space-y-6">

          {/* Your Trade Assets */}
          <Panel title="Your Trade Assets">
            <p className="font-mono text-[10px] text-cream-dim/40 mb-4 uppercase tracking-wider">
              Ranked by trade value tier
            </p>
            <div className="space-y-4">
              {[
                { key: 'untouchable' as const, label: '🔒 Untouchable', desc: 'Core pieces — do not trade', color: 'text-gold border-gold/30 bg-gold/10' },
                { key: 'premium' as const,     label: '💎 Premium',     desc: 'High trade value',           color: 'text-green-400 border-green-400/30 bg-green-400/10' },
                { key: 'tradeable' as const,   label: '🔄 Tradeable',   desc: 'Will listen on offers',      color: 'text-cream border-navy-lighter/50 bg-navy-lighter/20' },
                { key: 'filler' as const,      label: '📦 Salary Dump', desc: 'Low value, tradeable',       color: 'text-cream-dim/60 border-navy-lighter/30 bg-navy-lighter/10' },
              ].map(({ key, label, desc, color }) => {
                const players = tradeAssets[key];
                if (players.length === 0) return null;
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn('font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider', color)}>
                        {label}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-cream-dim/30 mb-1.5 ml-0.5">{desc}</p>
                    <div className="space-y-1">
                      {players.map(p => (
                        <AssetCard
                          key={p.id}
                          player={p}
                          tier={key}
                          onClick={() => navigate(`/franchise/player-stats/${p.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-navy-lighter/30">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => navigate('/franchise/trade')}
              >
                Open Trade Center →
              </Button>
            </div>
          </Panel>

          {/* Quick Actions */}
          <Panel title="Quick Actions">
            <div className="space-y-2">
              {[
                { label: '📋 Depth Chart', path: '/franchise/depth-chart', desc: 'View positional grades' },
                { label: '🔭 Scouting Hub', path: '/franchise/scouting', desc: 'Scout league players' },
                { label: '📊 Power Rankings', path: '/franchise/power-rankings', desc: 'League standings & odds' },
                { label: '⚖️ Trade Proposals', path: '/franchise/trade-proposals', desc: 'Review incoming offers' },
                { label: '✍️ Free Agency', path: '/franchise/free-agency', desc: 'Sign available players' },
                { label: '💰 Payroll', path: '/franchise/payroll', desc: 'Budget & contract overview' },
              ].map(({ label, path, desc }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-navy-lighter/30 hover:border-gold/30 hover:bg-navy-lighter/20 transition-all cursor-pointer text-left group"
                >
                  <div>
                    <p className="font-mono text-xs text-cream group-hover:text-gold transition-colors">{label}</p>
                    <p className="font-mono text-[10px] text-cream-dim/40 mt-0.5">{desc}</p>
                  </div>
                  <span className="text-cream-dim/30 group-hover:text-gold transition-colors text-xs">→</span>
                </button>
              ))}
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}
