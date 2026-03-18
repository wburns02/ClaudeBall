import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { MatchupPreview } from '@/components/game/MatchupPreview.tsx';
import { TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';
import { BALLPARKS, getNeutralBallpark } from '@/engine/data/ballparks.ts';
import type { Team } from '@/engine/types/team.ts';
import type { BallparkFactors } from '@/engine/types/ballpark.ts';

interface Matchup {
  away: Team;
  home: Team;
  ballpark: BallparkFactors;
  label: string;
}

// Predefined rivalry pairs (by team id)
const RIVALRIES: [string, string, string][] = [
  ['thunderhawks', 'ironclads', 'Classic Rivalry'],
  ['knights', 'tides', 'Carolina Classic'],
  ['sounds', 'rivermen', 'Heartland Series'],
  ['timber-wolves', 'aces', 'Pacific Northwest vs Desert'],
  ['pioneers', 'sluggers', 'Midwest Derby'],
  ['rebels', 'oaks', 'Southeast Showdown'],
  ['missions', 'crawdads', 'Lone Star Series'],
  ['peaks', 'surf', 'Pacific Coast Classic'],
  ['colonials', 'sandgnats', 'Atlantic Series'],
  ['gold-rush', 'sidewinders', 'Western Desert Classic'],
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function buildRandomMatchup(): Matchup {
  const seed = Date.now();
  const rng = seededRandom(seed);
  const shuffled = [...TEAMS].sort(() => rng() - 0.5);
  const away = shuffled[0];
  const home = shuffled.find(t => t.id !== away.id) ?? shuffled[1];
  const ballpark = pickRandom(BALLPARKS, rng);
  return { away, home, ballpark, label: 'Random Matchup' };
}

function buildRivalryMatchup(): Matchup {
  const seed = Date.now();
  const rng = seededRandom(seed);
  const rivalry = pickRandom(RIVALRIES, rng);
  const [awayId, homeId, label] = rivalry;
  const away = TEAMS.find(t => t.id === awayId) ?? TEAMS[0];
  const home = TEAMS.find(t => t.id === homeId) ?? TEAMS[1];
  const ballpark = pickRandom(BALLPARKS, rng);
  return { away, home, ballpark, label };
}

function buildAllStarMatchup(): Matchup {
  // Best rated players from each league
  const alIds = [
    ...Object.values(LEAGUE_STRUCTURE.American).flat()
  ];
  const nlIds = [
    ...Object.values(LEAGUE_STRUCTURE.National).flat()
  ];

  const alTeams = TEAMS.filter(t => alIds.includes(t.id));
  const nlTeams = TEAMS.filter(t => nlIds.includes(t.id));

  // Build "AL All-Stars" — take top lineup player from each team in AL
  function buildAllStarTeam(teams: Team[], id: string, name: string, abbr: string, city: string, c1: string, c2: string): Team {
    // Gather top position players (non-P) from each team
    const allPos = teams.flatMap(t =>
      t.roster.players.filter(p => p.position !== 'P')
    );
    const allPit = teams.flatMap(t =>
      t.roster.players.filter(p => p.position === 'P')
    );

    // Rank batters by contact + power avg
    const topBatters = allPos
      .sort((a, b) => {
        const ra = (a.batting.contact_L + a.batting.contact_R + a.batting.power_L + a.batting.power_R) / 4;
        const rb = (b.batting.contact_L + b.batting.contact_R + b.batting.power_L + b.batting.power_R) / 4;
        return rb - ra;
      })
      .slice(0, 13);

    const topPitchers = allPit
      .sort((a, b) => {
        const ra = (a.pitching.stuff + a.pitching.movement + a.pitching.control) / 3;
        const rb = (b.pitching.stuff + b.pitching.movement + b.pitching.control) / 3;
        return rb - ra;
      })
      .slice(0, 7);

    const allPlayers = [...topBatters, ...topPitchers];
    const sp = topPitchers[0];
    const lineup = topBatters.slice(0, 9).map(p => ({ playerId: p.id, position: p.position }));
    const bullpen = topPitchers.slice(1).map(p => p.id);
    const bench = topBatters.slice(9, 13).map(p => p.id);

    return {
      id,
      name,
      abbreviation: abbr,
      city,
      primaryColor: c1,
      secondaryColor: c2,
      roster: { players: allPlayers },
      lineup,
      pitcherId: sp?.id ?? topPitchers[0].id,
      bullpen,
      bench,
    };
  }

  const alStars = buildAllStarTeam(alTeams, 'al-allstars', 'All-Stars', 'AL', 'American League', '#003087', '#d4a843');
  const nlStars = buildAllStarTeam(nlTeams, 'nl-allstars', 'All-Stars', 'NL', 'National League', '#c8102e', '#ffffff');

  return {
    away: alStars,
    home: nlStars,
    ballpark: getNeutralBallpark(),
    label: 'MLB All-Star Game',
  };
}

type QuickMode = 'random' | 'rivalry' | 'allstar';

const MODE_INFO: Record<QuickMode, { title: string; subtitle: string; emoji: string; color: string }> = {
  random: {
    title: 'Random Matchup',
    subtitle: 'Two random teams from anywhere in the league',
    emoji: '🎲',
    color: '#9b59b6',
  },
  rivalry: {
    title: 'Rivalry Matchup',
    subtitle: 'Classic regional rivalries and historic series',
    emoji: '🔥',
    color: '#e74c3c',
  },
  allstar: {
    title: 'All-Star Game',
    subtitle: 'American League vs National League best players',
    emoji: '⭐',
    color: '#d4a843',
  },
};

export function QuickPlayPage() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<QuickMode | null>(null);
  const [matchup, setMatchup] = useState<Matchup | null>(null);

  const handleSelectMode = useCallback((mode: QuickMode) => {
    setSelectedMode(mode);
    let m: Matchup;
    if (mode === 'random') m = buildRandomMatchup();
    else if (mode === 'rivalry') m = buildRivalryMatchup();
    else m = buildAllStarMatchup();
    setMatchup(m);
  }, []);

  const handleReroll = useCallback(() => {
    if (!selectedMode) return;
    handleSelectMode(selectedMode);
  }, [selectedMode, handleSelectMode]);

  const handlePlay = useCallback(() => {
    if (!matchup) return;
    navigate('/game/live', {
      state: {
        awayTeam: JSON.parse(JSON.stringify(matchup.away)),
        homeTeam: JSON.parse(JSON.stringify(matchup.home)),
        ballpark: JSON.parse(JSON.stringify(matchup.ballpark)),
        userTeam: 'home',
        spectate: false,
      },
    });
  }, [matchup, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0f1a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top nav */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid rgba(212,168,67,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            color: 'rgba(232,224,212,0.4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ← Menu
        </button>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, color: '#d4a843', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Quick Play
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', gap: 28 }}>

        {/* Mode selector cards */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, width: '100%' }}>
          {(Object.keys(MODE_INFO) as QuickMode[]).map(mode => {
            const info = MODE_INFO[mode];
            const active = selectedMode === mode;
            return (
              <button
                key={mode}
                data-testid={`quick-mode-${mode}`}
                onClick={() => handleSelectMode(mode)}
                style={{
                  flex: '1 1 200px',
                  minWidth: 180,
                  padding: '20px 18px',
                  background: active ? `${info.color}18` : 'rgba(26,34,53,0.85)',
                  border: `2px solid ${active ? info.color : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: active ? `0 0 16px ${info.color}30` : 'none',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = info.color + '66';
                    (e.currentTarget as HTMLButtonElement).style.background = `${info.color}0c`;
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,34,53,0.85)';
                  }
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{info.emoji}</div>
                <div style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: 16,
                  color: active ? info.color : '#e8e0d4',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 5,
                }}>
                  {info.title}
                </div>
                <div style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 11,
                  color: 'rgba(232,224,212,0.45)',
                  lineHeight: 1.4,
                }}>
                  {info.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        {/* Matchup preview */}
        {matchup && selectedMode && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 720 }}>
            {/* Mode label */}
            <div style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              color: MODE_INFO[selectedMode].color,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              background: `${MODE_INFO[selectedMode].color}14`,
              border: `1px solid ${MODE_INFO[selectedMode].color}30`,
              borderRadius: 20,
              padding: '4px 16px',
            }}>
              {matchup.label}
            </div>

            <MatchupPreview
              awayTeam={matchup.away}
              homeTeam={matchup.home}
              ballpark={matchup.ballpark}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" size="md" onClick={handleReroll} data-testid="reroll-btn">
                Reroll Matchup ↻
              </Button>
              <Button size="lg" onClick={handlePlay} data-testid="play-quick-btn">
                Play Ball!
              </Button>
            </div>
          </div>
        )}

        {!selectedMode && (
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12,
            color: 'rgba(232,224,212,0.25)',
            textAlign: 'center',
            marginTop: 20,
          }}>
            Select a mode above to generate a matchup
          </div>
        )}
      </div>
    </div>
  );
}
