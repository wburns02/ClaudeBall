import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { fmtAvg } from '@/engine/stats/AdvancedStats.ts';
import { cn } from '@/lib/cn.ts';
import type { FranchiseRecord } from '@/stores/statsStore.ts';
import type { ReactElement } from 'react';

function RecordCard({
  title,
  record,
  format,
  lower = false,
  onClick,
}: {
  title: string;
  record: FranchiseRecord | null;
  format: (v: number) => string;
  lower?: boolean;
  onClick?: (id: string) => void;
}): ReactElement {
  return (
    <div className="bg-navy-lighter/20 border border-navy-lighter/50 rounded-lg p-3">
      <p className="text-gold-dim text-xs uppercase tracking-wider font-mono mb-2">{title}</p>
      {record ? (
        <div>
          <div className={cn('text-2xl font-mono font-bold', lower ? 'text-cream' : 'text-gold')}>
            {format(record.value)}
          </div>
          <button
            className="text-cream hover:text-gold transition-colors font-body text-sm mt-1 text-left"
            onClick={() => onClick?.(record.playerId)}
          >
            {record.playerName}
          </button>
          <p className="text-cream-dim text-xs font-mono mt-0.5">
            Season {record.season}
            {record.gameDate ? ` · Day ${record.gameDate}` : ''}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-2xl font-mono font-bold text-cream-dim">—</p>
          <p className="text-cream-dim text-xs font-mono mt-1">No record set</p>
        </div>
      )}
    </div>
  );
}

function GameRecordCard({
  title,
  record,
  format,
  onClick,
}: {
  title: string;
  record: FranchiseRecord | null;
  format: (v: number) => string;
  onClick?: (id: string) => void;
}): ReactElement {
  return <RecordCard title={title} record={record} format={format} onClick={onClick} />;
}

