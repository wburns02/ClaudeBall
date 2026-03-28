import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import {
  battingAvg, onBasePct, slugging, era, whip, formatIP,
} from '@/engine/types/stats.ts';
import {
  k9, bb9, hr9, deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT, fmtAvg, fmtStat,
} from '@/engine/stats/AdvancedStats.ts';
import { winPct, streakStr, last10Str, runDifferential } from '@/engine/season/index.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { cn } from '@/lib/cn.ts';

export function TeamStatsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { getCurrentSeasonStats, leagueTotals } = useStatsStore();
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);
  const { engine, season } = useFranchiseStore();

  const team = useMemo(() => {
    if (!teamId || !engine) return null;
    return engine.getTeam(teamId) ?? null;
  }, [teamId, engine]);

  const record = useMemo(() => {
    if (!teamId || !season) return null;
    return season.standings.getRecord(teamId) ?? null;
  }, [teamId, season]);

  const leagueCtx = useMemo(() => {
    const lt = leagueTotals;
    if (lt.gamesPlayed === 0) return DEFAULT_LEAGUE_CONTEXT;
    return deriveLeagueContext(
      lt.totalAB, lt.totalPA, lt.totalH, lt.totalDoubles, lt.totalTriples,
      lt.totalHR, lt.totalBB, lt.totalHBP, lt.totalSF, lt.totalSO,
      lt.totalRuns, lt.gamesPlayed, lt.totalER, lt.totalIP,
      (lt as typeof lt & { totalGameRuns?: number }).totalGameRuns
    );
  }, [leagueTotals]);

  // Get all player stats for this team
  const teamPlayerStats = useMemo(() => {
    if (!teamId) return [];
    return Object.values(playerStats).filter(ps => ps.teamId === teamId);
  }, [playerStats, teamId]);

  // Aggregate team batting
  const teamBatting = useMemo(() => {
    const agg = { pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0, hbp: 0, sb: 0, cs: 0, sf: 0, sh: 0, gidp: 0 };
    for (const ps of teamPlayerStats.filter(p => p.position !== 'P')) {
      agg.pa += ps.batting.pa;
      agg.ab += ps.batting.ab;
      agg.h += ps.batting.h;
      agg.doubles += ps.batting.doubles;
      agg.triples += ps.batting.triples;
      agg.hr += ps.batting.hr;
      agg.rbi += ps.batting.rbi;
      agg.r += ps.batting.r;
      agg.bb += ps.batting.bb;
      agg.so += ps.batting.so;
      agg.hbp += ps.batting.hbp;
      agg.sb += ps.batting.sb;
      agg.cs += ps.batting.cs;
      agg.sf += ps.batting.sf;
    }
    return agg;
  }, [teamPlayerStats]);

  // Aggregate team pitching
  const teamPitching = useMemo(() => {
    const agg = { ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, pitchCount: 0, bf: 0, wins: 0, losses: 0, saves: 0, holds: 0 };
    for (const ps of teamPlayerStats.filter(p => p.pitching.ip > 0)) {
      agg.ip += ps.pitching.ip;
      agg.h += ps.pitching.h;
      agg.r += ps.pitching.r;
      agg.er += ps.pitching.er;
      agg.bb += ps.pitching.bb;
      agg.so += ps.pitching.so;
      agg.hr += ps.pitching.hr;
      agg.wins += ps.pitching.wins;
      agg.losses += ps.pitching.losses;
      agg.saves += ps.pitching.saves;
    }
    return agg;
  }, [teamPlayerStats]);

  const gamesPlayed = record ? record.wins + record.losses : 0;
  const runsPerGame = gamesPlayed === 0 ? 0 : (record?.runsScored ?? 0) / gamesPlayed;
  const raPerGame = gamesPlayed === 0 ? 0 : (record?.runsAllowed ?? 0) / gamesPlayed;

  // Roster with ratings — must be before early return to satisfy Rules of Hooks
  const rosterWithRatings = useMemo(() => {
    if (!team) return [];
    return [...team.roster.players].map(p => ({
      player: p,
      ovr: Math.round(evaluatePlayer(p)),
      ps: playerStats[p.id] ?? null,
    })).sort((a, b) => b.ovr - a.ovr);
  }, [team, playerStats]);

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-cream-dim">Team not found.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>
    );
  }

  const pitchers = rosterWithRatings.filter(r => r.player.position === 'P');
  const posPlayers = rosterWithRatings.filter(r => r.player.position !== 'P');

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            {team.city} {team.name}
          </h1>
          {record && (
            <p className="font-mono text-cream-dim text-sm mt-1">
              {record.wins}-{record.losses} • {winPct(record)} •
              {' '}Streak: {streakStr(record)} • L10: {last10Str(record)} •
              {' '}Run Diff: <span className={cn(
                record.runsScored >= record.runsAllowed ? 'text-green-light' : 'text-red'
              )}>{runDifferential(record)}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/leaders')}>Leaders</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Team Batting */}
        <Panel title="Team Batting">
          {teamBatting.pa === 0 ? (
            <p className="text-cream-dim text-sm font-mono">No batting data yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'AVG', value: fmtAvg(battingAvg(teamBatting)) },
                  { label: 'OBP', value: fmtAvg(onBasePct(teamBatting)) },
                  { label: 'SLG', value: fmtAvg(slugging(teamBatting)) },
                  { label: 'OPS', value: fmtAvg(onBasePct(teamBatting) + slugging(teamBatting)) },
                ].map(s => (
                  <div key={s.label} className="text-center bg-navy-lighter/30 rounded p-2">
                    <p className="text-cream-dim text-xs font-mono uppercase">{s.label}</p>
                    <p className="text-gold font-mono font-bold text-xl">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'R/G', value: fmtStat(runsPerGame, 2) },
                  { label: 'HR', value: teamBatting.hr.toString() },
                  { label: 'SB', value: teamBatting.sb.toString() },
                  { label: 'K%', value: fmtStat(teamBatting.pa > 0 ? teamBatting.so / teamBatting.pa * 100 : 0, 1) + '%' },
                ].map(s => (
                  <div key={s.label} className="text-center bg-navy-lighter/20 rounded p-2">
                    <p className="text-cream-dim text-xs font-mono uppercase">{s.label}</p>
                    <p className="text-cream font-mono font-bold text-lg">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Team Pitching */}
        <Panel title="Team Pitching">
          {teamPitching.ip === 0 ? (
            <p className="text-cream-dim text-sm font-mono">No pitching data yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'ERA', value: era(teamPitching).toFixed(2) },
                  { label: 'WHIP', value: whip(teamPitching).toFixed(3) },
                  { label: 'K/9', value: k9(teamPitching).toFixed(1) },
                  { label: 'BB/9', value: bb9(teamPitching).toFixed(1) },
                ].map(s => (
                  <div key={s.label} className="text-center bg-navy-lighter/30 rounded p-2">
                    <p className="text-cream-dim text-xs font-mono uppercase">{s.label}</p>
                    <p className="text-gold font-mono font-bold text-xl">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'RA/G', value: fmtStat(raPerGame, 2) },
                  { label: 'HR/9', value: hr9(teamPitching).toFixed(1) },
                  { label: 'K', value: teamPitching.so.toString() },
                  { label: 'IP', value: formatIP(teamPitching.ip) },
                ].map(s => (
                  <div key={s.label} className="text-center bg-navy-lighter/20 rounded p-2">
                    <p className="text-cream-dim text-xs font-mono uppercase">{s.label}</p>
                    <p className="text-cream font-mono font-bold text-lg">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Win/Loss breakdown */}
      {record && (
        <Panel title="Win/Loss Breakdown" className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-sm">
            {[
              { label: 'Home', w: record.homeWins, l: record.homeLosses },
              { label: 'Away', w: record.awayWins, l: record.awayLosses },
              { label: 'Division', w: record.divisionWins, l: record.divisionLosses },
              { label: 'Overall', w: record.wins, l: record.losses },
            ].map(stat => {
              const total = stat.w + stat.l;
              const pct = total === 0 ? '.000' : (stat.w / total).toFixed(3).replace(/^0/, '');
              return (
                <div key={stat.label} className="text-center bg-navy-lighter/20 rounded p-3">
                  <p className="text-cream-dim text-xs uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-cream font-bold text-2xl">{stat.w}-{stat.l}</p>
                  <p className="text-gold text-xs">{pct}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Roster Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`Position Players (${posPlayers.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="px-2 py-1.5 text-left text-gold-dim text-xs uppercase">Name</th>
                  <th className="px-2 py-1.5 text-center text-gold-dim text-xs uppercase">Pos</th>
                  <th className="px-2 py-1.5 text-center text-gold-dim text-xs uppercase">Age</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">OVR</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">G</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">AVG</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">HR</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">RBI</th>
                </tr>
              </thead>
              <tbody>
                {posPlayers.map(({ player, ovr, ps: psStat }, i) => (
                  <tr
                    key={player.id}
                    className={cn(
                      'border-b border-navy-lighter/40 hover:bg-navy-lighter/20 transition-colors cursor-pointer',
                      i % 2 === 1 && 'bg-navy-lighter/10'
                    )}
                    onClick={() => navigate(`/franchise/player-stats/${player.id}`)}
                  >
                    <td className="px-2 py-1 text-cream hover:text-gold transition-colors">
                      {player.firstName} {player.lastName}
                    </td>
                    <td className="px-2 py-1 text-center text-gold text-xs">{player.position}</td>
                    <td className="px-2 py-1 text-center text-cream-dim">{player.age}</td>
                    <td className="px-2 py-1 text-right">
                      <span className={cn(
                        'font-bold text-xs',
                        ovr >= 75 ? 'text-gold' : ovr >= 60 ? 'text-green-light' : 'text-cream-dim'
                      )}>{ovr}</span>
                    </td>
                    <td className="px-2 py-1 text-right text-cream-dim">{psStat?.gamesPlayed ?? '—'}</td>
                    <td className="px-2 py-1 text-right text-cream">
                      {psStat ? fmtAvg(battingAvg(psStat.batting)) : '---'}
                    </td>
                    <td className="px-2 py-1 text-right text-cream">{psStat?.batting.hr ?? '—'}</td>
                    <td className="px-2 py-1 text-right text-cream">{psStat?.batting.rbi ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={`Pitching Staff (${pitchers.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="px-2 py-1.5 text-left text-gold-dim text-xs uppercase">Name</th>
                  <th className="px-2 py-1.5 text-center text-gold-dim text-xs uppercase">Age</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">OVR</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">G</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">W-L</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">ERA</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">K</th>
                  <th className="px-2 py-1.5 text-right text-gold-dim text-xs uppercase">IP</th>
                </tr>
              </thead>
              <tbody>
                {pitchers.map(({ player, ovr, ps: psStat }, i) => (
                  <tr
                    key={player.id}
                    className={cn(
                      'border-b border-navy-lighter/40 hover:bg-navy-lighter/20 transition-colors cursor-pointer',
                      i % 2 === 1 && 'bg-navy-lighter/10'
                    )}
                    onClick={() => navigate(`/franchise/player-stats/${player.id}`)}
                  >
                    <td className="px-2 py-1 text-cream hover:text-gold transition-colors">
                      {player.firstName} {player.lastName}
                    </td>
                    <td className="px-2 py-1 text-center text-cream-dim">{player.age}</td>
                    <td className="px-2 py-1 text-right">
                      <span className={cn(
                        'font-bold text-xs',
                        ovr >= 75 ? 'text-gold' : ovr >= 60 ? 'text-green-light' : 'text-cream-dim'
                      )}>{ovr}</span>
                    </td>
                    <td className="px-2 py-1 text-right text-cream-dim">{psStat?.gamesPlayed ?? '—'}</td>
                    <td className="px-2 py-1 text-right text-cream">
                      {psStat ? `${psStat.pitching.wins}-${psStat.pitching.losses}` : '—'}
                    </td>
                    <td className="px-2 py-1 text-right text-cream">
                      {psStat && psStat.pitching.ip > 0
                        ? era(psStat.pitching).toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-2 py-1 text-right text-cream">{psStat?.pitching.so ?? '—'}</td>
                    <td className="px-2 py-1 text-right text-cream">
                      {psStat && psStat.pitching.ip > 0 ? formatIP(psStat.pitching.ip) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
