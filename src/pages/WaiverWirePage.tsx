import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';

function OVR({ v }: { v: number }) {
  const color = v >= 75 ? 'text-gold' : v >= 60 ? 'text-green-light' : v >= 45 ? 'text-cream' : 'text-red-400';
  return <span className={cn('font-mono text-xs font-bold', color)}>{v}</span>;
}

function WaiverPlayerCard({
  player,
  expiresDay,
  currentDay,
  onClaim,
  onRelease,
  isClaimed,
  claimable,
}: {
  player: Player;
  expiresDay?: number;
  currentDay: number;
  onClaim?: () => void;
  onRelease?: () => void;
  isClaimed?: boolean;
  claimable?: boolean;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  const daysLeft = expiresDay !== undefined ? Math.max(0, expiresDay - currentDay) : null;

  return (
    <div className={cn(
      'flex items-start justify-between gap-3 px-3 py-2.5 rounded-md border transition-colors',
      isClaimed
        ? 'opacity-40 bg-navy-lighter/10 border-navy-lighter/20'
        : 'bg-navy-lighter/20 border-navy-lighter/40 hover:border-navy-lighter/80',
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body text-sm text-cream font-medium">{getPlayerName(player)}</span>
          {isClaimed && <span className="font-mono text-xs text-cream-dim">CLAIMED</span>}
        </div>
        <p className="font-mono text-xs text-cream-dim">{player.position} · Age {player.age}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <OVR v={ovr} />
        {daysLeft !== null && !isClaimed && (
          <span className={cn(
            'font-mono text-xs',
            daysLeft <= 1 ? 'text-red-400 font-bold' : daysLeft <= 2 ? 'text-orange-400' : 'text-cream-dim',
          )}>
            {daysLeft}d
          </span>
        )}
        {onClaim && claimable && !isClaimed && (
          <Button size="sm" onClick={onClaim}>Claim</Button>
        )}
        {onRelease && (
          <Button size="sm" variant="ghost" onClick={onRelease}>Release</Button>
        )}
      </div>
    </div>
  );
}

export function WaiverWirePage() {
  const navigate = useNavigate();
  const {
    engine, season, userTeamId,
    getAvailableWaivers, claimWaiverPlayer, releasePlayerToWaivers, waiverLog,
  } = useFranchiseStore();

  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-cream-dim">No franchise loaded.</p>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const userTeam = engine.getTeam(userTeamId);
  const availableWaivers = getAvailableWaivers();
  const allWaivers = engine.waiverWire.getAll();
  const claimedWaivers = allWaivers.filter(w => w.claimedBy !== null);
  const expiredWaivers = allWaivers.filter(w => !w.claimedBy && currentDay > w.expiresDay);

  const mlbPlayers = userTeam?.roster.players ?? [];

  const handleClaim = (playerId: string) => {
    const result = claimWaiverPlayer(playerId, userTeamId);
    if (result) {
      setMessage(result.message);
      setMessageType('success');
    } else {
      setMessage('Unable to claim player. Roster may be full or claim window expired.');
      setMessageType('error');
    }
  };

  const handleRelease = (playerId: string) => {
    const result = releasePlayerToWaivers(userTeamId, playerId);
    if (result) {
      setMessage(result.message);
      setMessageType('success');
    }
  };

  // Candidates to release: low-value players
  const releaseCandidates = [...mlbPlayers]
    .map(p => ({ p, v: evaluatePlayer(p) }))
    .filter(({ p }) => !p.state.isInjured)
    .sort((a, b) => a.v - b.v)
    .slice(0, 8);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Waiver Wire</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Day {currentDay} · {availableWaivers.length} players available · 3-day claim window
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/roster')}>Roster</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className={cn(
          'mb-4 px-4 py-2.5 rounded-md border font-mono text-sm',
          messageType === 'success'
            ? 'bg-green-900/20 border-green-light/30 text-green-light'
            : 'bg-red-900/20 border-red-500/30 text-red-400',
        )}>
          {message}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Available', value: availableWaivers.length, color: 'text-cream' },
          { label: 'Claimed Today', value: claimedWaivers.length, color: 'text-green-light' },
          { label: 'Cleared', value: expiredWaivers.length, color: 'text-cream-dim' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3 text-center">
            <p className={cn('font-display text-2xl font-bold', color)}>{value}</p>
            <p className="font-mono text-xs text-cream-dim mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Available to claim */}
        <Panel title={`Available (${availableWaivers.length})`}>
          <p className="font-mono text-xs text-cream-dim mb-3">
            Claim within {3} days of release. Sorted by value.
          </p>
          {availableWaivers.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-mono text-cream-dim">No players available on waivers.</p>
              <p className="font-mono text-xs text-cream-dim/60 mt-1">
                Release a player to populate the wire.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {[...availableWaivers]
                .map(w => ({ w, v: evaluatePlayer(w.player) }))
                .sort((a, b) => b.v - a.v)
                .map(({ w }) => (
                  <WaiverPlayerCard
                    key={w.player.id}
                    player={w.player}
                    expiresDay={w.expiresDay}
                    currentDay={currentDay}
                    claimable={mlbPlayers.length < 26}
                    onClaim={() => handleClaim(w.player.id)}
                  />
                ))}
            </div>
          )}
        </Panel>

        {/* Release roster players */}
        <Panel title="Release Player">
          <p className="font-mono text-xs text-cream-dim mb-3">
            Releasing a player puts them on a 3-day waiver window. Any team can claim them.
          </p>
          {releaseCandidates.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm text-center py-4">No roster players</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {releaseCandidates.map(({ p }) => (
                <WaiverPlayerCard
                  key={p.id}
                  player={p}
                  currentDay={currentDay}
                  onRelease={() => handleRelease(p.id)}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Waiver history */}
        <Panel title={`Waiver Log (${waiverLog.length})`}>
          {waiverLog.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm text-center py-4">No waiver activity yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...waiverLog].reverse().map((e, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-2 px-3 py-2 rounded-md text-sm border',
                  e.type === 'claim'
                    ? 'bg-green-900/10 border-green-light/20 text-green-light'
                    : e.type === 'release'
                    ? 'bg-navy-lighter/20 border-navy-lighter/40 text-cream-dim'
                    : 'bg-navy-lighter/10 border-navy-lighter/20 text-cream-dim/60',
                )}>
                  <span className="font-mono text-xs shrink-0 mt-0.5 uppercase">
                    {e.type}
                  </span>
                  <span className="font-body">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Claimed waivers history */}
        <Panel title={`Season Claims (${claimedWaivers.length})`}>
          {claimedWaivers.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm text-center py-4">No claims this season</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...claimedWaivers].reverse().map((w, i) => {
                const ovr = Math.round(evaluatePlayer(w.player));
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-md bg-navy-lighter/20 border border-navy-lighter/40">
                    <div>
                      <span className="font-body text-sm text-cream">{getPlayerName(w.player)}</span>
                      <p className="font-mono text-xs text-cream-dim">{w.player.position} · Day {w.claimedDay}</p>
                    </div>
                    <OVR v={ovr} />
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
