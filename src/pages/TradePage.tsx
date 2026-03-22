import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useGMStore } from '@/stores/gmStore.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';

function OVR({ v }: { v: number }) {
  const color = v >= 75 ? 'text-gold' : v >= 60 ? 'text-green-light' : v >= 45 ? 'text-cream' : 'text-red';
  return <span className={cn('font-mono text-xs font-bold', color)}>{v}</span>;
}

function PlayerCard({
  player,
  selected,
  onClick,
  dimmed,
  salary,
  contractYrs,
}: {
  player: Player;
  selected: boolean;
  onClick: () => void;
  dimmed?: boolean;
  salary?: string;
  contractYrs?: string;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md border transition-all cursor-pointer',
        dimmed && 'opacity-40',
        selected
          ? 'bg-gold/15 border-gold/50'
          : 'bg-navy-lighter/20 border-navy-lighter hover:border-navy-lighter/80 hover:bg-navy-lighter/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-cream text-sm font-body truncate">{getPlayerName(player)}</p>
          <p className="font-mono text-xs text-cream-dim">{player.position} · Age {player.age}</p>
          {salary && (
            <p className="font-mono text-[10px] text-gold/70 mt-0.5">
              {salary}{contractYrs ? ` · ${contractYrs}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selected && <span className="text-gold text-xs">✓</span>}
          <OVR v={ovr} />
        </div>
      </div>
    </button>
  );
}

function FairnessMeter({ score }: { score: number }) {
  // score: positive = AI gives more (user wins), negative = user gives more (AI wins)
  const clamped = Math.max(-50, Math.min(50, score));
  const pct = ((clamped + 50) / 100) * 100; // 0-100, 50 = even
  const label =
    score > 10 ? 'Heavily favors you' :
    score > 3 ? 'Slightly favors you' :
    score >= -3 ? 'Even trade' :
    score >= -10 ? 'Slightly favors them' :
    'Heavily favors them';
  const barColor =
    score > 5 ? 'bg-green-light' :
    score < -5 ? 'bg-red' :
    'bg-gold';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-mono text-cream-dim">
        <span>Their favor</span>
        <span className={cn('font-bold', score > 3 ? 'text-green-light' : score < -3 ? 'text-red' : 'text-gold')}>
          {label}
        </span>
        <span>Your favor</span>
      </div>
      <div className="relative h-3 bg-navy-lighter rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-cream-dim/30" />
        <div
          className={cn('absolute inset-y-0 rounded-full transition-all', barColor)}
          style={{
            left: pct >= 50 ? '50%' : `${pct}%`,
            right: pct < 50 ? '50%' : `${100 - pct}%`,
          }}
        />
      </div>
      <p className="text-xs font-mono text-center text-cream-dim">
        Value differential: <span className={cn(score > 0 ? 'text-green-light' : score < 0 ? 'text-red' : 'text-gold', 'font-bold')}>
          {score > 0 ? '+' : ''}{score}
        </span>
      </p>
    </div>
  );
}

export function TradePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { engine, userTeamId, teams, movePlayer, addUserTradeLog, isTradeDeadlinePassed } = useFranchiseStore();
  const { evaluateTradePackages, checkAIAccepts } = useGMStore();

  // Get user team
  const userTeam = useMemo(
    () => teams.find(t => t.id === userTeamId) ?? engine?.getTeam(userTeamId ?? '') ?? null,
    [teams, userTeamId, engine]
  );

  // Other teams list
  const otherTeams = useMemo(
    () => teams.filter(t => t.id !== userTeamId),
    [teams, userTeamId]
  );

  const [partnerId, setPartnerId] = useState<string>(otherTeams[0]?.id ?? '');
  const [userBlock, setUserBlock] = useState<string[]>([]);   // user's players being offered
  const [theirBlock, setTheirBlock] = useState<string[]>([]);  // partner's players being requested
  const [evaluated, setEvaluated] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const partnerTeam = useMemo(
    () => teams.find(t => t.id === partnerId) ?? engine?.getTeam(partnerId) ?? null,
    [teams, partnerId, engine]
  );

  // Pre-select target player from URL
  // If the player is on the user's team → add to userBlock (they're offering them)
  // If on partner's team → add to theirBlock (they want to acquire them)
  useEffect(() => {
    const tp = searchParams.get('targetPlayer');
    if (!tp) return;
    if (userTeam?.roster.players.some(p => p.id === tp)) {
      setUserBlock([tp]);
    } else if (partnerTeam?.roster.players.some(p => p.id === tp)) {
      setTheirBlock([tp]);
    } else {
      // Player is on a different team — find it and switch partner
      const ownerTeam = otherTeams.find(t => t.roster.players.some(p => p.id === tp));
      if (ownerTeam) {
        setPartnerId(ownerTeam.id);
        // theirBlock will be set once partnerTeam updates
        setTheirBlock([tp]);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!userTeam || otherTeams.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Trade Center</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Negotiate trades with all 29 other teams. Propose deals, counter-offer, and build your roster.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const toggleUserPlayer = (id: string) =>
    setUserBlock(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);

  const toggleTheirPlayer = (id: string) =>
    setTheirBlock(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);

  const handleEvaluate = () => {
    if (!partnerTeam) return;
    const offering: import('@/engine/gm/TradeEngine.ts').TradePackage = { teamId: userTeam.id, playerIds: userBlock };
    const receiving: import('@/engine/gm/TradeEngine.ts').TradePackage = { teamId: partnerTeam.id, playerIds: theirBlock };
    const allT = teams.length > 0 ? teams : [userTeam, partnerTeam];
    const score = evaluateTradePackages(offering, receiving, allT);
    setEvaluated(score);
    setResult(null);
  };

  const deadlinePassed = isTradeDeadlinePassed();

  const handlePropose = () => {
    if (!partnerTeam || userBlock.length === 0 || theirBlock.length === 0) return;
    if (deadlinePassed) {
      setResult('Trade deadline has passed. No trades allowed until next season.');
      return;
    }
    // offering = what AI receives (user's players going to AI)
    // receiving = what AI gives up (AI's players going to user)
    const offering: import('@/engine/gm/TradeEngine.ts').TradePackage = { teamId: userTeam.id, playerIds: userBlock };
    const receiving: import('@/engine/gm/TradeEngine.ts').TradePackage = { teamId: partnerTeam.id, playerIds: theirBlock };
    const allT = teams.length > 0 ? teams : [userTeam, partnerTeam];
    // Always evaluate so the fairness meter updates
    const score = evaluateTradePackages(offering, receiving, allT);
    setEvaluated(score);
    const accepts = checkAIAccepts(partnerTeam, offering, receiving, allT);

    if (accepts) {
      for (const pid of userBlock) movePlayer(pid, userTeam.id, partnerTeam.id);
      for (const pid of theirBlock) movePlayer(pid, partnerTeam.id, userTeam.id);
      addUserTradeLog(`Traded ${userBlock.length}P to ${partnerTeam.city} ${partnerTeam.name}, received ${theirBlock.length}P`);
      setUserBlock([]);
      setTheirBlock([]);
      setEvaluated(null);
      setResult('Trade accepted! Rosters updated.');
    } else {
      const hint = score < -10 ? ' (Offer heavily favors you — they need more value.)' :
                   score < -3  ? ' (Offer slightly favors you — try adding depth.)' :
                   score > 10  ? ' (This heavily favors them — you can negotiate harder.)' :
                   ' (Values are close — the AI may have other reasons for declining.)';
      setResult(`Trade rejected. The AI team declined your offer.${hint}`);
    }
  };

  const userValue = userBlock.reduce((s, id) => {
    const p = userTeam.roster.players.find(pl => pl.id === id);
    return s + (p ? Math.round(evaluatePlayer(p)) : 0);
  }, 0);

  const theirValue = theirBlock.reduce((s, id) => {
    const p = partnerTeam?.roster.players.find(pl => pl.id === id);
    return s + (p ? Math.round(evaluatePlayer(p)) : 0);
  }, 0);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Trade Center</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">Select players from each team to build a trade</p>
      </div>

      {/* Trade Deadline Banner */}
      {deadlinePassed && (
        <div className="mb-4 px-4 py-3 rounded-md bg-red-900/30 border border-red/50 font-mono text-sm text-red flex items-center gap-2">
          <span>⚠</span>
          <span>The trade deadline has passed. No trades can be made until next season.</span>
        </div>
      )}

      {/* Team Selector */}
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-cream-dim text-sm">Trade partner:</span>
        <select
          value={partnerId}
          onChange={e => { setPartnerId(e.target.value); setTheirBlock([]); setEvaluated(null); setResult(null); }}
          className="bg-navy-light border border-navy-lighter rounded-md px-3 py-1.5 font-mono text-sm text-cream focus:outline-none focus:border-gold/50 appearance-none cursor-pointer pr-8"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23d4a843' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          {otherTeams.map(t => (
            <option key={t.id} value={t.id} style={{ background: '#0f1829', color: '#e8e0d4' }}>
              {t.city} {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Two-panel trade interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Your team */}
        <Panel title={`${userTeam.city} ${userTeam.name} (You)`}>
          <p className="font-mono text-xs text-cream-dim mb-3">Click players to add to trade block</p>
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {userTeam.roster.players.map(p => {
              const c = engine?.contractEngine.getContract(p.id);
              return (
                <PlayerCard
                  key={p.id}
                  player={p}
                  selected={userBlock.includes(p.id)}
                  onClick={() => toggleUserPlayer(p.id)}
                  salary={c ? `$${(c.salaryPerYear / 1000).toFixed(1)}M/yr` : undefined}
                  contractYrs={c && !c.isFreeAgent ? `${c.yearsRemaining}yr` : c?.isFreeAgent ? 'FA' : undefined}
                />
              );
            })}
          </div>
          {userBlock.length > 0 && (
            <div className="mt-3 pt-3 border-t border-navy-lighter">
              <p className="font-mono text-xs text-cream-dim">Offering:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {userBlock.map(id => {
                  const p = userTeam.roster.players.find(pl => pl.id === id);
                  return p ? (
                    <span key={id} className="bg-gold/20 border border-gold/30 text-gold text-xs font-mono px-2 py-0.5 rounded">
                      {p.lastName}
                    </span>
                  ) : null;
                })}
              </div>
              <p className="font-mono text-xs text-cream-dim mt-1">
                Total value: <span className="text-gold font-bold">{userValue}</span>
              </p>
            </div>
          )}
        </Panel>

        {/* Partner team */}
        <Panel title={partnerTeam ? `${partnerTeam.city} ${partnerTeam.name}` : 'Select Partner'}>
          <p className="font-mono text-xs text-cream-dim mb-3">Click players to request in trade</p>
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {partnerTeam?.roster.players.map(p => {
              const c = engine?.contractEngine.getContract(p.id);
              return (
                <PlayerCard
                  key={p.id}
                  player={p}
                  selected={theirBlock.includes(p.id)}
                  onClick={() => toggleTheirPlayer(p.id)}
                  salary={c ? `$${(c.salaryPerYear / 1000).toFixed(1)}M/yr` : undefined}
                  contractYrs={c && !c.isFreeAgent ? `${c.yearsRemaining}yr` : c?.isFreeAgent ? 'FA' : undefined}
                />
              );
            })}
          </div>
          {theirBlock.length > 0 && (
            <div className="mt-3 pt-3 border-t border-navy-lighter">
              <p className="font-mono text-xs text-cream-dim">Requesting:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {theirBlock.map(id => {
                  const p = partnerTeam?.roster.players.find(pl => pl.id === id);
                  return p ? (
                    <span key={id} className="bg-gold/20 border border-gold/30 text-gold text-xs font-mono px-2 py-0.5 rounded">
                      {p.lastName}
                    </span>
                  ) : null;
                })}
              </div>
              <p className="font-mono text-xs text-cream-dim mt-1">
                Total value: <span className="text-gold font-bold">{theirValue}</span>
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* Evaluation Panel */}
      <Panel title="Trade Evaluation">
        <div className="space-y-4">
          {evaluated !== null && (
            <FairnessMeter score={evaluated} />
          )}

          {result && (
            <div className={cn(
              'px-4 py-3 rounded-md font-mono text-sm border',
              result.includes('accepted')
                ? 'bg-green-900/30 border-green-light/30 text-green-light'
                : 'bg-red-900/30 border-red-500/30 text-red-400',
            )}>
              {result}
            </div>
          )}

          {(userBlock.length > 0 || theirBlock.length > 0) && (userBlock.length === 0 || theirBlock.length === 0) && (
            <p className="font-mono text-xs text-gold/70 bg-gold/5 border border-gold/20 rounded-md px-3 py-2">
              {userBlock.length === 0
                ? '← Select players from your team to offer in the trade'
                : '→ Select players from the other team to request in the trade'}
            </p>
          )}

          {/* Selection summary */}
          {(userBlock.length > 0 || theirBlock.length > 0) && (
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className={userBlock.length > 0 ? 'text-green-light' : 'text-cream-dim/40'}>
                You send: {userBlock.length} player{userBlock.length !== 1 ? 's' : ''}
              </span>
              <span className="text-cream-dim/30">⇄</span>
              <span className={theirBlock.length > 0 ? 'text-green-light' : 'text-cream-dim/40'}>
                You get: {theirBlock.length} player{theirBlock.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleEvaluate}
              disabled={userBlock.length === 0 || theirBlock.length === 0}
            >
              Evaluate Trade
            </Button>
            <Button
              onClick={handlePropose}
              disabled={userBlock.length === 0 || theirBlock.length === 0 || deadlinePassed}
            >
              Propose Trade
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setUserBlock([]); setTheirBlock([]); setEvaluated(null); setResult(null); }}
            >
              Clear
            </Button>
          </div>
          {userBlock.length === 0 && theirBlock.length === 0 && (
            <p className="font-mono text-xs text-gold/60">
              ← Select players from both panels above to begin building a trade
            </p>
          )}
          {deadlinePassed && (
            <p className="font-mono text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-md px-3 py-2">
              The trade deadline has passed. No trades can be made until next season.
            </p>
          )}
          <p className="font-mono text-xs text-cream-dim">
            * AI will accept if the trade is reasonably fair for them. Heavily lopsided offers will be rejected.
          </p>
        </div>
      </Panel>
    </div>
  );
}