export function RecordsPage() {
  const navigate = useNavigate();
  const { records, getCurrentSeasonStats, leagueTotals } = useStatsStore();
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);
  const { engine, season } = useFranchiseStore();

  const handlePlayerClick = (playerId: string) => {
    navigate(`/franchise/player-stats/${playerId}`);
  };

  // Compute single-game records from game logs
  const singleGameRecords = {
    mostHRGame: null as FranchiseRecord | null,
    mostRBIGame: null as FranchiseRecord | null,
    mostHitsGame: null as FranchiseRecord | null,
    mostKGame: null as FranchiseRecord | null,
    mostIPGame: null as FranchiseRecord | null,
  };

  for (const ps of Object.values(playerStats)) {
    for (const g of ps.gameLog) {
      if (!singleGameRecords.mostHRGame || g.hr > singleGameRecords.mostHRGame.value) {
        if (g.hr > 0) {
          singleGameRecords.mostHRGame = {
            playerId: ps.playerId, playerName: ps.playerName, teamId: ps.teamId,
            value: g.hr, season: season?.year ?? 0, gameDate: g.date,
          };
        }
      }
      if (!singleGameRecords.mostRBIGame || g.rbi > singleGameRecords.mostRBIGame.value) {
        if (g.rbi > 0) {
          singleGameRecords.mostRBIGame = {
            playerId: ps.playerId, playerName: ps.playerName, teamId: ps.teamId,
            value: g.rbi, season: season?.year ?? 0, gameDate: g.date,
          };
        }
      }
      if (!singleGameRecords.mostHitsGame || g.h > singleGameRecords.mostHitsGame.value) {
        if (g.h > 0) {
          singleGameRecords.mostHitsGame = {
            playerId: ps.playerId, playerName: ps.playerName, teamId: ps.teamId,
            value: g.h, season: season?.year ?? 0, gameDate: g.date,
          };
        }
      }
      if (g.ip && g.ip !== '0.0') {
        const ipParts = g.ip.split('.');
        const ipVal = parseInt(ipParts[0]) + (parseInt(ipParts[1] || '0') / 3);
        if (!singleGameRecords.mostKGame || g.kPitching > singleGameRecords.mostKGame.value) {
          if (g.kPitching > 0) {
            singleGameRecords.mostKGame = {
              playerId: ps.playerId, playerName: ps.playerName, teamId: ps.teamId,
              value: g.kPitching, season: season?.year ?? 0, gameDate: g.date,
            };
          }
        }
        if (!singleGameRecords.mostIPGame || ipVal > singleGameRecords.mostIPGame.value) {
          if (ipVal > 0) {
            singleGameRecords.mostIPGame = {
              playerId: ps.playerId, playerName: ps.playerName, teamId: ps.teamId,
              value: ipVal, season: season?.year ?? 0, gameDate: g.date,
            };
          }
        }
      }
    }
  }

  const hasRecords = Object.values(records).some(r => r !== null) ||
    Object.values(singleGameRecords).some(r => r !== null);

  const currentYear = season?.year ?? 2026;

  // Top season performers (from live stats)
  const topBatters = Object.values(playerStats)
    .filter(ps => ps.batting.ab >= 50 && ps.position !== 'P')
    .sort((a, b) => {
      const aAvg = a.batting.ab > 0 ? a.batting.h / a.batting.ab : 0;
      const bAvg = b.batting.ab > 0 ? b.batting.h / b.batting.ab : 0;
      return bAvg - aAvg;
    })
    .slice(0, 5);

  const topHrHitters = Object.values(playerStats)
    .filter(ps => ps.position !== 'P')
    .sort((a, b) => b.batting.hr - a.batting.hr)
    .slice(0, 5);

  const topPitchers = Object.values(playerStats)
    .filter(ps => ps.pitching.ip >= 9)
    .sort((a, b) => {
      const aEra = (a.pitching.er / (a.pitching.ip / 3)) * 9;
      const bEra = (b.pitching.er / (b.pitching.ip / 3)) * 9;
      return aEra - bEra;
    })
    .slice(0, 5);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Franchise Records</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">Season {currentYear}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/leaders')}>Leaders</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {!hasRecords && (
        <Panel>
          <div className="text-center py-12">
            <p className="font-mono text-cream-dim text-lg">No records set yet.</p>
            <p className="font-mono text-cream-dim text-sm mt-2">
              Records are tracked as games are played in franchise mode.
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => navigate('/franchise')}>
              Go to Dashboard
            </Button>
          </div>
        </Panel>
      )}

      {hasRecords && (
        <>
          {/* Single-game records */}
          <Panel title="Single-Game Records" className="mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <GameRecordCard
                title="Most HR (game)"
                record={singleGameRecords.mostHRGame}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <GameRecordCard
                title="Most RBI (game)"
                record={singleGameRecords.mostRBIGame}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <GameRecordCard
                title="Most Hits (game)"
                record={singleGameRecords.mostHitsGame}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <GameRecordCard
                title="Most K (pitcher)"
                record={singleGameRecords.mostKGame}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <GameRecordCard
                title="Most IP (game)"
                record={singleGameRecords.mostIPGame}
                format={(v) => v.toFixed(1)}
                onClick={handlePlayerClick}
              />
            </div>
          </Panel>

          {/* Season records */}
          <Panel title="Season Records" className="mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <RecordCard
                title="Highest Batting Avg"
                record={records.highestBA}
                format={fmtAvg}
                onClick={handlePlayerClick}
              />
              <RecordCard
                title="Most HR (season)"
                record={records.mostHRSeason}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <RecordCard
                title="Most RBI (season)"
                record={records.mostRBISeason}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <RecordCard
                title="Most SB (season)"
                record={records.mostSBSeason}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <RecordCard
                title="Lowest ERA (season)"
                record={records.lowestERA}
                format={(v) => v.toFixed(2)}
                lower
                onClick={handlePlayerClick}
              />
              <RecordCard
                title="Most K (season)"
                record={records.mostKSeason}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
              <RecordCard
                title="Most Wins (season)"
                record={records.mostWSeason}
                format={(v) => v.toString()}
                onClick={handlePlayerClick}
              />
            </div>
          </Panel>
        </>
      )}

      {/* Current season leaders (always shown if data exists) */}
      {(topBatters.length > 0 || topHrHitters.length > 0 || topPitchers.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {topBatters.length > 0 && (
            <Panel title={`${currentYear} Batting Average`}>
              <div className="space-y-2">
                {topBatters.map((ps, i) => {
                  const avg = ps.batting.ab > 0 ? ps.batting.h / ps.batting.ab : 0;
                  const teamAbbr = engine?.getTeam(ps.teamId)?.abbreviation ?? '---';
                  return (
                    <div key={ps.playerId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-cream-dim text-xs font-mono w-4">{i + 1}</span>
                        <button
                          className="text-cream hover:text-gold transition-colors text-sm font-body"
                          onClick={() => navigate(`/franchise/player-stats/${ps.playerId}`)}
                        >
                          {ps.playerName}
                        </button>
                        <span className="text-cream-dim text-xs font-mono">{teamAbbr}</span>
                      </div>
                      <span className="text-gold font-mono font-bold">{fmtAvg(avg)}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {topHrHitters.length > 0 && (
            <Panel title={`${currentYear} Home Runs`}>
              <div className="space-y-2">
                {topHrHitters.map((ps, i) => {
                  const teamAbbr = engine?.getTeam(ps.teamId)?.abbreviation ?? '---';
                  return (
                    <div key={ps.playerId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-cream-dim text-xs font-mono w-4">{i + 1}</span>
                        <button
                          className="text-cream hover:text-gold transition-colors text-sm font-body"
                          onClick={() => navigate(`/franchise/player-stats/${ps.playerId}`)}
                        >
                          {ps.playerName}
                        </button>
                        <span className="text-cream-dim text-xs font-mono">{teamAbbr}</span>
                      </div>
                      <span className="text-gold font-mono font-bold">{ps.batting.hr}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {topPitchers.length > 0 && (
            <Panel title={`${currentYear} ERA`}>
              <div className="space-y-2">
                {topPitchers.map((ps, i) => {
                  const pEra = ps.pitching.ip > 0 ? (ps.pitching.er / (ps.pitching.ip / 3)) * 9 : 0;
                  const teamAbbr = engine?.getTeam(ps.teamId)?.abbreviation ?? '---';
                  return (
                    <div key={ps.playerId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-cream-dim text-xs font-mono w-4">{i + 1}</span>
                        <button
                          className="text-cream hover:text-gold transition-colors text-sm font-body"
                          onClick={() => navigate(`/franchise/player-stats/${ps.playerId}`)}
                        >
                          {ps.playerName}
                        </button>
                        <span className="text-cream-dim text-xs font-mono">{teamAbbr}</span>
                      </div>
                      <span className="text-gold font-mono font-bold">{pEra.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* League stats summary */}
      {leagueTotals.gamesPlayed > 0 && (
        <Panel title="Season at a Glance" className="mt-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 font-mono text-sm text-center">
            {[
              { label: 'Games', value: leagueTotals.gamesPlayed.toString() },
              { label: 'Total HR', value: leagueTotals.totalHR.toString() },
              { label: 'Total SO', value: leagueTotals.totalSO.toString() },
              { label: 'Total BB', value: leagueTotals.totalBB.toString() },
              { label: 'Total Runs', value: leagueTotals.totalRuns.toString() },
              { label: 'Total Hits', value: leagueTotals.totalH.toString() },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-cream-dim text-xs uppercase tracking-wider">{stat.label}</p>
                <p className="text-gold font-bold text-xl">{stat.value}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
