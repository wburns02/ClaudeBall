import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import type { LineupSpot } from '@/engine/types/team.ts';

export function TeamEditorPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { teams, updateTeam, reorderLineup } = useFranchiseStore();

  const team = useMemo(() => teams.find(t => t.id === teamId) ?? null, [teams, teamId]);

  const [name, setName] = useState(team?.name ?? '');
  const [city, setCity] = useState(team?.city ?? '');
  const [abbreviation, setAbbreviation] = useState(team?.abbreviation ?? '');
  const [primaryColor, setPrimaryColor] = useState(team?.primaryColor ?? '#d4a843');
  const [secondaryColor, setSecondaryColor] = useState(team?.secondaryColor ?? '#0a0f1a');
  const [pitcherId, setPitcherId] = useState(team?.pitcherId ?? '');
  const [bullpen, setBullpen] = useState<string[]>(team?.bullpen ?? []);
  const [lineup, setLineup] = useState<LineupSpot[]>(team?.lineup ?? []);
  const [saved, setSaved] = useState(false);

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Panel>
          <p className="font-mono text-cream-dim">Team not found.</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Back</Button>
        </Panel>
      </div>
    );
  }

  const pitchers = team.roster.players.filter(p => p.position === 'P');
  const positionPlayers = team.roster.players.filter(p => p.position !== 'P');

  function moveLineupSpot(index: number, direction: 'up' | 'down') {
    const newLineup = [...lineup];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newLineup.length) return;
    [newLineup[index], newLineup[swapIdx]] = [newLineup[swapIdx], newLineup[index]];
    setLineup(newLineup);
  }

  function toggleBullpen(playerId: string) {
    setBullpen(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  }

  function handleSave() {
    updateTeam(teamId!, { name, city, abbreviation, primaryColor, secondaryColor, pitcherId, bullpen });
    reorderLineup(teamId!, lineup);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass = cn(
    'w-full bg-navy border border-navy-lighter rounded-md px-3 py-2',
    'text-cream font-body text-sm focus:outline-none focus:border-gold/60',
    'placeholder:text-cream-dim/40 transition-colors'
  );

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Team Editor</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {team.city} {team.name} ({team.abbreviation})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleSave} className={saved ? '!bg-green-600' : ''}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Team Info */}
        <div className="space-y-4">
          <Panel title="Team Info">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">City</label>
                  <input type="text" className={inputClass} value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">Team Name</label>
                  <input type="text" className={inputClass} value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1">Abbreviation</label>
                <input type="text" className={inputClass} value={abbreviation} maxLength={3}
                  onChange={e => setAbbreviation(e.target.value.toUpperCase())} />
              </div>
            </div>
          </Panel>

          {/* Colors */}
          <Panel title="Team Colors">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-2">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={e => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-2 border-navy-lighter bg-transparent"
                    />
                    <span className="font-mono text-sm text-cream">{primaryColor.toUpperCase()}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-2">Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={e => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-2 border-navy-lighter bg-transparent"
                    />
                    <span className="font-mono text-sm text-cream">{secondaryColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>
              {/* Color preview */}
              <div
                className="rounded-lg p-4 border-2 transition-all duration-300"
                style={{ backgroundColor: primaryColor, borderColor: secondaryColor }}
              >
                <p className="font-display text-xl tracking-wide uppercase"
                  style={{ color: secondaryColor }}>
                  {city || 'City'} {name || 'Team'}
                </p>
                <p className="font-mono text-sm mt-1 font-bold"
                  style={{ color: secondaryColor, opacity: 0.8 }}>
                  {abbreviation || 'ABR'}
                </p>
              </div>
            </div>
          </Panel>

          {/* Starting Pitcher */}
          <Panel title="Starting Pitcher">
            <div className="space-y-2">
              {pitchers.length === 0 ? (
                <p className="text-cream-dim font-mono text-sm">No pitchers on roster.</p>
              ) : (
                pitchers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPitcherId(p.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md border transition-all cursor-pointer text-sm font-body',
                      pitcherId === p.id
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-navy-lighter bg-navy hover:border-gold/40 text-cream'
                    )}
                  >
                    <span className="font-mono text-xs text-cream-dim mr-2">#{p.number}</span>
                    {getPlayerName(p)}
                    {pitcherId === p.id && <span className="ml-2 text-xs text-gold font-mono">(SP)</span>}
                  </button>
                ))
              )}
            </div>
          </Panel>

          {/* Bullpen */}
          <Panel title="Bullpen Order">
            <p className="text-cream-dim text-xs font-mono mb-3">Select pitchers for bullpen (in relief order):</p>
            <div className="space-y-2">
              {pitchers.filter(p => p.id !== pitcherId).map(p => (
                <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                      bullpen.includes(p.id) ? 'bg-gold border-gold' : 'border-navy-lighter group-hover:border-gold/50'
                    )}
                    onClick={() => toggleBullpen(p.id)}
                  >
                    {bullpen.includes(p.id) && (
                      <svg viewBox="0 0 8 8" className="w-2.5 h-2.5"><path d="M1 4l2 2 4-4" stroke="#0a0f1a" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
                    )}
                  </div>
                  <span className="text-sm text-cream font-body">
                    <span className="font-mono text-xs text-cream-dim mr-1">#{p.number}</span>
                    {getPlayerName(p)}
                  </span>
                  {bullpen.includes(p.id) && (
                    <span className="ml-auto font-mono text-xs text-gold">#{bullpen.indexOf(p.id) + 1}</span>
                  )}
                </label>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right: Lineup order */}
        <div>
          <Panel title="Batting Order">
            <p className="text-cream-dim text-xs font-mono mb-3">Use arrows to reorder the lineup:</p>
            {lineup.length === 0 ? (
              <p className="text-cream-dim font-mono text-sm">No lineup set.</p>
            ) : (
              <div className="space-y-1.5">
                {lineup.map((spot, idx) => {
                  const player = positionPlayers.find(p => p.id === spot.playerId)
                    ?? team.roster.players.find(p => p.id === spot.playerId);
                  return (
                    <div
                      key={spot.playerId}
                      className="flex items-center gap-2 bg-navy rounded-md px-3 py-2 border border-navy-lighter"
                    >
                      <span className="w-6 text-center font-mono text-gold text-sm font-bold">{idx + 1}</span>
                      <span className="flex-1 text-cream text-sm font-body">
                        {player ? getPlayerName(player) : spot.playerId}
                        <span className="ml-1.5 font-mono text-xs text-cream-dim">{spot.position}</span>
                      </span>
                      <div className="flex gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveLineupSpot(idx, 'up')}
                          className={cn(
                            'w-6 h-6 rounded flex items-center justify-center text-xs transition-colors',
                            idx === 0
                              ? 'text-cream-dim/30 cursor-not-allowed'
                              : 'text-cream-dim hover:text-gold hover:bg-gold/10 cursor-pointer'
                          )}
                        >▲</button>
                        <button
                          disabled={idx === lineup.length - 1}
                          onClick={() => moveLineupSpot(idx, 'down')}
                          className={cn(
                            'w-6 h-6 rounded flex items-center justify-center text-xs transition-colors',
                            idx === lineup.length - 1
                              ? 'text-cream-dim/30 cursor-not-allowed'
                              : 'text-cream-dim hover:text-gold hover:bg-gold/10 cursor-pointer'
                          )}
                        >▼</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} className={saved ? '!bg-green-600' : ''}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
