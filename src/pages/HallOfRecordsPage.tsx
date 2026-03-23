/**
 * HallOfRecordsPage — franchise all-time records and legendary performances.
 * Tracks the greatest seasons, single-game records, and career milestones
 * to create long-term engagement across multiple seasons.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { usePlayerModal } from '@/stores/playerModalStore.ts';
import { battingAvg, era, formatIP } from '@/engine/types/stats.ts';
import { cn } from '@/lib/cn.ts';

interface RecordEntry {
  rank: number;
  playerName: string;
  playerId: string;
  teamAbbr: string;
  value: string;
  numericValue: number;
  isUserTeam: boolean;
  season: number;
}

function RecordRow({ entry, onClick }: { entry: RecordEntry; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer text-left',
        entry.isUserTeam
          ? 'bg-gold/5 hover:bg-gold/10 border border-gold/20'
          : 'hover:bg-navy-lighter/20 border border-transparent',
        entry.rank === 1 && 'bg-gold/10 border-gold/30',
      )}
    >
      <span className={cn(
        'font-display text-sm w-6 text-center shrink-0',
        entry.rank === 1 ? 'text-gold' : entry.rank <= 3 ? 'text-cream' : 'text-cream-dim/50',
      )}>
        {entry.rank}
      </span>
      <span className="font-body text-sm text-cream truncate flex-1">{entry.playerName}</span>
      <span className="font-mono text-[10px] text-cream-dim/50 shrink-0">{entry.teamAbbr}</span>
      <span className={cn(
        'font-mono text-sm font-bold shrink-0 w-16 text-right',
        entry.rank === 1 ? 'text-gold' : 'text-cream',
      )}>
        {entry.value}
      </span>
    </button>
  );
}

function RecordCategory({ title, entries, openPlayer }: { title: string; entries: RecordEntry[]; openPlayer: (id: string) => void }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="font-display text-sm text-gold/70 uppercase tracking-widest mb-2">{title}</h3>
      <div className="space-y-0.5">
        {entries.slice(0, 10).map(e => (
          <RecordRow key={`${e.playerId}-${e.rank}`} entry={e} onClick={() => openPlayer(e.playerId)} />
        ))}
      </div>
    </div>
  );
}

export function HallOfRecordsPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId } = useFranchiseStore();
  const playerStats = useStatsStore(s => s.playerStats);
  const franchiseRecords = useStatsStore(s => s.records);
  const openPlayer = usePlayerModal(s => s.openPlayer);

  const team = useMemo(() => {
    if (!engine || !userTeamId) return null;
    return engine.getTeam(userTeamId) ?? null;
  }, [engine, userTeamId]);

  // Build all-time records from current season stats
  const records = useMemo(() => {
    if (!engine || !season) return { batting: [] as RecordEntry[][], pitching: [] as RecordEntry[][] };
    const year = season.year;
    const allStats = Object.values(playerStats);

    const makeEntry = (ps: typeof allStats[0], value: string, numericValue: number): RecordEntry => ({
      rank: 0,
      playerName: ps.playerName,
      playerId: ps.playerId,
      teamAbbr: engine.getTeam(ps.teamId)?.abbreviation ?? ps.teamId.slice(0, 3).toUpperCase(),
      value,
      numericValue,
      isUserTeam: ps.teamId === userTeamId,
      season: year,
    });

    // Batting records
    const battingCategories: { title: string; entries: RecordEntry[] }[] = [];

    // Home Runs
    const hrEntries = allStats.filter(ps => ps.batting.pa >= 30 && ps.position !== 'P')
      .map(ps => makeEntry(ps, String(ps.batting.hr), ps.batting.hr))
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    battingCategories.push({ title: 'Home Runs', entries: hrEntries });

    // Batting Average
    const avgEntries = allStats.filter(ps => ps.batting.pa >= 50 && ps.position !== 'P')
      .map(ps => {
        const avgVal = ps.batting.ab > 0 ? (ps.batting.h / ps.batting.ab).toFixed(3) : '.000';
        return makeEntry(ps, avgVal.startsWith('0') ? avgVal.slice(1) : avgVal, parseFloat(avgVal));
      })
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    battingCategories.push({ title: 'Batting Average', entries: avgEntries });

    // RBI
    const rbiEntries = allStats.filter(ps => ps.batting.pa >= 30 && ps.position !== 'P')
      .map(ps => makeEntry(ps, String(ps.batting.rbi), ps.batting.rbi))
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    battingCategories.push({ title: 'RBI', entries: rbiEntries });

    // Stolen Bases
    const sbEntries = allStats.filter(ps => ps.batting.pa >= 30)
      .map(ps => makeEntry(ps, String(ps.batting.sb), ps.batting.sb))
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    battingCategories.push({ title: 'Stolen Bases', entries: sbEntries });

    // Pitching records
    const pitchingCategories: { title: string; entries: RecordEntry[] }[] = [];

    // ERA (lower is better)
    const eraEntries = allStats.filter(ps => ps.pitching.ip >= 20)
      .map(ps => {
        const eraVal = ps.pitching.ip > 0 ? ((ps.pitching.er / ps.pitching.ip) * 9).toFixed(2) : '99.00';
        return makeEntry(ps, eraVal, parseFloat(eraVal));
      })
      .sort((a, b) => a.numericValue - b.numericValue) // Lower is better
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    pitchingCategories.push({ title: 'ERA (Best)', entries: eraEntries });

    // Strikeouts
    const soEntries = allStats.filter(ps => ps.pitching.ip >= 10)
      .map(ps => makeEntry(ps, String(ps.pitching.so), ps.pitching.so))
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    pitchingCategories.push({ title: 'Strikeouts', entries: soEntries });

    // Wins
    const winEntries = allStats.filter(ps => ps.pitching.ip >= 10)
      .map(ps => makeEntry(ps, String(ps.pitching.wins), ps.pitching.wins))
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    pitchingCategories.push({ title: 'Pitcher Wins', entries: winEntries });

    // Innings Pitched
    const ipEntries = allStats.filter(ps => ps.pitching.ip >= 10)
      .map(ps => {
        const ipStr = `${Math.floor(ps.pitching.ip / 3)}.${ps.pitching.ip % 3}`;
        return makeEntry(ps, ipStr, ps.pitching.ip);
      })
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .map((e, i) => ({ ...e, rank: i + 1 }));
    pitchingCategories.push({ title: 'Innings Pitched', entries: ipEntries });

    return { batting: battingCategories.map(c => c.entries), pitching: pitchingCategories.map(c => c.entries), battingTitles: battingCategories.map(c => c.title), pitchingTitles: pitchingCategories.map(c => c.title) };
  }, [engine, season, playerStats, userTeamId]);

  if (!team || !season) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Hall of Records</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          The greatest performances in franchise history — batting champions, strikeout kings, and record-holders.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  // Single-game records
  const gameRecords = useMemo(() => {
    if (!franchiseRecords) return [];
    const recs = [];
    if (franchiseRecords.mostHRGame) recs.push({ label: 'Most HR (Game)', ...franchiseRecords.mostHRGame });
    if (franchiseRecords.mostRBIGame) recs.push({ label: 'Most RBI (Game)', ...franchiseRecords.mostRBIGame });
    if (franchiseRecords.mostHitsGame) recs.push({ label: 'Most Hits (Game)', ...franchiseRecords.mostHitsGame });
    if (franchiseRecords.mostKGame) recs.push({ label: 'Most K (Game)', ...franchiseRecords.mostKGame });
    return recs;
  }, [franchiseRecords]);

  const rec = season.standings.getRecord(userTeamId!);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Hall of Records</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {season.year} Season · The greatest performances across all 30 teams
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/leaders')}>League Leaders</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Single-game records */}
      {gameRecords.length > 0 && (
        <Panel title="Single-Game Records">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gameRecords.map(r => (
              <div key={r.label} className={cn(
                'rounded-lg border px-4 py-3',
                r.teamId === userTeamId ? 'border-gold/30 bg-gold/5' : 'border-navy-lighter/30 bg-navy-lighter/10',
              )}>
                <p className="font-mono text-[9px] text-cream-dim/40 uppercase tracking-widest">{r.label}</p>
                <div className="flex items-center justify-between mt-1">
                  <button onClick={() => openPlayer(r.playerId)} className="font-display text-cream text-lg tracking-wide hover:text-gold transition-colors cursor-pointer">
                    {r.playerName}
                  </button>
                  <span className="font-display text-2xl text-gold font-bold">{r.value}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Season Batting Leaders */}
      <Panel title="Season Batting Records">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {records.batting.map((entries, i) => (
            <RecordCategory
              key={records.battingTitles?.[i] ?? i}
              title={records.battingTitles?.[i] ?? ''}
              entries={entries}
              openPlayer={openPlayer}
            />
          ))}
        </div>
      </Panel>

      {/* Season Pitching Leaders */}
      <Panel title="Season Pitching Records">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {records.pitching.map((entries, i) => (
            <RecordCategory
              key={records.pitchingTitles?.[i] ?? i}
              title={records.pitchingTitles?.[i] ?? ''}
              entries={entries}
              openPlayer={openPlayer}
            />
          ))}
        </div>
      </Panel>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 justify-center pb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/leaders')}>League Leaders</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/records')}>Records</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/awards')}>Awards</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/season-review')}>Season Review</Button>
      </div>
    </div>
  );
}
