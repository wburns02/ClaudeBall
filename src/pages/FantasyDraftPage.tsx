import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import type { HistoricalTeam } from '@/engine/data/lahmanLoader.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Team } from '@/engine/types/team.ts';
import type { Position } from '@/engine/types/enums.ts';
import { getHistoricalSeason } from '@/engine/data/lahmanLoader.ts';

// ── Types ─────────────────────────────────────────────────────────────────

interface DraftablePlayer {
  player: Player;
  teamId: string;
  teamName: string;
  overallRating: number;
  isDrafted: boolean;
  draftedBy: 'user' | 'ai' | null;
  draftRound: number | null;
  draftPick: number | null;
}

type SortKey = 'name' | 'pos' | 'team' | 'rating' | 'age';

interface LocationState {
  year?: number;
  teams?: HistoricalTeam[];
  selectedTeam?: HistoricalTeam;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ROSTER_SPOTS = 22; // total players to draft per team
const USER_TEAM_NAME = 'All-Stars';
const AI_TEAM_NAME = 'Legends';

function calcOverall(p: Player): number {
  if (p.position === 'P') {
    return Math.round((p.pitching.stuff * 0.35 + p.pitching.control * 0.35 + p.pitching.movement * 0.3));
  }
  return Math.round(
    (p.batting.contact_R * 0.2 +
     p.batting.power_R * 0.2 +
     p.batting.eye * 0.2 +
     p.batting.speed * 0.15 +
     p.batting.avoid_k * 0.15 +
     p.batting.clutch * 0.1)
  );
}

function autoPickBest(available: DraftablePlayer[], aiRoster: DraftablePlayer[]): DraftablePlayer | null {
  // AI prioritizes filling positional needs, then picks best available
  const aiPositions = aiRoster.map(d => d.player.position);
  const needsPositions: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P'];
  const unfilled = needsPositions.filter(pos => !aiPositions.includes(pos));

  // First: fill critical needs
  if (unfilled.length > 0) {
    for (const pos of unfilled) {
      const candidate = available
        .filter(d => d.player.position === pos)
        .sort((a, b) => b.overallRating - a.overallRating)[0];
      if (candidate) return candidate;
    }
  }

  // Otherwise: pick best available (excluding pitchers if we have enough)
  const pitcherCount = aiRoster.filter(d => d.player.position === 'P').length;
  let pool = available;
  if (pitcherCount >= 5) {
    pool = available.filter(d => d.player.position !== 'P');
  }
  if (pool.length === 0) pool = available;
  return pool.sort((a, b) => b.overallRating - a.overallRating)[0] ?? null;
}

// Build a valid Team object from drafted players
function buildTeamFromDraft(
  id: string,
  name: string,
  city: string,
  color: string,
  players: Player[]
): Team {
  const posPlayers = players.filter(p => p.position !== 'P');
  const pitchers = players.filter(p => p.position === 'P');

  const posOrder: Position[] = ['CF', 'SS', '2B', '1B', '3B', 'LF', 'RF', 'C', 'DH'];
  const lineup: { playerId: string; position: Position }[] = [];
  const usedIds = new Set<string>();

  for (const pos of posOrder) {
    const found = posPlayers.find(p => p.position === pos && !usedIds.has(p.id));
    if (found && lineup.length < 9) {
      lineup.push({ playerId: found.id, position: pos });
      usedIds.add(found.id);
    }
  }
  // Fill remaining spots
  for (const p of posPlayers) {
    if (lineup.length >= 9) break;
    if (!usedIds.has(p.id)) {
      lineup.push({ playerId: p.id, position: p.position as Position });
      usedIds.add(p.id);
    }
  }

  const starters = pitchers
    .filter(p => p.pitching.stamina >= 50)
    .sort((a, b) => b.pitching.stuff - a.pitching.stuff);
  const relievers = pitchers
    .filter(p => p.pitching.stamina < 50)
    .sort((a, b) => b.pitching.stuff - a.pitching.stuff);

  const sp = starters[0] ?? pitchers[0];
  const bullpen = [...starters.slice(1), ...relievers].map(p => p.id);

  return {
    id,
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    city,
    primaryColor: color,
    secondaryColor: '#d4a843',
    roster: { players },
    lineup: lineup.slice(0, 9),
    pitcherId: sp?.id ?? players[0]?.id ?? '',
    bullpen,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

export function FantasyDraftPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const year = state?.year ?? 1998;

  const [allPlayers, setAllPlayers] = useState<DraftablePlayer[]>([]);
  const [userRoster, setUserRoster] = useState<DraftablePlayer[]>([]);
  const [aiRoster, setAiRoster] = useState<DraftablePlayer[]>([]);
  const aiRosterRef = useRef<DraftablePlayer[]>([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [draftComplete, setDraftComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('rating');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const totalPicks = ROSTER_SPOTS * 2; // user + AI

  /**
   * Snake draft with 2 teams, ROSTER_SPOTS rounds:
   * Round 1 (odd): picks 1(user), 2(AI)
   * Round 2 (even): picks 3(AI), 4(user)
   * Round 3 (odd): picks 5(user), 6(AI)
   * Pattern: pick is user's if (round is odd AND slot=1) OR (round is even AND slot=2)
   */
  function isUserTurn(pick: number): boolean {
    if (pick > totalPicks) return false;
    const round = Math.ceil(pick / 2);            // which round (1-based)
    const slotInRound = ((pick - 1) % 2) + 1;    // 1 or 2
    if (round % 2 === 1) return slotInRound === 1; // odd round: user is slot 1
    return slotInRound === 2;                      // even round: user is slot 2
  }

  // AI auto-pick effect: runs whenever currentPick advances to an AI turn
  useEffect(() => {
    if (loading) return;
    if (draftComplete) return;
    if (currentPick > totalPicks) return;
    if (isUserTurn(currentPick)) return; // user's turn — wait for input

    const timer = setTimeout(() => {
      setAllPlayers(prev => {
        const available = prev.filter(d => !d.isDrafted);
        const aiCurrentRoster = aiRosterRef.current;
        const aiPick = autoPickBest(available, aiCurrentRoster);
        if (!aiPick) {
          setDraftComplete(true);
          return prev;
        }

        const round = Math.ceil(currentPick / 2);
        const aiUpdated: DraftablePlayer = {
          ...aiPick,
          isDrafted: true,
          draftedBy: 'ai',
          draftRound: round,
          draftPick: currentPick,
        };

        aiRosterRef.current = [...aiRosterRef.current, aiUpdated];
        setAiRoster(aiRosterRef.current);

        const nextPick = currentPick + 1;
        setCurrentPick(nextPick);
        if (nextPick > totalPicks) setDraftComplete(true);

        return prev.map(d => d.player.id === aiPick.player.id ? aiUpdated : d);
      });
    }, 400);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPick, loading, draftComplete]);

  // Load players
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let teams: HistoricalTeam[];
        if (state?.teams && state.teams.length > 0) {
          teams = state.teams;
        } else {
          const season = await getHistoricalSeason(year);
          teams = season.teams;
        }

        const players: DraftablePlayer[] = [];
        // Track player IDs across teams — keep highest-rating entry for players who appeared on multiple teams
        const seenPlayerIds = new Map<string, number>(); // playerID → index in players array

        for (const team of teams) {
          for (const player of team.roster.players) {
            const ovr = calcOverall(player);
            const existing = seenPlayerIds.get(player.id);
            if (existing !== undefined) {
              // Keep the one with higher OVR (more playing time)
              if (ovr > players[existing].overallRating) {
                players[existing] = {
                  player,
                  teamId: team.id,
                  teamName: `${team.city} ${team.name}`,
                  overallRating: ovr,
                  isDrafted: false,
                  draftedBy: null,
                  draftRound: null,
                  draftPick: null,
                };
              }
              continue;
            }
            seenPlayerIds.set(player.id, players.length);
            players.push({
              player,
              teamId: team.id,
              teamName: `${team.city} ${team.name}`,
              overallRating: ovr,
              isDrafted: false,
              draftedBy: null,
              draftRound: null,
              draftPick: null,
            });
          }
        }

        // Sort by overall rating descending
        players.sort((a, b) => b.overallRating - a.overallRating);
        setAllPlayers(players);
      } catch (e) {
        console.error('Failed to load draft pool:', e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [year, state?.teams, state]);

  // Available players
  const availablePlayers = useMemo(() =>
    allPlayers.filter(d => !d.isDrafted),
    [allPlayers]
  );

  // Filtered + sorted display pool
  const displayPlayers = useMemo(() => {
    let pool = availablePlayers;

    if (posFilter !== 'ALL') {
      pool = pool.filter(d => d.player.position === posFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter(d =>
        `${d.player.firstName} ${d.player.lastName}`.toLowerCase().includes(q) ||
        d.teamName.toLowerCase().includes(q)
      );
    }

    pool = [...pool].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'name': va = a.player.lastName; vb = b.player.lastName; break;
        case 'pos': va = a.player.position; vb = b.player.position; break;
        case 'team': va = a.teamName; vb = b.teamName; break;
        case 'age': va = a.player.age; vb = b.player.age; break;
        default: va = a.overallRating; vb = b.overallRating; break;
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === 'asc' ? va - (vb as number) : (vb as number) - va;
    });

    return pool;
  }, [availablePlayers, posFilter, searchQuery, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function draftPlayer(draftable: DraftablePlayer) {
    if (draftComplete || !isUserTurn(currentPick)) return;

    const round = Math.ceil(currentPick / 2);
    const updated: DraftablePlayer = {
      ...draftable,
      isDrafted: true,
      draftedBy: 'user',
      draftRound: round,
      draftPick: currentPick,
    };

    setAllPlayers(prev => prev.map(d => d.player.id === draftable.player.id ? updated : d));
    setUserRoster(prev => [...prev, updated]);

    // Advance pick — AI auto-pick useEffect will trigger if next pick is AI's turn
    const nextPick = currentPick + 1;
    setCurrentPick(nextPick);
    if (nextPick > totalPicks) setDraftComplete(true);
  }

  function startGame() {
    if (!draftComplete) return;

    const userTeam = buildTeamFromDraft(
      'draft-user',
      USER_TEAM_NAME,
      'Fantasy',
      '#1a3a5c',
      userRoster.map(d => d.player)
    );
    const aiTeam = buildTeamFromDraft(
      'draft-ai',
      AI_TEAM_NAME,
      'Legend',
      '#3a1a1a',
      aiRoster.map(d => d.player)
    );

    navigate('/game/live', { state: { awayTeam: userTeam, homeTeam: aiTeam } });
  }

  const round = Math.ceil(currentPick / 2);
  const userTurn = isUserTurn(currentPick);
  const userPitchers = userRoster.filter(d => d.player.position === 'P').length;
  const userPositional = userRoster.filter(d => d.player.position !== 'P').length;

  // Table rows
  const tableRows = displayPlayers.slice(0, 200).map(d => ({
    name: (
      <button
        onClick={() => !draftComplete && userTurn && draftPlayer(d)}
        className={`text-left w-full font-mono text-sm transition-colors ${
          draftComplete || !userTurn
            ? 'text-cream-dim cursor-not-allowed'
            : 'text-cream hover:text-gold cursor-pointer'
        }`}
        disabled={draftComplete || !userTurn}
      >
        {d.player.firstName} {d.player.lastName}
      </button>
    ),
    pos: <span className="text-gold-dim font-mono text-xs">{d.player.position}</span>,
    team: <span className="text-cream-dim text-xs">{d.teamName.split(' ').slice(-1)[0]}</span>,
    age: d.player.age,
    rating: (
      <span className={`font-mono font-semibold ${
        d.overallRating >= 75 ? 'text-gold' :
        d.overallRating >= 60 ? 'text-green-400' :
        d.overallRating >= 45 ? 'text-cream' : 'text-cream-dim'
      }`}>
        {d.overallRating}
      </span>
    ),
    draft: (
      <Button
        size="sm"
        onClick={() => draftPlayer(d)}
        disabled={draftComplete || !userTurn}
        className="text-xs px-2 py-1"
      >
        Draft
      </Button>
    ),
  }));

  const tableCols = [
    { key: 'name', label: 'Player', align: 'left' as const },
    { key: 'pos', label: 'POS', align: 'center' as const, width: '55px' },
    { key: 'team', label: 'Team', align: 'left' as const, width: '90px' },
    { key: 'age', label: 'Age', align: 'center' as const, width: '50px' },
    { key: 'rating', label: 'OVR', align: 'center' as const, width: '55px' },
    { key: 'draft', label: '', align: 'center' as const, width: '70px' },
  ];

  // Roster display rows
  function rosterRows(roster: DraftablePlayer[]) {
    return roster.map(d => ({
      rd: <span className="text-cream-dim text-xs font-mono">{d.draftRound}</span>,
      name: `${d.player.firstName} ${d.player.lastName}`,
      pos: d.player.position,
      ovr: d.overallRating,
    }));
  }

  const rosterCols = [
    { key: 'rd', label: 'Rd', align: 'center' as const, width: '40px' },
    { key: 'name', label: 'Player', align: 'left' as const },
    { key: 'pos', label: 'POS', align: 'center' as const, width: '55px' },
    { key: 'ovr', label: 'OVR', align: 'center' as const, width: '55px' },
  ];

  const positions = ['ALL', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-cream-dim font-mono">Loading {year} player pool...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-gold tracking-tight uppercase">Fantasy Draft</h1>
            <p className="text-cream-dim text-sm font-mono">{year} Player Pool · Snake Draft · {ROSTER_SPOTS} rounds</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/historical')}>← Historical</Button>
        </div>

        {/* Draft Status Bar */}
        <Panel>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-cream-dim text-xs font-mono uppercase tracking-wider">Round</p>
                <p className="text-gold font-display text-2xl">{Math.min(round, ROSTER_SPOTS)} / {ROSTER_SPOTS}</p>
              </div>
              <div>
                <p className="text-cream-dim text-xs font-mono uppercase tracking-wider">Pick</p>
                <p className="text-cream font-display text-2xl">{Math.min(currentPick, totalPicks)} / {totalPicks}</p>
              </div>
              <div>
                <p className="text-cream-dim text-xs font-mono uppercase tracking-wider">Now Picking</p>
                <p className={`font-display text-xl ${draftComplete ? 'text-green-400' : userTurn ? 'text-gold' : 'text-blue-400'}`}>
                  {draftComplete ? 'DRAFT COMPLETE' : userTurn ? `You (${USER_TEAM_NAME})` : `CPU (${AI_TEAM_NAME})`}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {draftComplete && (
                <Button onClick={startGame} size="md">
                  Play Game →
                </Button>
              )}
              {!draftComplete && userTurn && (
                <p className="text-gold text-sm font-mono animate-pulse">Your pick!</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-navy rounded-full overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-300"
              style={{ width: `${Math.min(100, ((currentPick - 1) / totalPicks) * 100)}%` }}
            />
          </div>
        </Panel>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Player Pool */}
          <div className="xl:col-span-2 space-y-3">
            <Panel title={`Available Players (${availablePlayers.length})`}>
              {/* Filters */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {positions.map(pos => (
                    <button
                      key={pos}
                      onClick={() => setPosFilter(pos)}
                      className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                        posFilter === pos
                          ? 'bg-gold text-navy border-gold font-semibold'
                          : 'bg-navy-lighter border-navy-lighter text-cream-dim hover:text-cream'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-navy border border-navy-lighter rounded px-3 py-1.5 text-cream font-mono text-sm focus:border-gold/60 focus:outline-none"
                />
                <div className="flex gap-2 text-xs font-mono text-cream-dim/60">
                  {(['name', 'pos', 'team', 'age', 'rating'] as SortKey[]).map(k => (
                    <button
                      key={k}
                      onClick={() => handleSort(k)}
                      className={`hover:text-cream transition-colors ${sortKey === k ? 'text-gold' : ''}`}
                    >
                      {k} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  ))}
                </div>
              </div>

              <StatsTable columns={tableCols} rows={tableRows} compact />

              {displayPlayers.length > 200 && (
                <p className="text-cream-dim/50 text-xs font-mono mt-2 text-center">
                  Showing top 200 — use filters to narrow
                </p>
              )}
            </Panel>
          </div>

          {/* Rosters */}
          <div className="space-y-4">
            {/* Your roster */}
            <Panel title={`Your Team — ${USER_TEAM_NAME} (${userRoster.length}/${ROSTER_SPOTS})`}>
              <div className="flex gap-3 mb-2 text-xs font-mono text-cream-dim">
                <span>Pos: {userPositional}</span>
                <span>P: {userPitchers}</span>
              </div>
              {userRoster.length > 0 ? (
                <StatsTable columns={rosterCols} rows={rosterRows(userRoster)} compact />
              ) : (
                <p className="text-cream-dim/50 text-xs font-mono text-center py-4">No picks yet</p>
              )}
            </Panel>

            {/* AI roster */}
            <Panel title={`CPU Team — ${AI_TEAM_NAME} (${aiRoster.length}/${ROSTER_SPOTS})`}>
              {aiRoster.length > 0 ? (
                <StatsTable columns={rosterCols} rows={rosterRows(aiRoster)} compact />
              ) : (
                <p className="text-cream-dim/50 text-xs font-mono text-center py-4">No picks yet</p>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
