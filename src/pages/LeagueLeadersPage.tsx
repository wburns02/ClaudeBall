import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import {
  battingAvg, onBasePct, slugging, era, whip, formatIP,
} from '@/engine/types/stats.ts';
import {
  woba, wrcPlus, opsPlus, fip, k9, bb9,
  calcBattingAdvanced, calcPitchingAdvanced, deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT,
  fmtAvg, fmtStat,
} from '@/engine/stats/AdvancedStats.ts';
import { cn } from '@/lib/cn.ts';

type Tab = 'batting' | 'pitching' | 'fielding';

type BattingSortKey = 'avg' | 'hr' | 'rbi' | 'ops' | 'wrcPlus' | 'sb' | 'war' | 'obp' | 'slg' | 'woba' | 'h' | 'r';
type PitchingSortKey = 'era' | 'whip' | 'so' | 'wins' | 'saves' | 'fip' | 'k9' | 'bb9' | 'ip' | 'war';
type FieldingSortKey = 'range' | 'arm' | 'errorRate' | 'ovr';

const BATTING_COLS: { key: BattingSortKey; label: string; format: (v: number) => string; lower?: boolean }[] = [
  { key: 'avg', label: 'AVG', format: fmtAvg },
  { key: 'obp', label: 'OBP', format: fmtAvg },
  { key: 'slg', label: 'SLG', format: fmtAvg },
  { key: 'ops', label: 'OPS', format: fmtAvg },
  { key: 'woba', label: 'wOBA', format: fmtAvg },
  { key: 'wrcPlus', label: 'wRC+', format: (v) => v.toFixed(0) },
  { key: 'hr', label: 'HR', format: (v) => v.toFixed(0) },
  { key: 'rbi', label: 'RBI', format: (v) => v.toFixed(0) },
  { key: 'h', label: 'H', format: (v) => v.toFixed(0) },
  { key: 'r', label: 'R', format: (v) => v.toFixed(0) },
  { key: 'sb', label: 'SB', format: (v) => v.toFixed(0) },
  { key: 'war', label: 'WAR', format: (v) => v.toFixed(1) },
];

const PITCHING_COLS: { key: PitchingSortKey; label: string; format: (v: number) => string; lower?: boolean }[] = [
  { key: 'era', label: 'ERA', format: (v) => v.toFixed(2), lower: true },
  { key: 'whip', label: 'WHIP', format: (v) => v.toFixed(3), lower: true },
  { key: 'fip', label: 'FIP', format: (v) => v.toFixed(2), lower: true },
  { key: 'k9', label: 'K/9', format: (v) => v.toFixed(1) },
  { key: 'bb9', label: 'BB/9', format: (v) => v.toFixed(1), lower: true },
  { key: 'so', label: 'K', format: (v) => v.toFixed(0) },
  { key: 'wins', label: 'W', format: (v) => v.toFixed(0) },
  { key: 'saves', label: 'SV', format: (v) => v.toFixed(0) },
  { key: 'ip', label: 'IP', format: (v) => v.toFixed(1) },
  { key: 'war', label: 'WAR', format: (v) => v.toFixed(1) },
];

