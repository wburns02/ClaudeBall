import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { getHistoricalSeason, AVAILABLE_YEAR_RANGE } from '@/engine/data/lahmanLoader.ts';
import type { HistoricalTeam, HistoricalSeason } from '@/engine/data/lahmanLoader.ts';

// ── Helpers ────────────────────────────────────────────────────────────────

const YEAR_MIN = AVAILABLE_YEAR_RANGE.min;
const YEAR_MAX = AVAILABLE_YEAR_RANGE.max;

// Notable historical years for quick selection
const NOTABLE_YEARS: { year: number; label: string }[] = [
  { year: 1927, label: '1927 Yankees' },
  { year: 1955, label: '1955 Brooklyn' },
  { year: 1969, label: '1969 Mets' },
  { year: 1975, label: '1975 Reds' },
  { year: 1986, label: '1986 Mets' },
  { year: 1998, label: '1998 Yankees' },
  { year: 2001, label: '2001 Mariners' },
  { year: 2004, label: '2004 Red Sox' },
  { year: 2016, label: '2016 Cubs' },
  { year: 2019, label: '2019 Astros' },
];

function winPct(w: number, l: number): string {
  if (w + l === 0) return '.000';
  const pct = w / (w + l);
  return pct.toFixed(3).replace(/^0/, '');
}

