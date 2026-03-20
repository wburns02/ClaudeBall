import { useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useHistoryStore } from '@/stores/historyStore.ts';
import type { FranchisePlayerSeasonRecord } from '@/stores/historyStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';

const GOLD = '#d4a843';
const CREAM = '#e8e0d4';
const NAVY_DARK = '#0f1929';
const TOOLTIP_STYLE = {
  backgroundColor: NAVY_DARK,
  border: '1px solid #1e2d44',
  borderRadius: '6px',
  color: CREAM,
  fontSize: 11,
};

function fmt3(n: number) { return n.toFixed(3).replace(/^0\./, '.'); }
function fmtEra(n: number) { return n.toFixed(2); }

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-navy-light border border-navy-lighter rounded-lg p-3 text-center">
      <p className="text-cream-dim text-[10px] font-mono uppercase tracking-widest">{label}</p>
      <p className="text-gold font-display text-2xl mt-1">{value}</p>
      {sub && <p className="text-cream-dim/50 text-[10px] font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Season row types ──────────────────────────────────────────────────────────
type DisplayRecord = FranchisePlayerSeasonRecord & { isCurrent?: boolean };

// ── Batting stat table ────────────────────────────────────────────────────────
function BattingTable({ rows }: { rows: DisplayRecord[] }) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const tot = sorted.reduce((acc, r) => ({
    g: acc.g + r.gamesPlayed, ab: acc.ab + r.ab, r: acc.r + r.r, h: acc.h + r.h,
    doubles: acc.doubles + r.doubles, triples: acc.triples + r.triples,
    hr: acc.hr + r.hr, rbi: acc.rbi + r.rbi, bb: acc.bb + r.bb, so: acc.so + r.so, sb: acc.sb + r.sb,
  }), { g:0, ab:0, r:0, h:0, doubles:0, triples:0, hr:0, rbi:0, bb:0, so:0, sb:0 });
  const cAvg = tot.ab > 0 ? fmt3(tot.h / tot.ab) : '.000';
  const cObp = (tot.ab + tot.bb) > 0 ? fmt3((tot.h + tot.bb) / (tot.ab + tot.bb)) : '.000';
  const singles = tot.h - tot.doubles - tot.triples - tot.hr;
  const tb = singles + 2*tot.doubles + 3*tot.triples + 4*tot.hr;
  const cSlg = tot.ab > 0 ? fmt3(tb / tot.ab) : '.000';
  const cOps = tot.ab > 0 ? fmt3(parseFloat(cObp) + parseFloat(cSlg.replace('.', '0.'))) : '.000';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse min-w-[740px]">
        <thead>
          <tr className="border-b border-navy-lighter">
            {['Year','Team','G','AB','R','H','2B','3B','HR','RBI','BB','SO','SB','AVG','OBP','SLG','OPS'].map(h => (
              <th key={h} className={cn(
                'py-1.5 px-2 text-cream-dim/60 text-[10px] uppercase tracking-wider font-semibold',
                h === 'Year' || h === 'Team' ? 'text-left' : 'text-right',
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className={cn(
              'border-b border-navy-lighter/20 hover:bg-navy-lighter/10 transition-colors',
              row.isCurrent && 'bg-gold/5',
            )}>
              <td className="py-1.5 px-2 text-left font-bold text-cream">
                {row.year}
                {row.isCurrent && <span className="ml-1 text-[9px] text-gold/70 font-normal">(cur)</span>}
              </td>
              <td className="py-1.5 px-2 text-left text-cream-dim/70 max-w-[80px] truncate">{row.teamName}</td>
              <td className="py-1 px-2 text-right text-cream">{row.gamesPlayed}</td>
              <td className="py-1 px-2 text-right text-cream">{row.ab}</td>
              <td className="py-1 px-2 text-right text-cream">{row.r}</td>
              <td className="py-1 px-2 text-right text-cream">{row.h}</td>
              <td className="py-1 px-2 text-right text-cream">{row.doubles}</td>
              <td className="py-1 px-2 text-right text-cream">{row.triples}</td>
              <td className="py-1 px-2 text-right text-cream">{row.hr}</td>
              <td className="py-1 px-2 text-right text-cream">{row.rbi}</td>
              <td className="py-1 px-2 text-right text-cream">{row.bb}</td>
              <td className="py-1 px-2 text-right text-cream">{row.so}</td>
              <td className="py-1 px-2 text-right text-cream">{row.sb}</td>
              <td className="py-1 px-2 text-right text-gold font-semibold">{fmt3(row.avg)}</td>
              <td className="py-1 px-2 text-right text-cream">{fmt3(row.obp)}</td>
              <td className="py-1 px-2 text-right text-cream">{fmt3(row.slg)}</td>
              <td className="py-1 px-2 text-right text-cream">{fmt3(row.ops)}</td>
            </tr>
          ))}
          {sorted.length > 1 && (
            <tr className="border-t-2 border-gold/40 bg-gold/5 text-gold font-bold">
              <td className="py-1.5 px-2 text-left">Career</td>
              <td className="py-1 px-2 text-left text-cream-dim/40 font-normal text-[10px]">{sorted.length} seasons</td>
              <td className="py-1 px-2 text-right">{tot.g}</td>
              <td className="py-1 px-2 text-right">{tot.ab}</td>
              <td className="py-1 px-2 text-right">{tot.r}</td>
              <td className="py-1 px-2 text-right">{tot.h}</td>
              <td className="py-1 px-2 text-right">{tot.doubles}</td>
              <td className="py-1 px-2 text-right">{tot.triples}</td>
              <td className="py-1 px-2 text-right">{tot.hr}</td>
              <td className="py-1 px-2 text-right">{tot.rbi}</td>
              <td className="py-1 px-2 text-right">{tot.bb}</td>
              <td className="py-1 px-2 text-right">{tot.so}</td>
              <td className="py-1 px-2 text-right">{tot.sb}</td>
              <td className="py-1 px-2 text-right">{cAvg}</td>
              <td className="py-1 px-2 text-right">{cObp}</td>
              <td className="py-1 px-2 text-right">{cSlg}</td>
              <td className="py-1 px-2 text-right">{cOps}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Pitching stat table ───────────────────────────────────────────────────────
function PitchingTable({ rows }: { rows: DisplayRecord[] }) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const tot = sorted.reduce((acc, r) => ({
    g: acc.g + r.gamesPlayed, wins: acc.wins + r.wins, losses: acc.losses + r.losses,
    saves: acc.saves + r.saves, ip: acc.ip + r.ip,
    h: acc.h + r.h_allowed, er: acc.er + r.er, bb: acc.bb + r.bb_p, so: acc.so + r.so_p,
  }), { g:0, wins:0, losses:0, saves:0, ip:0, h:0, er:0, bb:0, so:0 });
  const cEra = tot.ip > 0 ? fmtEra((tot.er / tot.ip) * 9) : '—';
  const cWhip = tot.ip > 0 ? (((tot.h + tot.bb) / tot.ip)).toFixed(3) : '—';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse min-w-[580px]">
        <thead>
          <tr className="border-b border-navy-lighter">
            {['Year','Team','G','W','L','SV','IP','H','ER','BB','SO','ERA','WHIP'].map(h => (
              <th key={h} className={cn(
                'py-1.5 px-2 text-cream-dim/60 text-[10px] uppercase tracking-wider font-semibold',
                h === 'Year' || h === 'Team' ? 'text-left' : 'text-right',
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className={cn(
              'border-b border-navy-lighter/20 hover:bg-navy-lighter/10 transition-colors',
              row.isCurrent && 'bg-gold/5',
            )}>
              <td className="py-1.5 px-2 text-left font-bold text-cream">
                {row.year}
                {row.isCurrent && <span className="ml-1 text-[9px] text-gold/70 font-normal">(cur)</span>}
              </td>
              <td className="py-1.5 px-2 text-left text-cream-dim/70 max-w-[80px] truncate">{row.teamName}</td>
              <td className="py-1 px-2 text-right text-cream">{row.gamesPlayed}</td>
              <td className="py-1 px-2 text-right text-cream">{row.wins}</td>
              <td className="py-1 px-2 text-right text-cream">{row.losses}</td>
              <td className="py-1 px-2 text-right text-cream">{row.saves}</td>
              <td className="py-1 px-2 text-right text-cream">{row.ip.toFixed(1)}</td>
              <td className="py-1 px-2 text-right text-cream">{row.h_allowed}</td>
              <td className="py-1 px-2 text-right text-cream">{row.er}</td>
              <td className="py-1 px-2 text-right text-cream">{row.bb_p}</td>
              <td className="py-1 px-2 text-right text-cream">{row.so_p}</td>
              <td className="py-1 px-2 text-right text-gold font-semibold">{fmtEra(row.era)}</td>
              <td className="py-1 px-2 text-right text-cream">{row.whip.toFixed(3)}</td>
            </tr>
          ))}
          {sorted.length > 1 && (
            <tr className="border-t-2 border-gold/40 bg-gold/5 text-gold font-bold">
              <td className="py-1.5 px-2 text-left">Career</td>
              <td className="py-1 px-2 text-left text-cream-dim/40 font-normal text-[10px]">{sorted.length} seasons</td>
              <td className="py-1 px-2 text-right">{tot.g}</td>
              <td className="py-1 px-2 text-right">{tot.wins}</td>
              <td className="py-1 px-2 text-right">{tot.losses}</td>
              <td className="py-1 px-2 text-right">{tot.saves}</td>
              <td className="py-1 px-2 text-right">{tot.ip.toFixed(1)}</td>
              <td className="py-1 px-2 text-right">{tot.h}</td>
              <td className="py-1 px-2 text-right">{tot.er}</td>
              <td className="py-1 px-2 text-right">{tot.bb}</td>
              <td className="py-1 px-2 text-right">{tot.so}</td>
              <td className="py-1 px-2 text-right">{cEra}</td>
              <td className="py-1 px-2 text-right">{cWhip}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Player search ─────────────────────────────────────────────────────────────
type PlayerMeta = {
  playerId: string;
  playerName: string;
  position: string;
  seasons: number;
  latestTeamName: string;
};

function PlayerSearch({
  players,
  selectedId,
  onSelect,
}: {
  players: PlayerMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return players.slice(0, 20);
    const q = query.toLowerCase();
    return players.filter(p => p.playerName.toLowerCase().includes(q)).slice(0, 20);
  }, [query, players]);

  const selected = players.find(p => p.playerId === selectedId);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search player name…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          'w-full bg-navy-light border border-navy-lighter rounded-lg px-3 py-2',
          'font-mono text-sm text-cream placeholder:text-cream-dim/30',
          'focus:outline-none focus:border-gold/50 transition-colors',
        )}
      />
      {selected && !query && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/60 text-xs font-mono pointer-events-none">
          {selected.playerName}
        </div>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-navy border border-navy-lighter rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.playerId}
              onMouseDown={() => { onSelect(p.playerId); setQuery(''); setOpen(false); }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 hover:bg-navy-lighter/30 transition-colors text-left',
                p.playerId === selectedId && 'bg-gold/10',
              )}
            >
              <div>
                <span className="font-mono text-sm font-semibold text-cream">{p.playerName}</span>
                <span className="ml-2 text-cream-dim/50 text-xs font-mono">{p.position}</span>
              </div>
              <div className="text-right">
                <span className="text-cream-dim/50 text-xs font-mono">{p.latestTeamName}</span>
                <span className="ml-2 text-cream-dim/30 text-xs font-mono">{p.seasons} yr{p.seasons !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function FranchisePlayerHistoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const franchisePlayerHistory = useHistoryStore(s => s.franchisePlayerHistory);
  const awardHistory = useHistoryStore(s => s.awardHistory);
  const playerStats = useStatsStore(s => s.playerStats);
  const currentSeason = useStatsStore(s => s.currentSeason);
  const { season, engine, userTeamId } = useFranchiseStore();

  const selectedId = searchParams.get('player') ?? null;
  const [tab, setTab] = useState<'table' | 'charts'>('table');

  // Build metadata for all players with historical records
  const allPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of franchisePlayerHistory) ids.add(r.playerId);
    for (const ps of Object.values(playerStats)) if (ps.gamesPlayed > 0) ids.add(ps.playerId);
    return ids;
  }, [franchisePlayerHistory, playerStats]);

  const playerMeta = useMemo((): PlayerMeta[] => {
    const map = new Map<string, PlayerMeta>();
    for (const r of franchisePlayerHistory) {
      const existing = map.get(r.playerId);
      if (!existing || r.year > (map.get(r.playerId)?.seasons ?? 0)) {
        map.set(r.playerId, {
          playerId: r.playerId,
          playerName: r.playerName,
          position: r.position,
          seasons: franchisePlayerHistory.filter(x => x.playerId === r.playerId).length,
          latestTeamName: r.teamName,
        });
      }
    }
    // Include current-season players not yet in history
    for (const ps of Object.values(playerStats)) {
      if (!map.has(ps.playerId) && ps.gamesPlayed > 0) {
        const team = engine?.getTeam(ps.teamId);
        map.set(ps.playerId, {
          playerId: ps.playerId,
          playerName: ps.playerName,
          position: ps.position,
          seasons: 1,
          latestTeamName: team ? `${team.city} ${team.name}` : ps.teamId,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.seasons - a.seasons || a.playerName.localeCompare(b.playerName));
  }, [franchisePlayerHistory, playerStats, engine]);

  // Build display rows for the selected player
  const selectedRows = useMemo((): DisplayRecord[] => {
    if (!selectedId) return [];
    const historical = franchisePlayerHistory.filter(r => r.playerId === selectedId);
    const currentPs = playerStats[selectedId];
    const rows: DisplayRecord[] = [...historical];

    // Add current season if it's not already in history (season in progress)
    if (currentPs && currentPs.gamesPlayed > 0) {
      const alreadyInHistory = historical.some(r => r.year === currentSeason);
      if (!alreadyInHistory) {
        const team = engine?.getTeam(currentPs.teamId);
        const teamName = team ? `${team.city} ${team.name}` : currentPs.teamId;
        const b = currentPs.batting;
        const p = currentPs.pitching;
        const avg = b.ab > 0 ? b.h / b.ab : 0;
        const obp = (b.ab + b.bb + b.hbp + b.sf) > 0 ? (b.h + b.bb + b.hbp) / (b.ab + b.bb + b.hbp + b.sf) : 0;
        const singles = b.h - b.doubles - b.triples - b.hr;
        const slg = b.ab > 0 ? (singles + 2*b.doubles + 3*b.triples + 4*b.hr) / b.ab : 0;
        const ipDec = p.ip / 3;
        const era = ipDec > 0 ? (p.er / ipDec) * 9 : 0;
        const whip = ipDec > 0 ? (p.bb + p.h) / ipDec : 0;
        rows.push({
          playerId: currentPs.playerId,
          playerName: currentPs.playerName,
          teamId: currentPs.teamId,
          teamName,
          year: currentSeason,
          position: currentPs.position,
          gamesPlayed: currentPs.gamesPlayed,
          ab: b.ab, r: b.r, h: b.h, doubles: b.doubles, triples: b.triples,
          hr: b.hr, rbi: b.rbi, bb: b.bb, so: b.so, sb: b.sb,
          avg, obp, slg, ops: obp + slg,
          wins: p.wins, losses: p.losses, saves: p.saves, ip: ipDec,
          h_allowed: p.h, er: p.er, bb_p: p.bb, so_p: p.so,
          era, whip,
          isCurrent: true,
        });
      }
    }
    return rows.sort((a, b) => a.year - b.year);
  }, [selectedId, franchisePlayerHistory, playerStats, currentSeason, engine]);

  const selectedMeta = playerMeta.find(p => p.playerId === selectedId);
  const isPitcher = selectedMeta?.position === 'P' || selectedMeta?.position === 'SP' || selectedMeta?.position === 'RP' || selectedMeta?.position === 'CL';

  // Career totals for KPI cards
  const careerTotals = useMemo(() => {
    if (!selectedRows.length) return null;
    return selectedRows.reduce((acc, r) => ({
      g: acc.g + r.gamesPlayed, ab: acc.ab + r.ab, h: acc.h + r.h,
      hr: acc.hr + r.hr, rbi: acc.rbi + r.rbi, sb: acc.sb + r.sb,
      wins: acc.wins + r.wins, losses: acc.losses + r.losses,
      ip: acc.ip + r.ip, so_p: acc.so_p + r.so_p, er: acc.er + r.er,
    }), { g:0, ab:0, h:0, hr:0, rbi:0, sb:0, wins:0, losses:0, ip:0, so_p:0, er:0 });
  }, [selectedRows]);

  // Chart data
  const chartData = selectedRows.map(r => ({
    year: r.year.toString(),
    avg: Math.round(r.avg * 1000),
    hr: r.hr,
    rbi: r.rbi,
    era: parseFloat(r.era.toFixed(2)),
    wins: r.wins,
    so: r.so_p,
    whip: parseFloat(r.whip.toFixed(3)),
  }));

  // Awards for this player
  const playerAwards = awardHistory.filter(a => a.playerId === selectedId);

  // Notable players to feature when none selected (top career HR batters + win leaders)
  const featuredPlayers = useMemo(() => {
    const byPlayer = new Map<string, { hr: number; wins: number; name: string; seasons: number; isPitcher: boolean }>();
    for (const r of franchisePlayerHistory) {
      const existing = byPlayer.get(r.playerId) ?? { hr: 0, wins: 0, name: r.playerName, seasons: 0, isPitcher: false };
      byPlayer.set(r.playerId, {
        hr: existing.hr + r.hr,
        wins: existing.wins + r.wins,
        name: r.playerName,
        seasons: existing.seasons + 1,
        isPitcher: r.position === 'P' || r.position === 'SP',
      });
    }
    const all = Array.from(byPlayer.entries()).map(([id, v]) => ({ playerId: id, ...v }));
    const batters = all.filter(p => !p.isPitcher).sort((a, b) => b.hr - a.hr).slice(0, 5);
    const pitchers = all.filter(p => p.isPitcher).sort((a, b) => b.wins - a.wins).slice(0, 5);
    return { batters, pitchers };
  }, [franchisePlayerHistory]);

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            Player Career History
          </h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {franchisePlayerHistory.length > 0
              ? `${new Set(franchisePlayerHistory.map(r => r.playerId)).size} players across ${new Set(franchisePlayerHistory.map(r => r.year)).size} season${new Set(franchisePlayerHistory.map(r => r.year)).size !== 1 ? 's' : ''} archived`
              : `Season ${season?.year ?? currentSeason} in progress — history grows after each completed season`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/history')}>
          ← Franchise History
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <PlayerSearch
          players={playerMeta}
          selectedId={selectedId}
          onSelect={(id) => {
            setSearchParams({ player: id });
            setTab('table');
          }}
        />
        {playerMeta.length === 0 && (
          <p className="text-cream-dim/40 font-mono text-xs mt-2 text-center">
            No players with stats yet. Simulate some games first.
          </p>
        )}
      </div>

      {/* Selected player view */}
      {selectedId && selectedMeta && careerTotals && selectedRows.length > 0 ? (
        <div className="space-y-5">
          {/* Player header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-display text-2xl text-cream tracking-wide">{selectedMeta.playerName}</h2>
              <p className="font-mono text-cream-dim text-sm mt-0.5">
                {selectedMeta.position}
                {selectedRows.length > 0 && ` · ${selectedRows.length} season${selectedRows.length !== 1 ? 's' : ''}`}
                {selectedMeta.latestTeamName && ` · ${selectedMeta.latestTeamName}`}
              </p>
            </div>
            {userTeamId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/franchise/player-stats/${selectedId}`)}
              >
                Current Stats →
              </Button>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isPitcher ? (
              <>
                <KpiCard label="Career Wins" value={careerTotals.wins} />
                <KpiCard label="Career Strikeouts" value={careerTotals.so_p} />
                <KpiCard label="Career ERA"
                  value={careerTotals.ip > 0 ? fmtEra((careerTotals.er / careerTotals.ip) * 9) : '—'}
                  sub={`${careerTotals.ip.toFixed(1)} IP`}
                />
                <KpiCard label="Career Record"
                  value={`${careerTotals.wins}-${careerTotals.losses}`}
                  sub={`${selectedRows.length} seasons`}
                />
              </>
            ) : (
              <>
                <KpiCard label="Career HR" value={careerTotals.hr} />
                <KpiCard label="Career Hits" value={careerTotals.h} />
                <KpiCard label="Career RBI" value={careerTotals.rbi} />
                <KpiCard
                  label="Career AVG"
                  value={careerTotals.ab > 0 ? fmt3(careerTotals.h / careerTotals.ab) : '.000'}
                  sub={`${careerTotals.g} G`}
                />
              </>
            )}
          </div>

          {/* Awards */}
          {playerAwards.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-cream-dim/50 text-xs font-mono uppercase tracking-wider">Awards:</span>
              {playerAwards.sort((a, b) => b.year - a.year).map((award, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-gold/20 text-gold text-xs font-mono">
                  {award.year} {award.type}
                </span>
              ))}
            </div>
          )}

          {/* Tab navigation */}
          <div className="flex gap-1 p-1 bg-navy-light/40 rounded-lg w-fit">
            {(['table', 'charts'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-1.5 rounded-md font-mono text-xs font-semibold transition-all cursor-pointer',
                  tab === t ? 'bg-gold text-navy shadow-sm' : 'text-cream-dim hover:text-cream',
                )}
              >
                {t === 'table' ? 'Season Log' : 'Charts'}
              </button>
            ))}
          </div>

          {/* Stats table */}
          {tab === 'table' && (
            <Panel>
              {isPitcher
                ? <PitchingTable rows={selectedRows} />
                : <BattingTable rows={selectedRows} />
              }
              {selectedRows.length === 1 && selectedRows[0].isCurrent && (
                <p className="text-center font-mono text-[10px] text-cream-dim/30 mt-3">
                  Season in progress — archive unlocks after playoffs
                </p>
              )}
            </Panel>
          )}

          {/* Charts */}
          {tab === 'charts' && chartData.length > 0 && (
            <div className="space-y-5">
              {!isPitcher ? (
                <>
                  <Panel title="Batting Average by Season">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                        <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                        <YAxis
                          stroke={CREAM}
                          tick={{ fontSize: 10, fill: '#a09880' }}
                          domain={[150, 400]}
                          tickFormatter={(v) => `.${String(v).padStart(3,'0')}`}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`.${String(Number(v)).padStart(3,'0')}`, 'AVG']} />
                        <Line type="monotone" dataKey="avg" stroke={GOLD} strokeWidth={2.5} dot={{ r: 4, fill: GOLD }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Panel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Panel title="Home Runs by Season">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="hr" fill="#ef4444" radius={[3,3,0,0]} name="HR" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Panel>
                    <Panel title="RBI by Season">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="rbi" fill="#22c55e" radius={[3,3,0,0]} name="RBI" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Panel>
                  </div>
                </>
              ) : (
                <>
                  <Panel title="ERA by Season">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                        <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                        <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} domain={[0, 8]} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="era" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444' }} name="ERA" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Panel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Panel title="Wins by Season">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="wins" fill={GOLD} radius={[3,3,0,0]} name="Wins" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Panel>
                    <Panel title="Strikeouts by Season">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d44" />
                          <XAxis dataKey="year" stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <YAxis stroke={CREAM} tick={{ fontSize: 10, fill: '#a09880' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="so" fill="#3b82f6" radius={[3,3,0,0]} name="K" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Panel>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : selectedId ? (
        <Panel>
          <p className="text-center py-8 text-cream-dim font-mono text-sm">
            No stats found for this player.
          </p>
        </Panel>
      ) : (
        /* No player selected — show franchise leaderboards */
        <div className="space-y-5">
          {franchisePlayerHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Panel title="All-Time HR Leaders">
                <div className="space-y-1">
                  {featuredPlayers.batters.length === 0
                    ? <p className="text-cream-dim/50 text-xs font-mono py-2">No batter history yet</p>
                    : featuredPlayers.batters.map((p, i) => (
                      <button
                        key={p.playerId}
                        onClick={() => setSearchParams({ player: p.playerId })}
                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-navy-lighter/20 rounded transition-colors text-left group"
                      >
                        <span className="font-mono text-xs text-cream-dim/40 w-5 text-right">{i + 1}</span>
                        <span className="font-mono text-sm text-cream flex-1 group-hover:text-gold transition-colors">{p.name}</span>
                        <span className="font-mono text-sm text-gold font-bold">{p.hr}</span>
                        <span className="font-mono text-xs text-cream-dim/40">HR</span>
                      </button>
                    ))}
                </div>
              </Panel>
              <Panel title="All-Time Win Leaders">
                <div className="space-y-1">
                  {featuredPlayers.pitchers.length === 0
                    ? <p className="text-cream-dim/50 text-xs font-mono py-2">No pitcher history yet</p>
                    : featuredPlayers.pitchers.map((p, i) => (
                      <button
                        key={p.playerId}
                        onClick={() => setSearchParams({ player: p.playerId })}
                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-navy-lighter/20 rounded transition-colors text-left group"
                      >
                        <span className="font-mono text-xs text-cream-dim/40 w-5 text-right">{i + 1}</span>
                        <span className="font-mono text-sm text-cream flex-1 group-hover:text-gold transition-colors">{p.name}</span>
                        <span className="font-mono text-sm text-gold font-bold">{p.wins}</span>
                        <span className="font-mono text-xs text-cream-dim/40">W</span>
                      </button>
                    ))}
                </div>
              </Panel>
            </div>
          ) : (
            <Panel>
              <div className="py-12 text-center space-y-3">
                <p className="font-display text-gold text-xl tracking-wide">No Career Archives Yet</p>
                <p className="font-mono text-cream-dim text-sm max-w-sm mx-auto">
                  Player stats are archived after each season ends. Complete a season and advance to the offseason to start building franchise history.
                </p>
                <div className="pt-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate('/franchise')}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {/* Current season active players */}
          {playerMeta.filter(p => p.seasons === 1 && playerStats[p.playerId]?.gamesPlayed > 0).length > 0 && (
            <Panel title="Current Season — Active Players">
              <p className="text-cream-dim/50 text-xs font-mono mb-3">
                These players have stats this season but no archive yet. Select one to view.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                {playerMeta
                  .filter(p => p.seasons === 1 && playerStats[p.playerId]?.gamesPlayed > 0)
                  .slice(0, 24)
                  .map(p => (
                    <button
                      key={p.playerId}
                      onClick={() => setSearchParams({ player: p.playerId })}
                      className="flex items-center gap-2 px-2 py-1.5 bg-navy-light/50 hover:bg-gold/10 border border-navy-lighter/30 rounded transition-colors text-left group"
                    >
                      <span className="font-mono text-xs text-cream-dim/40">{p.position}</span>
                      <span className="font-mono text-xs text-cream group-hover:text-gold truncate transition-colors">{p.playerName}</span>
                    </button>
                  ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
