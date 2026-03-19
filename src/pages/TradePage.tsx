import { useState, useMemo } from 'react';
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
  const { engine, userTeamId, teams } = useFranchiseStore();
  const { evaluateTradePackages, checkAIAccepts, executeTrade } = useGMStore();

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
  useMemo(() => {
    const tp = searchParams.get('targetPlayer');
    if (tp && partnerTeam?.roster.players.some(p => p.id === tp)) {
      setTheirBlock([tp]);
    }
  }, [searchParams, partnerTeam]);

  if (!userTeam || otherTeams.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-cream-dim">No franchise loaded.</p>
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

  const handlePropose = () => {
    if (!partnerTeam || userBlock.length === 0 || theirBlock.length === 0) return;
    const offering: import('@/engine/gm/TradeEngine.ts').TradePackage = { teamId: partnerTeam.id, playerIds: theirBlock };
    const receiving: import('@/engine/gm/TradeEngine.ts').TradePackage = { teamId: userTeam.id, playerIds: userBlock };
    const allT = teams.length > 0 ? teams : [userTeam, partnerTeam];
    const accepts = checkAIAccepts(partnerTeam, offering, receiving, allT);

    if (accepts) {
      executeTrade(userTeam, partnerTeam, userBlock, theirBlock);
      setUserBlock([]);
      setTheirBlock([]);
      setEvaluated(null);
      setResult('Trade accepted! Rosters updated.');
    } else {
      setResult('Trade rejected. The AI team declined your offer.');
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

      {/* Team Selector */}
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-cream-dim text-sm">Trade partner:</span>
        <select
          value={partnerId}
          onChange={e => { setPartnerId(e.target.value); setTheirBlock([]); setEvaluated(null); setResult(null); }}
          className="bg-navy-light border border-navy-lighter rounded-md px-3 py-1.5 font-mono text-sm text-cream focus:outline-none focus:border-gold/50"
        >
          {otherTeams.map(t => (
            <option key={t.id} value={t.id}>{t.city} {t.name}</option>
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
              disabled={userBlock.length === 0 || theirBlock.length === 0}
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
          <p className="font-mono text-xs text-cream-dim">
            * AI will accept if the trade is reasonably fair for them. Heavily lopsided offers will be rejected.
          </p>
        </div>
      </Panel>
    </div>
  );
}