const BAT_POS_FILTERS = ['ALL', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH'] as const;
type BatPosFilter = typeof BAT_POS_FILTERS[number];
const PIT_POS_FILTERS = ['ALL', 'SP', 'RP'] as const;
type PitPosFilter = typeof PIT_POS_FILTERS[number];

export function LeagueLeadersPage() {
  const navigate = useNavigate();
  const { getBattingLeaders, getPitchingLeaders, leagueTotals, playerStats } = useStatsStore();
  const { engine, season } = useFranchiseStore();

  const [tab, setTab] = useState<Tab>('batting');
  const [battingSort, setBattingSort] = useState<BattingSortKey>('avg');
  const [pitchingSort, setPitchingSort] = useState<PitchingSortKey>('era');
  const [fieldingSort, setFieldingSort] = useState<FieldingSortKey>('ovr');
  const [batPosFilter, setBatPosFilter] = useState<BatPosFilter>('ALL');
  const [pitPosFilter, setPitPosFilter] = useState<PitPosFilter>('ALL');

  // Scale qualifying thresholds with season progress (min 20 PA / 10 IP early on)
  const seasonProgress = season ? Math.min(1, season.currentDay / season.totalDays) : 0;
  const minPA = Math.max(20, Math.round(502 * seasonProgress * 0.85));
  const minIP = Math.max(10, Math.round(162 * seasonProgress * 0.85));

  // Build league context from accumulated totals
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

  const battingLeaders = useMemo(() => {
    const leaders = getBattingLeaders(minPA);
    return leaders
      .filter(ps => {
        if (batPosFilter === 'ALL') return true;
        if (batPosFilter === 'OF') return ['LF', 'CF', 'RF'].includes(ps.position);
        return ps.position === batPosFilter;
      })
      .map(ps => {
      const adv = calcBattingAdvanced(ps.batting, leagueCtx, ps.position);
      const teamAbbr = engine?.getTeam(ps.teamId)?.abbreviation ?? ps.teamId.slice(0, 3).toUpperCase();
      return { ps, adv, teamAbbr };
    });
  }, [getBattingLeaders, leagueCtx, engine, minPA, batPosFilter]);

  const pitchingLeaders = useMemo(() => {
    const leaders = getPitchingLeaders(minIP);
    return leaders
      .filter(ps => {
        if (pitPosFilter === 'ALL') return true;
        // SP: avg IP/G >= 4 (12 in thirds); RP: less
        const avgIpPerGame = ps.gamesPlayed > 0 ? (ps.pitching.ip / 3) / ps.gamesPlayed : 0;
        const isStarter = avgIpPerGame >= 4;
        return pitPosFilter === 'SP' ? isStarter : !isStarter;
      })
      .map(ps => {
      const adv = calcPitchingAdvanced(ps.pitching, leagueCtx);
      const teamAbbr = engine?.getTeam(ps.teamId)?.abbreviation ?? ps.teamId.slice(0, 3).toUpperCase();
      return { ps, adv, teamAbbr };
    });
  }, [getPitchingLeaders, leagueCtx, engine, minIP, pitPosFilter]);

  const fieldingLeaders = useMemo(() => {
    return Object.values(playerStats)
      .filter(ps => ps.gamesPlayed >= 1)
      .map(ps => {
        const player = engine?.getAllTeams().flatMap(t => t.roster.players).find(p => p.id === ps.playerId);
        const fi = player?.fielding[0];
        const teamAbbr = engine?.getTeam(ps.teamId)?.abbreviation ?? '---';
        return {
          ps,
          player,
          fi,
          teamAbbr,
          range: fi?.range ?? 0,
          arm: fi?.arm_strength ?? 0,
          errorRate: fi?.error_rate ?? 100,
          ovr: fi ? Math.round((fi.range + fi.arm_strength + (100 - fi.error_rate)) / 3) : 0,
        };
      });
  }, [playerStats, engine]);

  // Sort batting leaders
  const sortedBatting = useMemo(() => {
    const col = BATTING_COLS.find(c => c.key === battingSort);
    const lower = col?.lower ?? false;
    return [...battingLeaders].sort((a, b) => {
      const getVal = (x: typeof a) => {
        switch (battingSort) {
          case 'avg': return battingAvg(x.ps.batting);
          case 'obp': return onBasePct(x.ps.batting);
          case 'slg': return slugging(x.ps.batting);
          case 'ops': return x.adv.ops;
          case 'woba': return x.adv.woba;
          case 'wrcPlus': return x.adv.wrcPlus;
          case 'hr': return x.ps.batting.hr;
          case 'rbi': return x.ps.batting.rbi;
          case 'h': return x.ps.batting.h;
          case 'r': return x.ps.batting.r;
          case 'sb': return x.ps.batting.sb;
          case 'war': return x.adv.war;
        }
      };
      const diff = getVal(a) - getVal(b);
      return lower ? diff : -diff;
    }).slice(0, 20);
  }, [battingLeaders, battingSort]);

  // Sort pitching leaders
  const sortedPitching = useMemo(() => {
    const col = PITCHING_COLS.find(c => c.key === pitchingSort);
    const lower = col?.lower ?? false;
    return [...pitchingLeaders].sort((a, b) => {
      const getVal = (x: typeof a) => {
        switch (pitchingSort) {
          case 'era': return era(x.ps.pitching);
          case 'whip': return whip(x.ps.pitching);
          case 'fip': return fip(x.ps.pitching);
          case 'k9': return k9(x.ps.pitching);
          case 'bb9': return bb9(x.ps.pitching);
          case 'so': return x.ps.pitching.so;
          case 'wins': return x.ps.pitching.wins;
          case 'saves': return x.ps.pitching.saves;
          case 'ip': return x.ps.pitching.ip / 3;
          case 'war': return x.adv.war;
        }
      };
      const diff = getVal(a) - getVal(b);
      return lower ? diff : -diff;
    }).slice(0, 20);
  }, [pitchingLeaders, pitchingSort]);

  const sortedFielding = useMemo(() => {
    return [...fieldingLeaders].sort((a, b) => {
      switch (fieldingSort) {
        case 'range': return b.range - a.range;
        case 'arm': return b.arm - a.arm;
        case 'errorRate': return a.errorRate - b.errorRate;
        case 'ovr': return b.ovr - a.ovr;
        default: return 0;
      }
    }).slice(0, 20);
  }, [fieldingLeaders, fieldingSort]);

  const hasData = Object.keys(playerStats).length > 0;

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">League Leaders</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {leagueTotals.gamesPlayed} games played this season
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-4">
        {(['batting', 'pitching', 'fielding'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-md font-display text-sm uppercase tracking-wider transition-all cursor-pointer',
              tab === t
                ? 'bg-gold text-navy font-bold'
                : 'text-cream-dim hover:text-cream hover:bg-navy-lighter/50'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {!hasData && (
        <Panel>
          <div className="text-center py-12">
            <p className="font-mono text-cream-dim text-lg">No stats recorded yet.</p>
            <p className="font-mono text-cream-dim text-sm mt-2">
              Play games in franchise mode to see leaders here.
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => navigate('/franchise')}>
              Go to Dashboard
            </Button>
          </div>
        </Panel>
      )}

      {hasData && tab === 'batting' && (
        <Panel title="Batting Leaders">
          {/* Position filter */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="font-mono text-xs text-cream-dim/50 uppercase tracking-wider">Pos:</span>
            {BAT_POS_FILTERS.map(pos => (
              <button
                key={pos}
                onClick={() => setBatPosFilter(pos)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                  batPosFilter === pos
                    ? 'bg-gold text-navy font-bold'
                    : 'text-cream-dim hover:text-cream bg-navy-lighter/30 hover:bg-navy-lighter/60'
                )}
              >
                {pos}
              </button>
            ))}
            <span className="ml-auto font-mono text-xs text-cream-dim/40">
              min {minPA} PA
            </span>
          </div>
          {/* Sort selector */}
          <div className="flex flex-wrap gap-1 mb-3">
            {BATTING_COLS.map(col => (
              <button
                key={col.key}
                onClick={() => setBattingSort(col.key)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                  battingSort === col.key
                    ? 'bg-gold text-navy font-bold'
                    : 'text-gold-dim hover:text-gold bg-navy-lighter/30 hover:bg-navy-lighter/60'
                )}
              >
                {col.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider w-6">#</th>
                  <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider">Player</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">Team</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">Pos</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">G</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">PA</th>
                  {BATTING_COLS.map(col => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-2 py-2 text-right text-xs uppercase tracking-wider cursor-pointer',
                        battingSort === col.key ? 'text-gold' : 'text-gold-dim hover:text-gold'
                      )}
                      onClick={() => setBattingSort(col.key)}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedBatting.map(({ ps, adv, teamAbbr }, i) => {
                  const getDisplayVal = (key: BattingSortKey): string => {
                    switch (key) {
                      case 'avg': return fmtAvg(battingAvg(ps.batting));
                      case 'obp': return fmtAvg(onBasePct(ps.batting));
                      case 'slg': return fmtAvg(slugging(ps.batting));
                      case 'ops': return fmtAvg(adv.ops);
                      case 'woba': return fmtAvg(adv.woba);
                      case 'wrcPlus': return adv.wrcPlus.toString();
                      case 'hr': return ps.batting.hr.toString();
                      case 'rbi': return ps.batting.rbi.toString();
                      case 'h': return ps.batting.h.toString();
                      case 'r': return ps.batting.r.toString();
                      case 'sb': return ps.batting.sb.toString();
                      case 'war': return adv.war.toFixed(1);
                    }
                  };
                  return (
                    <tr
                      key={ps.playerId}
                      onClick={() => navigate(`/franchise/player-stats/${ps.playerId}`)}
                      className={cn(
                        'border-b border-navy-lighter/50 hover:bg-navy-lighter/30 transition-colors cursor-pointer',
                        i % 2 === 1 && 'bg-navy-lighter/10'
                      )}
                    >
                      <td className="px-2 py-1.5 text-cream-dim text-xs">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <span className="text-cream hover:text-gold transition-colors text-left font-body">
                          {ps.playerName}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center text-cream-dim text-xs">{teamAbbr}</td>
                      <td className="px-2 py-1.5 text-center text-gold text-xs">{ps.position}</td>
                      <td className="px-2 py-1.5 text-center text-cream">{ps.gamesPlayed}</td>
                      <td className="px-2 py-1.5 text-right text-cream">{ps.batting.pa}</td>
                      {BATTING_COLS.map(col => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-2 py-1.5 text-right',
                            battingSort === col.key ? 'text-gold font-bold' : 'text-cream'
                          )}
                        >
                          {getDisplayVal(col.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {sortedBatting.length === 0 && (
                  <tr>
                    <td colSpan={18} className="px-2 py-8 text-center text-cream-dim">
                      No qualifying batters yet (min {minPA} PA).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {hasData && tab === 'pitching' && (
        <Panel title="Pitching Leaders">
          {/* SP/RP filter */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="font-mono text-xs text-cream-dim/50 uppercase tracking-wider">Role:</span>
            {PIT_POS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setPitPosFilter(f)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                  pitPosFilter === f
                    ? 'bg-gold text-navy font-bold'
                    : 'text-cream-dim hover:text-cream bg-navy-lighter/30 hover:bg-navy-lighter/60'
                )}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto font-mono text-xs text-cream-dim/40">
              min {minIP} IP
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {PITCHING_COLS.map(col => (
              <button
                key={col.key}
                onClick={() => setPitchingSort(col.key)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                  pitchingSort === col.key
                    ? 'bg-gold text-navy font-bold'
                    : 'text-gold-dim hover:text-gold bg-navy-lighter/30 hover:bg-navy-lighter/60'
                )}
              >
                {col.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider w-6">#</th>
                  <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider">Player</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">Team</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">G</th>
                  {PITCHING_COLS.map(col => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-2 py-2 text-right text-xs uppercase tracking-wider cursor-pointer',
                        pitchingSort === col.key ? 'text-gold' : 'text-gold-dim hover:text-gold'
                      )}
                      onClick={() => setPitchingSort(col.key)}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPitching.map(({ ps, adv, teamAbbr }, i) => {
                  const getDisplayVal = (key: PitchingSortKey): string => {
                    switch (key) {
                      case 'era': return era(ps.pitching).toFixed(2);
                      case 'whip': return whip(ps.pitching).toFixed(3);
                      case 'fip': return fip(ps.pitching).toFixed(2);
                      case 'k9': return k9(ps.pitching).toFixed(1);
                      case 'bb9': return bb9(ps.pitching).toFixed(1);
                      case 'so': return ps.pitching.so.toString();
                      case 'wins': return ps.pitching.wins.toString();
                      case 'saves': return ps.pitching.saves.toString();
                      case 'ip': return formatIP(ps.pitching.ip);
                      case 'war': return adv.war.toFixed(1);
                    }
                  };
                  return (
                    <tr
                      key={ps.playerId}
                      onClick={() => navigate(`/franchise/player-stats/${ps.playerId}`)}
                      className={cn(
                        'border-b border-navy-lighter/50 hover:bg-navy-lighter/30 transition-colors cursor-pointer',
                        i % 2 === 1 && 'bg-navy-lighter/10'
                      )}
                    >
                      <td className="px-2 py-1.5 text-cream-dim text-xs">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <span className="text-cream hover:text-gold transition-colors text-left font-body">
                          {ps.playerName}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center text-cream-dim text-xs">{teamAbbr}</td>
                      <td className="px-2 py-1.5 text-center text-cream">{ps.gamesPlayed}</td>
                      {PITCHING_COLS.map(col => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-2 py-1.5 text-right',
                            pitchingSort === col.key ? 'text-gold font-bold' : 'text-cream'
                          )}
                        >
                          {getDisplayVal(col.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {sortedPitching.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-2 py-8 text-center text-cream-dim">
                      No qualifying pitchers yet (min {minIP} IP).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {hasData && tab === 'fielding' && (
        <Panel title="Fielding Leaders">
          <div className="flex gap-1 mb-3">
            {(['ovr', 'range', 'arm', 'errorRate'] as FieldingSortKey[]).map(key => (
              <button
                key={key}
                onClick={() => setFieldingSort(key)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-mono uppercase transition-all cursor-pointer',
                  fieldingSort === key
                    ? 'bg-gold text-navy font-bold'
                    : 'text-gold-dim hover:text-gold bg-navy-lighter/30 hover:bg-navy-lighter/60'
                )}
              >
                {key === 'errorRate' ? 'Err' : key === 'ovr' ? 'OVR' : key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider w-6">#</th>
                  <th className="px-2 py-2 text-left text-gold-dim text-xs uppercase tracking-wider">Player</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">Team</th>
                  <th className="px-2 py-2 text-center text-gold-dim text-xs uppercase tracking-wider">Pos</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider">G</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider cursor-pointer" onClick={() => setFieldingSort('ovr')}>OVR</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider cursor-pointer" onClick={() => setFieldingSort('range')}>Range</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider cursor-pointer" onClick={() => setFieldingSort('arm')}>Arm</th>
                  <th className="px-2 py-2 text-right text-gold-dim text-xs uppercase tracking-wider cursor-pointer" onClick={() => setFieldingSort('errorRate')}>Err</th>
                </tr>
              </thead>
              <tbody>
                {sortedFielding.map(({ ps, fi, teamAbbr, range, arm, errorRate, ovr }, i) => (
                  <tr
                    key={ps.playerId}
                    onClick={() => navigate(`/franchise/player-stats/${ps.playerId}`)}
                    className={cn(
                      'border-b border-navy-lighter/50 hover:bg-navy-lighter/30 transition-colors cursor-pointer',
                      i % 2 === 1 && 'bg-navy-lighter/10'
                    )}
                  >
                    <td className="px-2 py-1.5 text-cream-dim text-xs">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-cream hover:text-gold transition-colors font-body">
                        {ps.playerName}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center text-cream-dim text-xs">{teamAbbr}</td>
                    <td className="px-2 py-1.5 text-center text-gold text-xs">{fi?.position ?? ps.position}</td>
                    <td className="px-2 py-1.5 text-right text-cream">{ps.gamesPlayed}</td>
                    <td className={cn('px-2 py-1.5 text-right', fieldingSort === 'ovr' ? 'text-gold font-bold' : 'text-cream')}>{ovr}</td>
                    <td className={cn('px-2 py-1.5 text-right', fieldingSort === 'range' ? 'text-gold font-bold' : 'text-cream')}>{range}</td>
                    <td className={cn('px-2 py-1.5 text-right', fieldingSort === 'arm' ? 'text-gold font-bold' : 'text-cream')}>{arm}</td>
                    <td className={cn('px-2 py-1.5 text-right', fieldingSort === 'errorRate' ? 'text-gold font-bold' : 'text-cream')}>{errorRate}</td>
                  </tr>
                ))}
                {sortedFielding.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-2 py-8 text-center text-cream-dim">No fielding data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* League context summary */}
      {hasData && (
        <Panel title="League Averages" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 font-mono text-sm">
            {[
              { label: 'AVG', value: fmtAvg(leagueTotals.totalAB > 0 ? leagueTotals.totalH / leagueTotals.totalAB : 0) },
              { label: 'OBP', value: fmtAvg(leagueCtx.avgObp) },
              { label: 'SLG', value: fmtAvg(leagueCtx.avgSlg) },
              { label: 'wOBA', value: fmtAvg(leagueCtx.avgWoba) },
              { label: 'ERA', value: leagueCtx.avgEra.toFixed(2) },
              { label: 'R/G', value: fmtStat(leagueTotals.gamesPlayed > 0 ? ((leagueTotals as typeof leagueTotals & { totalGameRuns?: number }).totalGameRuns ?? leagueTotals.totalRuns) / (leagueTotals.gamesPlayed * 2) : 0, 2) },
              { label: 'Games', value: leagueTotals.gamesPlayed.toString() },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-cream-dim text-xs uppercase tracking-wider">{stat.label}</p>
                <p className="text-gold font-bold text-lg">{stat.value}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
