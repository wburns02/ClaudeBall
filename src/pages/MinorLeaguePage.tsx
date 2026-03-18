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

function PlayerRow({
  player,
  actions,
}: {
  player: Player;
  actions?: React.ReactNode;
}) {
  const ovr = Math.round(evaluatePlayer(player));
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-navy-lighter/20 border border-navy-lighter/40 hover:border-navy-lighter/80 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-body text-sm text-cream">{getPlayerName(player)}</span>
          {player.state.isInjured && (
            <span className="font-mono text-xs text-red-400 bg-red-900/20 px-1 rounded">INJ</span>
          )}
        </div>
        <p className="font-mono text-xs text-cream-dim">{player.position} · Age {player.age}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <OVR v={ovr} />
        {actions}
      </div>
    </div>
  );
}

export function MinorLeaguePage() {
  const navigate = useNavigate();
  const {
    engine, season, userTeamId,
    getAAATeam, callUpPlayer, sendDownPlayer, callupLog,
  } = useFranchiseStore();

  const [lastEvent, setLastEvent] = useState<string | null>(null);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-cream-dim">No franchise loaded.</p>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  const aaaRoster = getAAATeam(userTeamId);
  const currentDay = season.currentDay;
  const isSeptemberCallups = currentDay >= 150;

  const handleCallUp = () => {
    const event = callUpPlayer(userTeamId);
    if (event) {
      setLastEvent(event.message);
    } else {
      setLastEvent('No callup available — roster may be full or AAA is empty.');
    }
  };

  const handleSendDown = (playerId: string) => {
    const event = sendDownPlayer(userTeamId, playerId);
    if (event) {
      setLastEvent(event.message);
    }
  };

  const mlbRoster = userTeam?.roster.players ?? [];
  const maxRoster = isSeptemberCallups ? 40 : 26;

  // Identify send-down candidates: players with low value, not injured
  const sendDownCandidates = [...mlbRoster]
    .map(p => ({ p, v: evaluatePlayer(p) }))
    .filter(({ p }) => !p.state.isInjured)
    .sort((a, b) => a.v - b.v)
    .slice(0, 5);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Minor Leagues</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Day {currentDay} · {userTeam?.city} {userTeam?.name} AAA Affiliate
            {isSeptemberCallups && (
              <span className="ml-2 text-xs font-bold text-green-light bg-green-900/20 px-1.5 py-0.5 rounded">
                SEPT CALLUPS OPEN
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/roster')}>MLB Roster</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 mb-4 px-4 py-2 bg-navy-light border border-navy-lighter rounded-lg">
        <span className="font-mono text-sm text-cream-dim">
          MLB Roster: <span className={cn('font-bold', mlbRoster.length >= maxRoster ? 'text-red-400' : 'text-cream')}>{mlbRoster.length}</span>/{maxRoster}
        </span>
        <span className="font-mono text-sm text-cream-dim">
          AAA Roster: <span className="font-bold text-cream">{aaaRoster?.players.length ?? 0}</span>
        </span>
        {mlbRoster.length < maxRoster && (
          <Button size="sm" onClick={handleCallUp}>
            Call Up Top Prospect
          </Button>
        )}
      </div>

      {/* Event feedback */}
      {lastEvent && (
        <div className="mb-4 px-4 py-2 bg-green-900/20 border border-green-light/30 rounded-md font-mono text-sm text-green-light">
          {lastEvent}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AAA Roster */}
        <Panel title={`AAA Affiliate (${aaaRoster?.players.length ?? 0} players)`}>
          {!aaaRoster || aaaRoster.players.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm py-4 text-center">AAA affiliate is empty</p>
          ) : (
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {[...aaaRoster.players]
                .map(p => ({ p, v: evaluatePlayer(p) }))
                .sort((a, b) => b.v - a.v)
                .map(({ p }) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    actions={
                      mlbRoster.length < maxRoster ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            // Call up specific player
                            const event = engine.minorLeagues.callUp(
                              userTeamId,
                              mlbRoster,
                              currentDay
                            );
                            if (event) setLastEvent(event.message);
                          }}
                        >
                          ↑ MLB
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
            </div>
          )}
        </Panel>

        {/* Send-down candidates */}
        <Panel title="Send-Down Candidates">
          <p className="font-mono text-xs text-cream-dim mb-3">
            Lowest-value active MLB players. Send down to free roster spot.
          </p>
          {sendDownCandidates.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm py-4 text-center">No send-down candidates</p>
          ) : (
            <div className="space-y-1.5">
              {sendDownCandidates.map(({ p }) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  actions={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSendDown(p.id)}
                    >
                      ↓ AAA
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Callup history */}
        <Panel title={`Callup / Send-Down Log (${callupLog.length})`}>
          {callupLog.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm py-4 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...callupLog].reverse().map((e, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-2 px-3 py-2 rounded-md text-sm border',
                  e.type === 'callup'
                    ? 'bg-green-900/10 border-green-light/20 text-green-light'
                    : 'bg-navy-lighter/20 border-navy-lighter/40 text-cream-dim',
                )}>
                  <span className="font-mono text-xs shrink-0 mt-0.5">
                    {e.type === 'callup' ? '↑ MLB' : '↓ AAA'}
                  </span>
                  <span className="font-body">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* League-wide AAA info */}
        <Panel title="League AAA Overview">
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {engine.getAllTeams().map(team => {
              const affiliate = engine.minorLeagues.getAffiliate(team.id);
              const isUser = team.id === userTeamId;
              return (
                <div key={team.id} className={cn(
                  'flex items-center justify-between px-3 py-1.5 rounded-md',
                  isUser ? 'bg-gold/10 border border-gold/30' : 'bg-navy-lighter/10 border border-transparent',
                )}>
                  <span className={cn('font-body text-sm', isUser ? 'text-gold' : 'text-cream')}>
                    {team.city} {team.name}
                    {isUser && <span className="ml-1 text-xs">(You)</span>}
                  </span>
                  <span className="font-mono text-xs text-cream-dim">
                    {affiliate?.players.length ?? 0} AAA players
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
