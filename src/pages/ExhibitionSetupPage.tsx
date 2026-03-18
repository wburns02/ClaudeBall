import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button.tsx';
import { TeamCard } from '@/components/game/TeamCard.tsx';
import { MatchupPreview } from '@/components/game/MatchupPreview.tsx';
import { TEAMS, LEAGUE_STRUCTURE } from '@/engine/data/teams30.ts';
import { BALLPARKS } from '@/engine/data/ballparks.ts';
import type { Team } from '@/engine/types/team.ts';

type UserControl = 'away' | 'home' | 'watch';

interface GameOptions {
  innings: 7 | 9;
  dh: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
}

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

// Build league → division → team mapping for the selector
const LEAGUE_ORDER = ['American', 'National'] as const;
const DIVISION_ORDER = ['East', 'Central', 'West'] as const;

export function ExhibitionSetupPage() {
  const navigate = useNavigate();

  const [awayTeam, setAwayTeam] = useState<Team>(TEAMS[0]);
  const [homeTeam, setHomeTeam] = useState<Team>(TEAMS[1]);
  const [ballparkId, setBallparkId] = useState<string>(BALLPARKS[0].id);
  const [userControl, setUserControl] = useState<UserControl>('away');
  const [options, setOptions] = useState<GameOptions>({ innings: 9, dh: true, difficulty: 'normal' });
  const [teamTab, setTeamTab] = useState<'away' | 'home'>('away');
  const [search, setSearch] = useState('');
  const [step, setStep] = useState<'setup' | 'preview'>('setup');

  const ballpark = useMemo(() => BALLPARKS.find(b => b.id === ballparkId) ?? BALLPARKS[0], [ballparkId]);

  // Filter teams by search
  const filteredTeams = useMemo(() => {
    if (!search.trim()) return TEAMS;
    const q = search.toLowerCase();
    return TEAMS.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.abbreviation.toLowerCase().includes(q)
    );
  }, [search]);

  const handleTeamSelect = (team: Team) => {
    if (teamTab === 'away') {
      setAwayTeam(team);
      if (team.id === homeTeam.id) setHomeTeam(TEAMS.find(t => t.id !== team.id) ?? TEAMS[1]);
    } else {
      setHomeTeam(team);
      if (team.id === awayTeam.id) setAwayTeam(TEAMS.find(t => t.id !== team.id) ?? TEAMS[0]);
    }
  };

  const handlePlayBall = () => {
    navigate('/game/live', {
      state: {
        awayTeam: JSON.parse(JSON.stringify(awayTeam)),
        homeTeam: JSON.parse(JSON.stringify(homeTeam)),
        ballpark: JSON.parse(JSON.stringify(ballpark)),
        userTeam: userControl === 'watch' ? 'home' : userControl,
        spectate: userControl === 'watch',
        options,
      },
    });
  };

  const headerStyle: React.CSSProperties = {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'rgba(232,224,212,0.35)',
    marginBottom: 8,
  };

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
          Exhibition Setup
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {step === 'preview' && (
            <Button variant="ghost" size="sm" onClick={() => setStep('setup')}>
              ← Back
            </Button>
          )}
          {step === 'setup' && (
            <Button size="md" onClick={() => setStep('preview')} data-testid="preview-btn">
              Preview Matchup →
            </Button>
          )}
          {step === 'preview' && (
            <Button size="md" onClick={handlePlayBall} data-testid="play-ball-btn">
              Play Ball!
            </Button>
          )}
        </div>
      </div>

      {step === 'setup' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* LEFT COLUMN: Team grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            {/* Team selector tabs */}
            <div style={{ padding: '16px 20px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
                {(['away', 'home'] as const).map(side => (
                  <button
                    key={side}
                    onClick={() => setTeamTab(side)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: teamTab === side ? '#d4a843' : 'rgba(232,224,212,0.4)',
                      background: teamTab === side ? 'rgba(212,168,67,0.08)' : 'transparent',
                      border: 'none',
                      borderBottom: teamTab === side ? '2px solid #d4a843' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {side === 'away' ? `Away: ${awayTeam.abbreviation}` : `Home: ${homeTeam.abbreviation}`}
                  </button>
                ))}
              </div>
              {/* Search */}
              <input
                type="text"
                placeholder="Search teams..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  marginBottom: 12,
                  padding: '7px 12px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#e8e0d4',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Team list, grouped by league/division */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {search.trim() ? (
                /* Flat filtered list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredTeams.map(team => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      compact
                      selected={teamTab === 'away' ? team.id === awayTeam.id : team.id === homeTeam.id}
                      onClick={() => handleTeamSelect(team)}
                    />
                  ))}
                  {filteredTeams.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'rgba(232,224,212,0.3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, marginTop: 40 }}>
                      No teams found
                    </div>
                  )}
                </div>
              ) : (
                /* Grouped by league/division */
                LEAGUE_ORDER.map(league => (
                  <div key={league} style={{ marginBottom: 20 }}>
                    <div style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 10,
                      color: '#d4a843',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      marginBottom: 10,
                      paddingBottom: 4,
                      borderBottom: '1px solid rgba(212,168,67,0.15)',
                    }}>
                      {league} League
                    </div>
                    {DIVISION_ORDER.map(div => {
                      const teamIds = LEAGUE_STRUCTURE[league]?.[div] ?? [];
                      const divTeams = teamIds.map(id => TEAMS.find(t => t.id === id)).filter(Boolean) as Team[];
                      if (!divTeams.length) return null;
                      return (
                        <div key={div} style={{ marginBottom: 14 }}>
                          <div style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: 9,
                            color: 'rgba(232,224,212,0.3)',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            marginBottom: 5,
                          }}>
                            {div}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {divTeams.map(team => (
                              <TeamCard
                                key={team.id}
                                team={team}
                                compact
                                selected={teamTab === 'away' ? team.id === awayTeam.id : team.id === homeTeam.id}
                                onClick={() => handleTeamSelect(team)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Options */}
          <div style={{ width: 320, display: 'flex', flexDirection: 'column', padding: '20px 22px', gap: 24, overflowY: 'auto' }}>

            {/* Selected teams summary */}
            <div>
              <div style={headerStyle}>Matchup</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: `${awayTeam.primaryColor}22`,
                  border: `1px solid ${awayTeam.primaryColor}44`,
                  borderRadius: 8,
                }}>
                  <div style={{ width: 4, height: 28, background: `linear-gradient(to bottom, ${awayTeam.primaryColor}, ${awayTeam.secondaryColor})`, borderRadius: 2 }} />
                  <div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.4)', letterSpacing: '0.1em' }}>AWAY</div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: '#e8e0d4', textTransform: 'uppercase' }}>{awayTeam.city} {awayTeam.name}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontFamily: 'Oswald, sans-serif', fontSize: 13, color: 'rgba(212,168,67,0.4)' }}>AT</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: `${homeTeam.primaryColor}22`,
                  border: `1px solid ${homeTeam.primaryColor}44`,
                  borderRadius: 8,
                }}>
                  <div style={{ width: 4, height: 28, background: `linear-gradient(to bottom, ${homeTeam.primaryColor}, ${homeTeam.secondaryColor})`, borderRadius: 2 }} />
                  <div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'rgba(232,224,212,0.4)', letterSpacing: '0.1em' }}>HOME</div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 15, color: '#e8e0d4', textTransform: 'uppercase' }}>{homeTeam.city} {homeTeam.name}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ballpark */}
            <div>
              <div style={headerStyle}>Ballpark</div>
              <select
                value={ballparkId}
                onChange={e => setBallparkId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 12,
                  background: 'rgba(26,34,53,0.9)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  color: '#e8e0d4',
                  cursor: 'pointer',
                }}
              >
                {BALLPARKS.map(bp => (
                  <option key={bp.id} value={bp.id}>{bp.name}</option>
                ))}
              </select>
              {/* Ballpark factor badges */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'HR', val: ballpark.hr },
                  { label: 'XBH', val: ballpark.doubles },
                  { label: 'SO', val: ballpark.so },
                ].map(({ label, val }) => {
                  const color = val > 1.05 ? '#e74c3c' : val < 0.95 ? '#27ae60' : 'rgba(232,224,212,0.35)';
                  return (
                    <div key={label} style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 10,
                      color,
                      background: `${color}14`,
                      border: `1px solid ${color}30`,
                      borderRadius: 4,
                      padding: '3px 8px',
                    }}>
                      {label} {val > 1 ? '+' : ''}{Math.round((val - 1) * 100)}%
                    </div>
                  );
                })}
              </div>
            </div>

            {/* You play as */}
            <div>
              <div style={headerStyle}>You Control</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {([
                  ['away', `Away — ${awayTeam.city} ${awayTeam.name}`],
                  ['home', `Home — ${homeTeam.city} ${homeTeam.name}`],
                  ['watch', 'Watch — CPU vs CPU'],
                ] as [UserControl, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setUserControl(val)}
                    style={{
                      padding: '9px 14px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 12,
                      textAlign: 'left',
                      background: userControl === val ? 'rgba(212,168,67,0.12)' : 'rgba(26,34,53,0.6)',
                      border: `1px solid ${userControl === val ? '#d4a843' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 7,
                      color: userControl === val ? '#d4a843' : 'rgba(232,224,212,0.6)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {userControl === val ? '● ' : '○ '}{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Game Options */}
            <div>
              <div style={headerStyle}>Game Options</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Innings */}
                <div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(232,224,212,0.4)', marginBottom: 5 }}>Innings</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {([7, 9] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setOptions(o => ({ ...o, innings: n }))}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontSize: 13,
                          background: options.innings === n ? 'rgba(212,168,67,0.15)' : 'rgba(26,34,53,0.6)',
                          border: `1px solid ${options.innings === n ? '#d4a843' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 6,
                          color: options.innings === n ? '#d4a843' : 'rgba(232,224,212,0.5)',
                          cursor: 'pointer',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DH Rule */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(232,224,212,0.4)' }}>
                    DH Rule
                  </div>
                  <button
                    onClick={() => setOptions(o => ({ ...o, dh: !o.dh }))}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: options.dh ? '#d4a843' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 3,
                      left: options.dh ? 22 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>

                {/* Difficulty */}
                <div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(232,224,212,0.4)', marginBottom: 5 }}>Difficulty</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['easy', 'normal', 'hard'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setOptions(o => ({ ...o, difficulty: d }))}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontSize: 11,
                          background: options.difficulty === d ? 'rgba(212,168,67,0.15)' : 'rgba(26,34,53,0.6)',
                          border: `1px solid ${options.difficulty === d ? '#d4a843' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 6,
                          color: options.difficulty === d ? '#d4a843' : 'rgba(232,224,212,0.5)',
                          cursor: 'pointer',
                        }}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Play button */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <Button
                size="lg"
                className="w-full"
                onClick={() => setStep('preview')}
                data-testid="preview-btn-sidebar"
              >
                Preview Matchup →
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          gap: 28,
        }}>
          <MatchupPreview awayTeam={awayTeam} homeTeam={homeTeam} ballpark={ballpark} />

          {/* Options summary */}
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {[
              { label: 'Innings', val: `${options.innings}` },
              { label: 'DH', val: options.dh ? 'On' : 'Off' },
              { label: 'Difficulty', val: DIFFICULTY_LABELS[options.difficulty] },
              { label: 'You Play', val: userControl === 'watch' ? 'CPU vs CPU' : userControl === 'away' ? `Away (${awayTeam.abbreviation})` : `Home (${homeTeam.abbreviation})` },
            ].map(({ label, val }) => (
              <div key={label} style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                color: 'rgba(232,224,212,0.6)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '5px 12px',
              }}>
                <span style={{ color: 'rgba(212,168,67,0.7)' }}>{label}:</span> {val}
              </div>
            ))}
          </div>

          <Button size="lg" onClick={handlePlayBall} data-testid="play-ball-btn">
            Play Ball!
          </Button>
        </div>
      )}
    </div>
  );
}
