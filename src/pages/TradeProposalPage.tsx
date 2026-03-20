import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import type { StoredTradeProposal } from '@/stores/franchiseStore.ts';
import { evaluatePlayer, generateTradeOffer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';

// Alias for local use
type IncomingProposal = StoredTradeProposal;

function OVR({ v }: { v: number }) {
  const color = v >= 75 ? 'text-gold' : v >= 60 ? 'text-green-light' : v >= 45 ? 'text-cream' : 'text-red';
  return <span className={cn('font-mono text-sm font-bold', color)}>{v}</span>;
}

function PlayerPill({
  player,
  teamAbbr,
  highlight,
}: {
  player: Player;
  teamAbbr?: string;
  highlight?: 'give' | 'get';
}) {
  const ovr = Math.round(evaluatePlayer(player));
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-md border',
      highlight === 'give' && 'bg-red-900/20 border-red-500/30',
      highlight === 'get' && 'bg-green-900/20 border-green-light/30',
      !highlight && 'bg-navy-lighter/20 border-navy-lighter',
    )}>
      <div className="min-w-0 flex-1">
        <p className="font-body text-cream text-sm truncate">{getPlayerName(player)}</p>
        <p className="font-mono text-xs text-cream-dim">{player.position} · Age {player.age}{teamAbbr ? ` · ${teamAbbr}` : ''}</p>
      </div>
      <OVR v={ovr} />
    </div>
  );
}