export function HistoricalPage() {
  const navigate = useNavigate();

  const [selectedYear, setSelectedYear] = useState<number>(1998);
  const [season, setSeason] = useState<HistoricalSeason | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<HistoricalTeam | null>(null);

  const loadYear = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    setSeason(null);
    setSelectedTeam(null);
    try {
      const data = await getHistoricalSeason(year);
      setSeason(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load season data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadYear(selectedYear);
  }, [selectedYear, loadYear]);

  // Group teams by league
  const alTeams = season?.teams.filter(t => t.league === 'AL').sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses)) ?? [];
  const nlTeams = season?.teams.filter(t => t.league === 'NL').sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses)) ?? [];
  const otherTeams = season?.teams.filter(t => t.league !== 'AL' && t.league !== 'NL') ?? [];

  const teamTableRows = (teams: HistoricalTeam[]) => teams.map(t => ({
    team: (
      <button
        className={`text-left font-mono hover:text-gold transition-colors ${selectedTeam?.id === t.id ? 'text-gold' : 'text-cream'}`}
        onClick={() => setSelectedTeam(t === selectedTeam ? null : t)}
      >
        <span className="font-semibold">{t.city}</span> {t.name}
      </button>
    ),
    abbr: t.abbreviation,
    w: t.wins,
    l: t.losses,
    pct: winPct(t.wins, t.losses),
    roster: `${t.roster.players.length}`,
  }));

  const teamTableCols = [
    { key: 'team', label: 'Team', align: 'left' as const },
    { key: 'abbr', label: 'ABB', align: 'center' as const, width: '60px' },
    { key: 'w', label: 'W', align: 'center' as const, width: '50px' },
    { key: 'l', label: 'L', align: 'center' as const, width: '50px' },
    { key: 'pct', label: 'PCT', align: 'center' as const, width: '70px' },
    { key: 'roster', label: 'P', align: 'center' as const, width: '50px' },
  ];

  // Roster table for selected team
  const rosterRows = selectedTeam
    ? selectedTeam.roster.players
        .sort((a, b) => {
          if (a.position === 'P' && b.position !== 'P') return 1;
          if (a.position !== 'P' && b.position === 'P') return -1;
          return 0;
        })
        .map(p => ({
          name: `${p.firstName} ${p.lastName}`,
          pos: p.position,
          age: p.age,
          bats: p.bats,
          rating: p.position === 'P'
            ? Math.round((p.pitching.stuff + p.pitching.control + p.pitching.movement) / 3)
            : Math.round((p.batting.contact_R + p.batting.power_R + p.batting.eye) / 3),
        }))
    : [];

  const rosterCols = [
    { key: 'name', label: 'Player', align: 'left' as const },
    { key: 'pos', label: 'POS', align: 'center' as const, width: '55px' },
    { key: 'age', label: 'Age', align: 'center' as const, width: '50px' },
    { key: 'bats', label: 'B', align: 'center' as const, width: '40px' },
    { key: 'rating', label: 'OVR', align: 'center' as const, width: '55px' },
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-gold tracking-tight uppercase">Historical Mode</h1>
            <p className="text-cream-dim text-sm font-mono mt-1">Lahman Baseball Database · 1900–2019</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/')}>← Main Menu</Button>
        </div>

        {/* Year Selector */}
        <Panel title="Select Season">
          <div className="space-y-4">
            {/* Quick picks */}
            <div>
              <p className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-2">Notable Seasons</p>
              <div className="flex flex-wrap gap-2">
                {NOTABLE_YEARS.map(({ year, label }) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                      selectedYear === year
                        ? 'bg-gold text-navy border-gold font-semibold'
                        : 'bg-navy-lighter border-navy-lighter text-cream-dim hover:text-cream hover:border-gold/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Slider */}
            <div>
              <p className="text-cream-dim text-xs font-mono uppercase tracking-wider mb-2">
                Year: <span className="text-gold text-lg font-semibold">{selectedYear}</span>
              </p>
              <input
                type="range"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full accent-gold"
              />
              <div className="flex justify-between text-cream-dim/50 text-xs font-mono mt-1">
                <span>{YEAR_MIN}</span>
                <span>1920</span>
                <span>1940</span>
                <span>1960</span>
                <span>1980</span>
                <span>2000</span>
                <span>{YEAR_MAX}</span>
              </div>
            </div>

            {/* Manual input */}
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={selectedYear}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (v >= YEAR_MIN && v <= YEAR_MAX) setSelectedYear(v);
                }}
                className="w-24 bg-navy border border-navy-lighter rounded px-3 py-1.5 text-cream font-mono text-sm focus:border-gold/60 focus:outline-none"
              />
              <Button size="sm" onClick={() => loadYear(selectedYear)}>
                Load {selectedYear}
              </Button>
            </div>
          </div>
        </Panel>

        {/* Loading / Error */}
        {loading && (
          <Panel>
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-cream-dim font-mono">Loading {selectedYear} season data...</span>
            </div>
          </Panel>
        )}

        {error && (
          <Panel>
            <div className="text-center py-8">
              <p className="text-red-400 font-mono">{error}</p>
            </div>
          </Panel>
        )}

        {/* Season Teams */}
        {season && !loading && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-gold">
                {selectedYear} Season — {season.teams.length} Teams
              </h2>
              <div className="flex gap-3">
                <Button
                  size="md"
                  onClick={() => navigate('/historical/draft', { state: { year: selectedYear, teams: season.teams } })}
                >
                  Fantasy Draft
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    // Replay: pick two teams and launch a game
                    if (season.teams.length >= 2) {
                      // Use top team from each league
                      const away = alTeams[0] ?? season.teams[0];
                      const home = nlTeams[0] ?? season.teams[1];
                      navigate('/game/live', {
                        state: {
                          awayTeam: away,
                          homeTeam: home,
                        },
                      });
                    }
                  }}
                >
                  Replay Top Match
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AL Teams */}
              {alTeams.length > 0 && (
                <Panel title={`American League (${alTeams.length})`}>
                  <StatsTable columns={teamTableCols} rows={teamTableRows(alTeams)} compact />
                </Panel>
              )}

              {/* NL Teams */}
              {nlTeams.length > 0 && (
                <Panel title={`National League (${nlTeams.length})`}>
                  <StatsTable columns={teamTableCols} rows={teamTableRows(nlTeams)} compact />
                </Panel>
              )}

              {/* Other leagues (Federal, Players League, etc.) */}
              {otherTeams.length > 0 && (
                <Panel title={`Other Leagues (${otherTeams.length})`}>
                  <StatsTable columns={teamTableCols} rows={teamTableRows(otherTeams)} compact />
                </Panel>
              )}
            </div>

            {/* Selected Team Roster */}
            {selectedTeam && (
              <Panel title={`${selectedTeam.city} ${selectedTeam.name} — Roster`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border-2"
                      style={{ backgroundColor: selectedTeam.primaryColor, borderColor: selectedTeam.secondaryColor }}
                    />
                    <span className="text-cream font-mono text-sm">
                      {selectedTeam.wins}–{selectedTeam.losses} · {selectedTeam.league}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate('/historical/draft', {
                        state: { year: selectedYear, teams: season.teams, selectedTeam }
                      })}
                    >
                      Draft vs This Era
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedTeam(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <StatsTable columns={rosterCols} rows={rosterRows} compact />
                <p className="text-cream-dim/50 text-xs font-mono mt-2">
                  Click a team row to view roster · OVR = avg of key ratings
                </p>
              </Panel>
            )}

            {!selectedTeam && (
              <p className="text-cream-dim/40 text-xs font-mono text-center">
                Click any team to view roster
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
