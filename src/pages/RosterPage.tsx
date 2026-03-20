import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { addToast } from '@/stores/toastStore.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { estimateMarketSalary, estimateDesiredYears } from '@/engine/gm/ContractEngine.ts';
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

// ─── Contract Extension Dialog ────────────────────────────────────────────────

function ExtensionDialog({
  player,
  currentContract,
  onSign,
  onClose,
}: {
  player: Player;
  currentContract: { yearsRemaining: number; salaryPerYear: number } | null;
  onSign: (years: number, salary: number) => void;
  onClose: () => void;
}) {
  const marketSalary = estimateMarketSalary(player);
  const desiredYears = estimateDesiredYears(player);
  const ovr = Math.round(evaluatePlayer(player));

  const [offerYears, setOfferYears] = useState(Math.min(desiredYears, 4));
  const [offerSalary, setOfferSalary] = useState(Math.round(marketSalary * 1.05 / 100) * 100);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const minAcceptable = Math.round(marketSalary * 0.80 / 100) * 100;
  const maxYears = desiredYears + 1;

  const salaryOk = offerSalary >= minAcceptable;
  const yearsOk = offerYears <= maxYears && offerYears >= 1;
  const willAccept = salaryOk && yearsOk;

  const handleSubmit = () => {
    if (!willAccept) {
      const reasons: string[] = [];
      if (!salaryOk) reasons.push(`needs at least $${(minAcceptable / 1000).toFixed(1)}M/yr`);
      if (!yearsOk) reasons.push(`only wants up to ${maxYears} years`);
      setResult({ ok: false, msg: `${getPlayerName(player)} rejected: ${reasons.join(', ')}.` });
      return;
    }
    onSign(offerYears, offerSalary);
  };

  const ovrColor = ovr >= 70 ? 'text-gold' : ovr >= 55 ? 'text-green-light' : 'text-cream';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-navy-light border border-navy-lighter rounded-xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-xl text-gold tracking-wide">{getPlayerName(player)}</h2>
            <p className="font-mono text-sm text-cream-dim mt-0.5">
              {player.position} · Age {player.age} · <span className={ovrColor}>{ovr} OVR</span>
            </p>
          </div>
          <button onClick={onClose} className="text-cream-dim/50 hover:text-cream-dim font-mono text-xl leading-none">✕</button>
        </div>

        {/* Current contract info */}
        {currentContract && (
          <div className="bg-navy-lighter/20 rounded-lg p-3 mb-4 font-mono text-xs">
            <p className="text-cream-dim/50 uppercase tracking-wider mb-1">Current Contract</p>
            <p className="text-cream">
              ${(currentContract.salaryPerYear / 1000).toFixed(1)}M/yr ·{' '}
              <span className={currentContract.yearsRemaining <= 1 ? 'text-red-400' : 'text-cream-dim'}>
                {currentContract.yearsRemaining} yr{currentContract.yearsRemaining !== 1 ? 's' : ''} remaining
              </span>
            </p>
          </div>
        )}

        {/* Market context */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-navy-lighter/15 rounded-lg p-3 text-center">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">Market Value</p>
            <p className="font-mono text-base font-bold text-gold">${(marketSalary / 1000).toFixed(1)}M</p>
            <p className="font-mono text-[9px] text-cream-dim/40">per year</p>
          </div>
          <div className="bg-navy-lighter/15 rounded-lg p-3 text-center">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase mb-1">Wants</p>
            <p className="font-mono text-base font-bold text-cream">{desiredYears} yrs</p>
            <p className="font-mono text-[9px] text-cream-dim/40">max {maxYears}</p>
          </div>
        </div>

        {/* Offer inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="font-mono text-xs text-cream-dim/60 block mb-1.5">Years</label>
            <input
              type="number"
              min={1}
              max={7}
              value={offerYears}
              onChange={e => { setOfferYears(Number(e.target.value)); setResult(null); }}
              className={cn(
                'w-full bg-navy-lighter border rounded px-3 py-1.5 font-mono text-sm text-cream focus:outline-none transition-colors',
                yearsOk ? 'border-navy-lighter/60 focus:border-gold/50' : 'border-red-400/40 focus:border-red-400/60',
              )}
            />
            {!yearsOk && (
              <p className="font-mono text-[9px] text-red-400/70 mt-0.5">Max {maxYears} years</p>
            )}
          </div>
          <div>
            <label className="font-mono text-xs text-cream-dim/60 block mb-1.5">$/yr (thousands)</label>
            <input
              type="number"
              min={500}
              step={250}
              value={offerSalary}
              onChange={e => { setOfferSalary(Number(e.target.value)); setResult(null); }}
              className={cn(
                'w-full bg-navy-lighter border rounded px-3 py-1.5 font-mono text-sm text-cream focus:outline-none transition-colors',
                salaryOk ? 'border-navy-lighter/60 focus:border-gold/50' : 'border-red-400/40 focus:border-red-400/60',
              )}
            />
            {!salaryOk && (
              <p className="font-mono text-[9px] text-red-400/70 mt-0.5">Min ${(minAcceptable / 1000).toFixed(1)}M</p>
            )}
          </div>
        </div>

        {/* Acceptance preview */}
        <div className={cn(
          'rounded-lg px-4 py-2.5 mb-4 font-mono text-sm text-center border transition-colors',
          willAccept
            ? 'bg-green-900/15 border-green-light/20 text-green-light'
            : 'bg-red-900/15 border-red-400/20 text-red-400',
        )}>
          {willAccept
            ? `✓ ${getPlayerName(player)} would accept this offer`
            : `✗ Offer below expectations`}
        </div>

        {/* Result message */}
        {result && (
          <div className={cn(
            'rounded-md px-3 py-2 mb-4 font-mono text-xs border',
            result.ok ? 'bg-green-900/20 border-green-light/30 text-green-light' : 'bg-red-900/20 border-red-400/30 text-red-400',
          )}>
            {result.msg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSubmit} disabled={!willAccept}>
            Sign Extension — {offerYears}yr / ${(offerSalary / 1000).toFixed(1)}M
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function RosterPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, teams, getPlayerContract, releasePlayerToWaivers, signExtension, ilRoster, getTeamInjuries, season, sendDownPlayer } = useFranchiseStore();

  const [sortKey, setSortKey] = useState<SortKey>('ovr');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [confirmSendDown, setConfirmSendDown] = useState<string | null>(null);
  const [extendingPlayer, setExtendingPlayer] = useState<Player | null>(null);

  const userTeam = useMemo(
    () => teams.find(t => t.id === userTeamId) ?? engine?.getTeam(userTeamId ?? '') ?? null,
    [teams, userTeamId, engine]
  );

  if (!userTeam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Team Roster</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">View and manage your full 26-man roster with player stats, contracts, and positions.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
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
    <span className={cn(
      'text-xs uppercase tracking-wider font-semibold transition-colors select-none',
      sortKey === col ? 'text-gold' : 'text-gold-dim',
    )}>
      {label} {sortKey === col ? (sortDir === 'desc' ? '▼' : '▲') : <span className="text-gold-dim/30">↕</span>}
    </span>
  );

  const PlayerRow = ({ p }: { p: Player }) => {
    const ovr = playerOvr(p);
    const isPitcher = p.position === 'P';
    const contract = getPlayerContract(p.id);
    const salary = contract ? `$${(contract.salaryPerYear / 1000).toFixed(1)}M` : '—';
    const contractYrs = contract && !contract.isFreeAgent ? `${contract.yearsRemaining}yr` : 'FA';
    const onIL = ilRoster.some(s => s.playerId === p.id);
    const activeInjury = getTeamInjuries(userTeamId ?? '').find(r => r.playerId === p.id && !r.returned);
    const daysRemaining = activeInjury ? Math.max(0, activeInjury.injuredUntilDay - (season?.currentDay ?? 0)) : 0;
    return (
      <tr
        className={cn(
          'group border-b border-navy-lighter/50 hover:bg-navy-lighter/20 transition-colors cursor-pointer',
          onIL && 'opacity-75',
        )}
        onClick={() => navigate(`/franchise/player-stats/${p.id}`)}
      >
        <td className="px-3 py-2 font-body text-sm">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'group-hover:text-gold group-hover:underline underline-offset-2 transition-colors',
              onIL ? 'text-cream-dim' : 'text-cream',
            )}>{getPlayerName(p)}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-gold/50 text-xs shrink-0">→</span>
            {onIL && (
              <span className="font-mono text-[9px] font-bold uppercase text-red-400 border border-red-500/30 bg-red-950/20 px-1 py-0.5 rounded shrink-0">IL</span>
            )}
            {activeInjury && !onIL && (
              <span className="font-mono text-[9px] text-orange-400/80 border border-orange-500/20 bg-orange-950/20 px-1 py-0.5 rounded shrink-0">{daysRemaining}d</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-gold text-center">{p.position}</td>
        <td className="hidden sm:table-cell px-3 py-2 font-mono text-xs text-cream-dim text-center">{p.bats}/{p.throws}</td>
        <td className="px-3 py-2 font-mono text-xs text-cream-dim text-center">{p.age}</td>
        <td className="px-3 py-2">
          {ratingBar(ovr)}
        </td>
        <td className="hidden sm:table-cell px-3 py-2 font-mono text-xs text-cream-dim text-center">
          {isPitcher
            ? `${p.pitching.stuff}/${p.pitching.movement}/${p.pitching.control}`
            : `${p.batting.contact_R}/${p.batting.power_R}/${p.batting.eye}`}
        </td>
        <td className="hidden sm:table-cell px-3 py-2 font-mono text-xs text-center">
          <span className="text-gold">{salary}</span>
          <span className="text-cream-dim/50 ml-1">{contractYrs}</span>
        </td>
        <td className="hidden sm:table-cell px-3 py-2" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1 flex-wrap">
            {/* Extend button — shown for players in their last year */}
            {contract && contract.yearsRemaining <= 1 && !contract.isFreeAgent && (
              <Button
                size="sm"
                variant="primary"
                className="!bg-blue-900/40 !border-blue-400/40 !text-blue-300 hover:!bg-blue-800/50"
                onClick={() => setExtendingPlayer(p)}
                title="Negotiate contract extension"
              >
                Extend
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/franchise/compare?p1=${p.id}`)}
              title="Compare this player"
            >
              Cmp
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/franchise/trade?targetPlayer=${p.id}`)}
            >
              Trade
            </Button>
            {/* Option to AAA */}
            {confirmSendDown === p.id ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  className="!bg-blue-800/60 !border-blue-400/40 !text-blue-200 hover:!bg-blue-700/60"
                  onClick={() => {
                    if (userTeamId) sendDownPlayer(userTeamId, p.id);
                    addToast(`${getPlayerName(p)} optioned to AAA`, 'success');
                    setConfirmSendDown(null);
                  }}
                >
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmSendDown(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="!text-blue-400/70 hover:!text-blue-300"
                onClick={() => setConfirmSendDown(p.id)}
                title="Option this player to AAA"
              >
                AAA
              </Button>
            )}
            {confirmRelease === p.id ? (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  className="!bg-red-500 !shadow-none text-white"
                  onClick={() => {
                    releasePlayerToWaivers(userTeamId!, p.id);
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
      <th className="px-3 py-2 text-left cursor-pointer hover:bg-navy-lighter/20 transition-colors" onClick={() => handleSort('name')}><SortHeader col="name" label="Name" /></th>
      <th className="px-3 py-2 text-center cursor-pointer hover:bg-navy-lighter/20 transition-colors" onClick={() => handleSort('pos')}><SortHeader col="pos" label="Pos" /></th>
      <th className="hidden sm:table-cell px-3 py-2 text-center text-gold-dim text-xs font-semibold uppercase tracking-wider">B/T</th>
      <th className="px-3 py-2 text-center cursor-pointer hover:bg-navy-lighter/20 transition-colors" onClick={() => handleSort('age')}><SortHeader col="age" label="Age" /></th>
      <th className="px-3 py-2 text-left cursor-pointer hover:bg-navy-lighter/20 transition-colors" onClick={() => handleSort('ovr')}><SortHeader col="ovr" label="OVR" /></th>
      <th className="hidden sm:table-cell px-3 py-2 text-center text-gold-dim text-xs font-semibold uppercase tracking-wider" title="Key ratings: Contact/Power/Eye for batters · Stuff/Move/Ctrl for pitchers">Key Stats</th>
      <th className="hidden sm:table-cell px-3 py-2 text-center text-gold-dim text-xs font-semibold uppercase tracking-wider">Salary</th>
      <th className="hidden sm:table-cell px-3 py-2 text-left text-gold-dim text-xs font-semibold uppercase tracking-wider">Actions</th>
    </tr>
  );

  // Players in last year of contract
  const expiringPlayers = useMemo(() => {
    return userTeam.roster.players.filter(p => {
      const c = getPlayerContract(p.id);
      return c && c.yearsRemaining <= 1 && !c.isFreeAgent;
    });
  }, [userTeam.roster.players, getPlayerContract]);

  const handleExtension = (years: number, salary: number) => {
    if (!extendingPlayer || !userTeamId) return;
    const result = signExtension(extendingPlayer.id, userTeamId, years, salary);
    const name = getPlayerName(extendingPlayer);
    if (result.success) {
      addToast(`✓ ${name} extended: ${years}yr / $${(salary / 1000).toFixed(1)}M`, 'success');
      setExtendingPlayer(null);
    } else {
      addToast(`✗ ${result.reason ?? 'Extension rejected'}`, 'error');
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Extension dialog */}
      {extendingPlayer && (
        <ExtensionDialog
          player={extendingPlayer}
          currentContract={getPlayerContract(extendingPlayer.id) ?? null}
          onSign={handleExtension}
          onClose={() => setExtendingPlayer(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">
          {userTeam.city} {userTeam.name} — Roster
        </h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {userTeam.roster.players.length} players on roster
        </p>
      </div>

      {/* Expiring contracts alert */}
      {expiringPlayers.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-gold/30 bg-gold/5 flex items-start gap-3">
          <span className="text-gold text-lg shrink-0">⚠</span>
          <div>
            <p className="font-mono text-sm text-gold font-bold">
              {expiringPlayers.length} expiring contract{expiringPlayers.length !== 1 ? 's' : ''} this season
            </p>
            <p className="font-mono text-xs text-cream-dim/70 mt-0.5">
              {expiringPlayers.map(p => getPlayerName(p)).join(', ')} — click <span className="text-blue-300">Extend</span> to negotiate
            </p>
          </div>
        </div>
      )}

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