function generateProposalId(): string {
  return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TradeProposalPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId, teams, movePlayer, addUserTradeLog, tradeProposals, setTradeProposals } = useFranchiseStore();

  // proposals now lives in the store so it persists across navigation
  const proposals = tradeProposals;
  const setProposals = setTradeProposals;
  const [counterTarget, setCounterTarget] = useState<string | null>(null); // proposal id
  const [counterOfferIds, setCounterOfferIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ proposalId: string; msg: string; ok: boolean } | null>(null);
  const [confirmAcceptId, setConfirmAcceptId] = useState<string | null>(null);

  const userTeam = useMemo(
    () => teams.find(t => t.id === userTeamId) ?? engine?.getTeam(userTeamId ?? '') ?? null,
    [teams, userTeamId, engine]
  );

  // Generate AI proposals on mount / when day changes
  useEffect(() => {
    if (!engine || !season || !userTeamId || !userTeam) return;

    const rng = engine.getRng();
    const allTeams = engine.getAllTeams();
    const otherTeams = allTeams.filter(t => t.id !== userTeamId);

    // Generate 2-3 proposals if we have fewer than 3 pending
    const pendingCount = proposals.filter(p => p.status === 'pending').length;
    if (pendingCount >= 3) return;

    const newProposals: IncomingProposal[] = [];
    const toGenerate = 3 - pendingCount;

    for (let i = 0; i < toGenerate && otherTeams.length > 0; i++) {
      const aiTeam = rng.pick(otherTeams);
      if (!aiTeam) continue;

      // AI targets a player on user's team
      const userPlayers = userTeam.roster.players;
      if (userPlayers.length === 0) continue;

      // Target a mid-value player (AI isn't too greedy — targets 45-75 OVR)
      const targets = userPlayers
        .map(p => ({ p, v: evaluatePlayer(p) }))
        .filter(({ v }) => v >= 35 && v <= 80)
        .sort((a, b) => b.v - a.v);

      if (targets.length === 0) continue;

      // Pick a target somewhat randomly (not always the best)
      const targetIdx = Math.floor(rng.next() * Math.min(targets.length, 5));
      const target = targets[targetIdx];
      if (!target) continue;

      const proposal = generateTradeOffer(aiTeam, target.p.id, userTeam);
      if (!proposal) continue;

      // Only show proposals where AI isn't totally ripping off user (fairness >= -20)
      if (proposal.fairnessScore < -20) continue;

      const aiTeamFull = engine.getTeam(aiTeam.id);
      newProposals.push({
        id: generateProposalId(),
        aiTeamId: aiTeam.id,
        aiTeamName: aiTeamFull ? `${aiTeamFull.city} ${aiTeamFull.name}` : aiTeam.id,
        proposal,
        day: season.currentDay,
        status: 'pending',
      });
    }

    if (newProposals.length > 0) {
      setProposals([...proposals, ...newProposals]);
    }
  }, [engine, season?.currentDay, userTeamId, userTeam, proposals.length, setProposals]);

  const handleAccept = (prop: IncomingProposal) => {
    if (!userTeam || !engine) return;
    const aiTeam = engine.getTeam(prop.aiTeamId);
    if (!aiTeam) return;

    // Execute trade: user gives prop.proposal.userOffering, gets prop.proposal.aiOffering
    for (const pid of prop.proposal.userOffering) {
      movePlayer(pid, userTeamId!, prop.aiTeamId);
    }
    for (const pid of prop.proposal.aiOffering) {
      movePlayer(pid, prop.aiTeamId, userTeamId!);
    }

    const giving = prop.proposal.userOffering
      .map(id => {
        const p = userTeam.roster.players.find(pl => pl.id === id);
        return p ? getPlayerName(p) : id;
      })
      .join(', ');
    const getting = prop.proposal.aiOffering
      .map(id => {
        const aiP = aiTeam.roster.players.find(pl => pl.id === id);
        return aiP ? getPlayerName(aiP) : id;
      })
      .join(', ');

    const desc = `Accepted trade with ${prop.aiTeamName}: gave ${giving}; received ${getting}`;
    addUserTradeLog(desc);

    setProposals(proposals.map(p => p.id === prop.id ? { ...p, status: 'accepted' as const } : p));
    setResult({ proposalId: prop.id, msg: 'Trade accepted! Rosters updated.', ok: true });
    setCounterTarget(null);
  };

  const handleReject = (propId: string) => {
    setProposals(proposals.map(p => p.id === propId ? { ...p, status: 'rejected' as const } : p));
    setResult({ proposalId: propId, msg: 'Trade rejected.', ok: false });
    setCounterTarget(null);
  };

  const handleCounter = (prop: IncomingProposal) => {
    setCounterTarget(prop.id);
    setCounterOfferIds([]);
    setResult(null);
  };

  const handleSubmitCounter = (prop: IncomingProposal) => {
    if (!engine || !userTeam || counterOfferIds.length === 0) return;
    const aiTeam = engine.getTeam(prop.aiTeamId);
    if (!aiTeam) return;

    // Evaluate counter: is AI getting enough value?
    const userGivingVal = counterOfferIds.reduce((s, id) => {
      const p = userTeam.roster.players.find(pl => pl.id === id);
      return s + (p ? evaluatePlayer(p) : 0);
    }, 0);
    const aiGivingVal = prop.proposal.aiOffering.reduce((s, id) => {
      const p = aiTeam.roster.players.find(pl => pl.id === id);
      return s + (p ? evaluatePlayer(p) : 0);
    }, 0);

    // AI accepts if they get within 8 OVR points of value they're offering
    const accepted = userGivingVal >= aiGivingVal - 8;

    if (accepted) {
      for (const pid of counterOfferIds) movePlayer(pid, userTeamId!, prop.aiTeamId);
      for (const pid of prop.proposal.aiOffering) movePlayer(pid, prop.aiTeamId, userTeamId!);

      const desc = `Counter-offer accepted with ${prop.aiTeamName}`;
      addUserTradeLog(desc);

      setProposals(proposals.map(p => p.id === prop.id ? { ...p, status: 'accepted' as const, counterOffering: counterOfferIds } : p));
      setResult({ proposalId: prop.id, msg: 'Counter-offer accepted! Trade complete.', ok: true });
    } else {
      setProposals(proposals.map(p => p.id === prop.id ? { ...p, status: 'rejected' as const } : p));
      setResult({ proposalId: prop.id, msg: 'Counter-offer rejected. The AI team walked away.', ok: false });
    }
    setCounterTarget(null);
    setCounterOfferIds([]);
  };

  const pendingProposals = proposals.filter(p => p.status === 'pending');
  const resolvedProposals = proposals.filter(p => p.status !== 'pending');

  if (!season || !engine || !userTeamId || !userTeam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Trade Proposals</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Review incoming trade offers from other teams and negotiate counter-proposals.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Trade Proposals</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          AI teams are interested in making deals with you
        </p>
      </div>

      {/* Trade Deadline Warning */}
      {season.tradeDeadlinePassed && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/40 bg-red-900/10 font-mono text-sm text-red-400">
          Trade deadline has passed — no new proposals will arrive.
        </div>
      )}

      {/* Pending */}
      {pendingProposals.length === 0 ? (
        <Panel className="mb-6">
          <p className="font-mono text-cream-dim text-sm text-center py-8">
            No pending trade proposals. Advance days to receive new offers.
          </p>
        </Panel>
      ) : (
        <div className="space-y-4 mb-6">
          {pendingProposals.map(prop => {
            const aiTeam = engine.getTeam(prop.aiTeamId);
            const isCountering = counterTarget === prop.id;

            // Players AI wants from user
            const wantedPlayers = prop.proposal.userOffering
              .map(id => userTeam.roster.players.find(p => p.id === id))
              .filter(Boolean) as Player[];

            // Players AI is offering
            const offeredPlayers = prop.proposal.aiOffering
              .map(id => aiTeam?.roster.players.find(p => p.id === id))
              .filter(Boolean) as Player[];

            const fairnessLabel =
              prop.proposal.fairnessScore > 5 ? 'Favors you'
              : prop.proposal.fairnessScore < -5 ? 'Favors AI'
              : 'Even trade';
            const fairnessColor =
              prop.proposal.fairnessScore > 5 ? 'text-green-light'
              : prop.proposal.fairnessScore < -5 ? 'text-red'
              : 'text-gold';

            const thisResult = result?.proposalId === prop.id ? result : null;

            return (
              <Panel key={prop.id}>
                {/* Proposal header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-display text-gold text-lg tracking-wide">
                      {prop.aiTeamName}
                    </p>
                    <p className="font-mono text-cream-dim text-xs">
                      Day {prop.day} · Fairness:{' '}
                      <span className={fairnessColor}>{fairnessLabel} ({prop.proposal.fairnessScore > 0 ? '+' : ''}{prop.proposal.fairnessScore})</span>
                    </p>
                  </div>
                </div>

                {/* Trade preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="font-mono text-xs text-red-400/80 uppercase tracking-widest mb-2">
                      You give
                    </p>
                    <div className="space-y-1">
                      {wantedPlayers.map(p => (
                        <PlayerPill key={p.id} player={p} highlight="give" />
                      ))}
                      {wantedPlayers.length === 0 && (
                        <p className="font-mono text-cream-dim text-sm">— (player no longer on roster)</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-green-light/80 uppercase tracking-widest mb-2">
                      You receive
                    </p>
                    <div className="space-y-1">
                      {offeredPlayers.map(p => (
                        <PlayerPill
                          key={p.id}
                          player={p}
                          teamAbbr={aiTeam?.abbreviation}
                          highlight="get"
                        />
                      ))}
                      {offeredPlayers.length === 0 && (
                        <p className="font-mono text-cream-dim text-sm">—</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Counter offer picker */}
                {isCountering && (
                  <div className="mt-4 pt-4 border-t border-navy-lighter">
                    <p className="font-mono text-sm text-cream-dim mb-2">
                      Select alternate players to offer in exchange for {offeredPlayers.map(p => p.lastName).join(', ')}:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-48 overflow-y-auto mb-3">
                      {userTeam.roster.players.map(p => {
                        const sel = counterOfferIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() =>
                              setCounterOfferIds(ids =>
                                sel ? ids.filter(x => x !== p.id) : [...ids, p.id]
                              )
                            }
                            className={cn(
                              'text-left px-2 py-1.5 rounded border text-xs font-mono transition-all cursor-pointer',
                              sel
                                ? 'bg-gold/15 border-gold/50 text-gold'
                                : 'bg-navy-lighter/20 border-navy-lighter text-cream-dim hover:text-cream',
                            )}
                          >
                            {getPlayerName(p)} ({p.position}, {Math.round(evaluatePlayer(p))})
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSubmitCounter(prop)}
                          disabled={counterOfferIds.length === 0}
                        >
                          Submit Counter
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setCounterTarget(null)}>
                          Cancel
                        </Button>
                      </div>
                      {counterOfferIds.length === 0 && (
                        <p className="font-mono text-xs text-cream-dim/50">Select at least one player to offer</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Result message */}
                {thisResult && (
                  <div className={cn(
                    'mt-3 px-3 py-2 rounded font-mono text-sm border',
                    thisResult.ok
                      ? 'bg-green-900/30 border-green-light/30 text-green-light'
                      : 'bg-red-900/30 border-red-500/30 text-red-400',
                  )}>
                    {thisResult.msg}
                  </div>
                )}

                {/* Action buttons */}
                {!isCountering && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {confirmAcceptId === prop.id ? (
                      <>
                        <Button
                          size="sm"
                          className="!bg-green-700/80 !shadow-none"
                          onClick={() => { handleAccept(prop); setConfirmAcceptId(null); }}
                          disabled={wantedPlayers.length === 0 || offeredPlayers.length === 0}
                        >
                          Confirm Trade
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmAcceptId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setConfirmAcceptId(prop.id)}
                          disabled={wantedPlayers.length === 0 || offeredPlayers.length === 0}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCounter(prop)}
                        >
                          Counter
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(prop.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {/* Resolved Proposals */}
      {resolvedProposals.length > 0 && (
        <div>
          <h2 className="font-display text-cream text-lg tracking-wide uppercase mb-3">Resolved</h2>
          <div className="space-y-2">
            {resolvedProposals.map(prop => (
              <div key={prop.id} className={cn(
                'flex items-center justify-between px-4 py-2.5 rounded-lg border font-mono text-sm',
                prop.status === 'accepted'
                  ? 'border-green-light/20 bg-green-900/10'
                  : 'border-navy-lighter/30 bg-navy-light/20',
              )}>
                <span className="text-cream-dim">Day {prop.day} — {prop.aiTeamName}</span>
                <span className={cn(
                  'font-bold uppercase text-xs',
                  prop.status === 'accepted' ? 'text-green-light' : 'text-red',
                )}>
                  {prop.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
