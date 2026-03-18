import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import type { Player } from '@/engine/types/player.ts';

function playerOvr(p: Player) {
  return Math.round(evaluatePlayer(p));
}

function ovrColor(v: number) {
  if (v >= 75) return 'text-green-400';
  if (v >= 55) return 'text-yellow-400';
  return 'text-red-400';
}

export function RosterManagerPage() {
  const navigate = useNavigate();
  const { teams, releasePlayer, movePlayer } = useFranchiseStore();

  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? '');
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({});

  const selectedTeam = useMemo(
    () => teams.find(t => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  const otherTeams = useMemo(
    () => teams.filter(t => t.id !== selectedTeamId),
    [teams, selectedTeamId]
  );

  function handleRelease(playerId: string) {
    if (!selectedTeamId) return;
    releasePlayer(playerId, selectedTeamId);
    setConfirmRelease(null);
  }

  function handleMove(playerId: string) {
    const targetId = moveTarget[playerId];
    if (!targetId || !selectedTeamId) return;
    movePlayer(playerId, selectedTeamId, targetId);
    setMoveTarget(prev => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Roster Manager</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">Move, release, or transfer players between all 30 teams</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/create-player')}>
            + Create Player
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Team selector — left panel */}
        <div className="md:col-span-1">
          <Panel title="Select Team">
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTeamId(t.id); setConfirmRelease(null); }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md border transition-all cursor-pointer',
                    selectedTeamId === t.id
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-transparent hover:border-navy-lighter text-cream hover:bg-navy-lighter/30'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.primaryColor }}
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold">{t.abbreviation}</p>
                      <p className="text-xs text-cream-dim truncate">{t.city}</p>
                    </div>
                    <span className="ml-auto text-xs font-mono text-cream-dim">
                      {t.roster.players.length}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* Roster — right panel */}
        <div className="md:col-span-3">
          {selectedTeam ? (
            <Panel title={`${selectedTeam.city} ${selectedTeam.name} — ${selectedTeam.roster.players.length} players`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-navy-lighter">
                      <th className="px-3 py-2 text-left text-gold-dim text-xs font-mono uppercase tracking-wider">#</th>
                      <th className="px-3 py-2 text-left text-gold-dim text-xs font-mono uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 text-center text-gold-dim text-xs font-mono uppercase tracking-wider">Pos</th>
                      <th className="px-3 py-2 text-center text-gold-dim text-xs font-mono uppercase tracking-wider">Age</th>
                      <th className="px-3 py-2 text-center text-gold-dim text-xs font-mono uppercase tracking-wider">OVR</th>
                      <th className="px-3 py-2 text-left text-gold-dim text-xs font-mono uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeam.roster.players.map(p => {
                      const ovr = playerOvr(p);
                      const isConfirmingRelease = confirmRelease === p.id;
                      return (
                        <tr key={p.id} className="border-b border-navy-lighter/50 hover:bg-navy-lighter/20 transition-colors">
                          <td className="px-3 py-2 font-mono text-xs text-cream-dim">{p.number}</td>
                          <td className="px-3 py-2 text-sm text-cream font-body">
                            <button
                              onClick={() => navigate(`/franchise/player/${p.id}`)}
                              className="hover:text-gold transition-colors cursor-pointer"
                            >
                              {getPlayerName(p)}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-xs text-gold">{p.position}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs text-cream-dim">{p.age}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs font-bold">
                            <span className={ovrColor(ovr)}>{ovr}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Edit */}
                              <Button
                                size="sm" variant="secondary"
                                onClick={() => navigate(`/franchise/player/${p.id}`)}
                              >
                                Edit
                              </Button>
                              {/* Move */}
                              <div className="flex items-center gap-1">
                                <select
                                  className={cn(
                                    'bg-navy border border-navy-lighter rounded px-2 py-1 text-xs text-cream',
                                    'focus:outline-none focus:border-gold/60 cursor-pointer'
                                  )}
                                  value={moveTarget[p.id] ?? ''}
                                  onChange={e => setMoveTarget(prev => ({ ...prev, [p.id]: e.target.value }))}
                                >
                                  <option value="">Move to...</option>
                                  {otherTeams.map(t => (
                                    <option key={t.id} value={t.id}>{t.abbreviation} — {t.city}</option>
                                  ))}
                                </select>
                                {moveTarget[p.id] && (
                                  <Button size="sm" variant="secondary" onClick={() => handleMove(p.id)}>
                                    OK
                                  </Button>
                                )}
                              </div>
                              {/* Release */}
                              {isConfirmingRelease ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    className="!bg-red-600 !shadow-none text-white"
                                    onClick={() => handleRelease(p.id)}
                                  >
                                    Confirm
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setConfirmRelease(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-red-400 hover:text-red-300"
                                  onClick={() => setConfirmRelease(p.id)}
                                >
                                  Release
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {selectedTeam.roster.players.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="font-mono text-cream-dim text-sm">No players on this roster.</p>
                    <Button
                      size="sm" variant="secondary" className="mt-3"
                      onClick={() => navigate('/franchise/create-player')}
                    >
                      + Create Player
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <p className="font-mono text-cream-dim text-center py-8">Select a team to manage its roster.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
