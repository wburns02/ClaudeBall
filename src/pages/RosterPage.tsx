import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useGMStore } from '@/stores/gmStore.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { ReactElement } from 'react';

type SortKey = 'name' | 'pos' | 'age' | 'ovr' | 'rating';
type SortDir = 'asc' | 'desc';

function playerOvr(p: Player): number {
  return Math.round(evaluatePlayer(p));
}

function keyRating(p: Player): number {
  if (p.position === 'P') {
    return Math.round((p.pitching.stuff + p.pitching.movement + p.pitching.control) / 3);
  }
  return Math.round((p.batting.contact_R + p.batting.power_R + p.batting.eye) / 3);
}

function ratingBar(val: number, max = 100): ReactElement {
  const pct = Math.round((val / max) * 100);
  const color =
    val >= 75 ? 'bg-gold' :
    val >= 60 ? 'bg-green-light' :
    val >= 45 ? 'bg-cream-dim' :
    'bg-red';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-navy-lighter rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-cream">{val}</span>
    </div>
  );
}

export function RosterPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, teams } = useFranchiseStore();
  const { releasePlayer } = useGMStore();

  const [sortKey, setSortKey] = useState<SortKey>('ovr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);

  const userTeam = useMemo(
    () => teams.find(t => t.id === userTeamId) ?? engine?.getTeam(userTeamId ?? '') ?? null,
    [teams, userTeamId, engine]
  );

  if (!userTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-cream-dim">No franchise loaded.</p>
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...userTeam.roster.players].sort((a, b) => {
    let diff = 0;
    switch (sortKey) {
      case 'name': diff = getPlayerName(a).localeCompare(getPlayerName(b)); break;
      case 'pos': diff = a.position.localeCompare(b.position); break;
      case 'age': diff = a.age - b.age; break;
      case 'ovr': diff = playerOvr(a) - playerOvr(b); break;
      case 'rating': diff = keyRating(a) - keyRating(b); break;
    }
    return sortDir === 'asc' ? diff : -diff;
  });

  // Pitchers and position players split
  const pitchers = sorted.filter(p => p.position === 'P');
  const positionPlayers = sorted.filter(p => p.position !== 'P');

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className={cn(
        'text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer',
        sortKey === col ? 'text-gold' : 'text-gold-dim hover:text-gold',
      )}
    >
      {label} {sortKey === col ? (sortDir === 'desc' ? '▼' : '▲') : ''}
    </button>
  );

  const PlayerRow = ({ p }: { p: Player }) => {
    const ovr = playerOvr(p);
    const isPitcher = p.position === 'P';
    return (
      <tr className="border-b border-navy-lighter/50 hover:bg-navy-lighter/20 transition-colors">
        <td className="px-3 py-2 text-cream font-body text-sm">{getPlayerName(p)}</td>
        <td className="px-3 py-2 font-mono text-xs text-gold text-center">{p.position}</td>
        <td className="px-3 py-2 font-mono text-xs text-cream-dim text-center">{p.bats}/{p.throws}</td>
        <td className="px-3 py-2 font-mono text-xs text-cream-dim text-center">{p.age}</td>
        <td className="px-3 py-2">
          {ratingBar(ovr)}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-cream-dim text-center">
          {isPitcher
            ? `${p.pitching.stuff}/${p.pitching.movement}/${p.pitching.control}`
            : `${p.batting.contact_R}/${p.batting.power_R}/${p.batting.eye}`}
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/franchise/player/${p.id}`)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/franchise/trade?targetPlayer=${p.id}`)}
            >
              Trade
            </Button>
            {confirmRelease === p.id ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  className="!bg-red-500 !shadow-none text-white"
                  onClick={() => {
                    releasePlayer(userTeam, p.id);
                    setConfirmRelease(null);
                  }}
                >
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRelease(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmRelease(p.id)}
              >
                Release
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const tableHead = (
    <tr className="border-b border-navy-lighter">
      <th className="px-3 py-2 text-left"><SortHeader col="name" label="Name" /></th>
      <th className="px-3 py-2 text-center"><SortHeader col="pos" label="Pos" /></th>
      <th className="px-3 py-2 text-center text-gold-dim text-xs font-semibold uppercase tracking-wider">B/T</th>
      <th className="px-3 py-2 text-center"><SortHeader col="age" label="Age" /></th>
      <th className="px-3 py-2 text-left"><SortHeader col="ovr" label="OVR" /></th>
      <th className="px-3 py-2 text-center text-gold-dim text-xs font-semibold uppercase tracking-wider">
        {/* dynamic header */}Key
      </th>
      <th className="px-3 py-2 text-left text-gold-dim text-xs font-semibold uppercase tracking-wider">Actions</th>
    </tr>
  );

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
            {userTeam.city} {userTeam.name} — Roster
          </h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {userTeam.roster.players.length} players on roster
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/create-player')}>
            + Create Player
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/roster-manager')}>
            Roster Manager
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/free-agency')}>
            Free Agency
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/trade')}>
            Trade Center
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>
            Dashboard
          </Button>
        </div>
      </div>

      {/* Position Players */}
      <Panel title={`Position Players (${positionPlayers.length})`} className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>{tableHead}</thead>
            <tbody>
              {positionPlayers.map(p => <PlayerRow key={p.id} p={p} />)}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Pitchers */}
      <Panel title={`Pitching Staff (${pitchers.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>{tableHead}</thead>
            <tbody>
              {pitchers.map(p => <PlayerRow key={p.id} p={p} />)}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
