import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import { TEAMS as ALL_TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';

interface DivisionDef {
  name: string;
  teamIds: string[];
}

interface LeagueDef {
  name: string;
  divisions: DivisionDef[];
}

function buildDefaultLeagues(numTeams: number, numDivisions: number): LeagueDef[] {
  // Two leagues by default
  const leagues: LeagueDef[] = [
    { name: 'American League', divisions: [] },
    { name: 'National League', divisions: [] },
  ];
  const divsPerLeague = Math.ceil(numDivisions / 2);
  for (let l = 0; l < 2; l++) {
    for (let d = 0; d < divsPerLeague; d++) {
      leagues[l].divisions.push({
        name: `Division ${String.fromCharCode(65 + d)}`,
        teamIds: [],
      });
    }
  }
  return leagues;
}

export function CustomLeaguePage() {
  const navigate = useNavigate();
  const { startFranchise, userTeamId } = useFranchiseStore();

  const [numTeams, setNumTeams] = useState(30);
  const [numDivisions, setNumDivisions] = useState(6);
  const [gamesPerSeason, setGamesPerSeason] = useState(162);
  const [leagues, setLeagues] = useState<LeagueDef[]>(() => buildDefaultLeagues(30, 6));
  const [userTeamIdLocal, setUserTeamIdLocal] = useState(userTeamId ?? ALL_TEAMS[0]?.id ?? '');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'config' | 'structure'>('config');

  // All 30 teams available
  const allTeams = ALL_TEAMS.slice(0, numTeams);

  const assignedTeamIds = useMemo(
    () => new Set(leagues.flatMap(l => l.divisions.flatMap(d => d.teamIds))),
    [leagues]
  );

  const unassignedTeams = useMemo(
    () => allTeams.filter(t => !assignedTeamIds.has(t.id)),
    [allTeams, assignedTeamIds]
  );

  function handleRebuildLeagues() {
    setLeagues(buildDefaultLeagues(numTeams, numDivisions));
  }

  function updateLeagueName(lIdx: number, name: string) {
    setLeagues(prev => prev.map((l, i) => i === lIdx ? { ...l, name } : l));
  }

  function updateDivisionName(lIdx: number, dIdx: number, name: string) {
    setLeagues(prev => prev.map((l, i) => i === lIdx ? {
      ...l,
      divisions: l.divisions.map((d, j) => j === dIdx ? { ...d, name } : d),
    } : l));
  }

  function assignTeamToDivision(teamId: string, lIdx: number, dIdx: number) {
    setLeagues(prev => {
      // Remove from any existing division first
      const cleaned = prev.map(l => ({
        ...l,
        divisions: l.divisions.map(d => ({
          ...d,
          teamIds: d.teamIds.filter(id => id !== teamId),
        })),
      }));
      return cleaned.map((l, i) => i === lIdx ? {
        ...l,
        divisions: l.divisions.map((d, j) => j === dIdx ? {
          ...d,
          teamIds: [...d.teamIds, teamId],
        } : d),
      } : l);
    });
  }

  function removeTeamFromDivision(teamId: string) {
    setLeagues(prev => prev.map(l => ({
      ...l,
      divisions: l.divisions.map(d => ({
        ...d,
        teamIds: d.teamIds.filter(id => id !== teamId),
      })),
    })));
  }

  function handleAutoAssign() {
    // Evenly distribute all teams
    const allIds = allTeams.map(t => t.id);
    const allDivs = leagues.flatMap((l, lIdx) =>
      l.divisions.map((d, dIdx) => ({ lIdx, dIdx }))
    );
    const teamsPerDiv = Math.ceil(allIds.length / allDivs.length);
    const newLeagues = leagues.map(l => ({
      ...l,
      divisions: l.divisions.map(d => ({ ...d, teamIds: [] as string[] })),
    }));
    let teamIdx = 0;
    for (const { lIdx, dIdx } of allDivs) {
      const chunk = allIds.slice(teamIdx, teamIdx + teamsPerDiv);
      newLeagues[lIdx].divisions[dIdx].teamIds = chunk;
      teamIdx += teamsPerDiv;
    }
    setLeagues(newLeagues);
  }

  function handleStart() {
    if (!userTeamIdLocal) {
      setError('Please select your team.');
      return;
    }
    if (assignedTeamIds.size === 0) {
      setError('Please assign teams to divisions first.');
      return;
    }

    // Build leagueStructure for SeasonEngine
    const leagueStructure: Record<string, Record<string, string[]>> = {};
    for (const league of leagues) {
      leagueStructure[league.name] = {};
      for (const div of league.divisions) {
        if (div.teamIds.length > 0) {
          leagueStructure[league.name][div.name] = div.teamIds;
        }
      }
    }

    const teamsForSeason = allTeams.filter(t => assignedTeamIds.has(t.id));

    // Patch gamesPerSeason into teams data if needed — SeasonEngine reads structure only
    startFranchise(teamsForSeason as never, leagueStructure, userTeamIdLocal);
    navigate('/franchise');
  }

  const inputClass = cn(
    'w-full bg-navy border border-navy-lighter rounded-md px-3 py-2',
    'text-cream font-body text-sm focus:outline-none focus:border-gold/60',
    'placeholder:text-cream-dim/40 transition-colors'
  );

  const sliderClass = 'w-full cursor-pointer accent-[#d4a843]';

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Custom League</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">Design your own league structure and season format</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>Back</Button>
      </div>

      {/* Step tabs */}
      <div className="flex gap-2 mb-6">
        {(['config', 'structure'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={cn(
              'px-5 py-2 rounded-t-lg font-display text-sm uppercase tracking-wider transition-colors cursor-pointer border-b-2',
              step === s
                ? 'bg-navy-light border-gold text-gold'
                : 'bg-navy border-transparent text-cream-dim hover:text-cream'
            )}
          >
            {s === 'config' ? '1. Settings' : '2. Structure'}
          </button>
        ))}
      </div>

      {step === 'config' && (
        <div className="space-y-4">
          <Panel title="League Settings">
            <div className="space-y-6">
              {/* Number of teams */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-cream-dim text-xs font-mono uppercase tracking-wide">
                    Number of Teams
                  </label>
                  <span className="text-gold font-mono text-sm font-bold">{numTeams}</span>
                </div>
                <input
                  type="range" min={2} max={30} value={numTeams}
                  className={sliderClass}
                  onChange={e => setNumTeams(Number(e.target.value))}
                />
                <div className="flex justify-between text-xs font-mono text-cream-dim/50 mt-1">
                  <span>2</span><span>30</span>
                </div>
              </div>

              {/* Divisions */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-cream-dim text-xs font-mono uppercase tracking-wide">
                    Number of Divisions
                  </label>
                  <span className="text-gold font-mono text-sm font-bold">{numDivisions}</span>
                </div>
                <input
                  type="range" min={1} max={6} value={numDivisions}
                  className={sliderClass}
                  onChange={e => setNumDivisions(Number(e.target.value))}
                />
                <div className="flex justify-between text-xs font-mono text-cream-dim/50 mt-1">
                  <span>1</span><span>6</span>
                </div>
              </div>

              {/* Games per season */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-cream-dim text-xs font-mono uppercase tracking-wide">
                    Games Per Season
                  </label>
                  <span className="text-gold font-mono text-sm font-bold">{gamesPerSeason}</span>
                </div>
                <input
                  type="range" min={10} max={162} step={2} value={gamesPerSeason}
                  className={sliderClass}
                  onChange={e => setGamesPerSeason(Number(e.target.value))}
                />
                <div className="flex justify-between text-xs font-mono text-cream-dim/50 mt-1">
                  <span>10</span><span>162</span>
                </div>
              </div>

              {/* Your team */}
              <div>
                <label className="block text-cream-dim text-xs font-mono uppercase tracking-wide mb-1.5">
                  Your Team
                </label>
                <select
                  className={cn(inputClass, 'cursor-pointer')}
                  value={userTeamIdLocal}
                  onChange={e => setUserTeamIdLocal(e.target.value)}
                >
                  {allTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.city} {t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={handleRebuildLeagues}>
                  Rebuild Structure
                </Button>
                <Button variant="primary" onClick={() => setStep('structure')}>
                  Next: Structure →
                </Button>
              </div>
            </div>
          </Panel>

          {/* Summary */}
          <Panel title="Summary">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-mono font-bold text-gold">{numTeams}</p>
                <p className="text-cream-dim text-xs font-mono uppercase tracking-wide mt-1">Teams</p>
              </div>
              <div>
                <p className="text-3xl font-mono font-bold text-gold">{numDivisions}</p>
                <p className="text-cream-dim text-xs font-mono uppercase tracking-wide mt-1">Divisions</p>
              </div>
              <div>
                <p className="text-3xl font-mono font-bold text-gold">{gamesPerSeason}</p>
                <p className="text-cream-dim text-xs font-mono uppercase tracking-wide mt-1">Games</p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {step === 'structure' && (
        <div className="space-y-4">
          {/* Unassigned teams */}
          {unassignedTeams.length > 0 && (
            <Panel title={`Unassigned Teams (${unassignedTeams.length})`}>
              <div className="flex flex-wrap gap-2">
                {unassignedTeams.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded border border-navy-lighter bg-navy text-xs font-mono text-cream-dim"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                    {t.abbreviation}
                  </div>
                ))}
              </div>
              <Button size="sm" variant="secondary" className="mt-3" onClick={handleAutoAssign}>
                Auto-Assign All
              </Button>
            </Panel>
          )}

          {/* Leagues + Divisions */}
          {leagues.map((league, lIdx) => (
            <Panel key={lIdx} title="">
              <div className="mb-3">
                <input
                  className={cn(inputClass, 'text-gold font-display text-lg tracking-wide')}
                  value={league.name}
                  onChange={e => updateLeagueName(lIdx, e.target.value)}
                  placeholder="League Name"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {league.divisions.map((div, dIdx) => (
                  <div key={dIdx} className="bg-navy rounded-lg border border-navy-lighter p-3">
                    <input
                      className="w-full bg-transparent text-cream font-mono text-sm border-b border-navy-lighter pb-1 mb-2 focus:outline-none focus:border-gold/60"
                      value={div.name}
                      onChange={e => updateDivisionName(lIdx, dIdx, e.target.value)}
                      placeholder="Division Name"
                    />
                    {/* Teams in this division */}
                    {div.teamIds.length === 0 && (
                      <p className="text-cream-dim text-xs font-mono italic">No teams assigned</p>
                    )}
                    {div.teamIds.map(tid => {
                      const t = ALL_TEAMS.find(tm => tm.id === tid);
                      return t ? (
                        <div key={tid} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                            <span className="text-xs font-mono text-cream">{t.abbreviation}</span>
                            <span className="text-xs text-cream-dim">{t.city}</span>
                          </div>
                          <button
                            onClick={() => removeTeamFromDivision(tid)}
                            className="text-red-400 hover:text-red-300 text-xs cursor-pointer px-1"
                          >×</button>
                        </div>
                      ) : null;
                    })}
                    {/* Add team dropdown */}
                    {unassignedTeams.length > 0 && (
                      <select
                        className="mt-2 w-full bg-navy-lighter border border-navy-lighter rounded px-2 py-1 text-xs text-cream focus:outline-none focus:border-gold/60 cursor-pointer"
                        value=""
                        onChange={e => {
                          if (e.target.value) assignTeamToDivision(e.target.value, lIdx, dIdx);
                        }}
                      >
                        <option value="">+ Add team...</option>
                        {unassignedTeams.map(t => (
                          <option key={t.id} value={t.id}>{t.abbreviation} — {t.city}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          ))}

          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

          <div className="flex items-center gap-3 pb-8">
            <Button variant="ghost" onClick={() => setStep('config')}>← Back</Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleStart}
              className="ml-auto"
            >
              Start Custom Season
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
