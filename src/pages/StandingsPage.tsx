import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { winPct, gamesBehind, runDifferential, streakStr, last10Str } from '@/engine/season/index.ts';
import type { TeamRecord, DivisionStandings } from '@/engine/season/index.ts';
import type { SeasonEngine } from '@/engine/season/SeasonEngine.ts';
import { cn } from '@/lib/cn.ts';

// ── Playoff math helpers ────────────────────────────────────────────────────

/** Games behind as a float (negative = ahead) */
function gbFloat(leader: TeamRecord, team: TeamRecord): number {
  return ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
}

/** Games remaining per team based on standard 162-game schedule. */
function approxGamesLeft(_currentDay: number, _totalDays: number, gamesPlayed: number): number {
  return Math.max(0, 162 - gamesPlayed);
}

/**
 * Simple playoff probability (0–1).
 * For division leaders: based on games ahead vs games remaining.
 * For chasers: based on games behind vs games remaining.
 */
function playoffProb(
  team: TeamRecord,
  leader: TeamRecord,
  gamesRemaining: number,
): number {
  if (gamesRemaining <= 0) return 0;
  const gb = gbFloat(leader, team);
  if (gb > gamesRemaining) return 0; // mathematically eliminated
  if (team.teamId === leader.teamId) {
    // Leader: probability of maintaining lead
    const lead = Math.abs(gb); // gb is 0 for leader, we compare vs 2nd place
    const clinchRatio = gamesRemaining > 0 ? lead / gamesRemaining : 1;
    return Math.min(0.99, 0.5 + clinchRatio * 0.5);
  }
  // Chaser: diminishing odds as GB increases vs games left
  const catchupRatio = 1 - gb / gamesRemaining;
  return Math.max(0, Math.min(0.92, catchupRatio * catchupRatio * 0.6));
}

/** Magic number for division leader vs 2nd place (or vs given challenger) */
function magicNumber(leader: TeamRecord, secondPlace: TeamRecord, gamesRemaining: number): number {
  if (leader.teamId === secondPlace.teamId) return gamesRemaining + 1;
  const mn = gamesRemaining + 1 - (secondPlace.wins - leader.wins);
  return Math.max(1, mn);
}

/** Elimination number: how many wins the trailing team needs to be eliminated */
function elimNumber(leader: TeamRecord, team: TeamRecord, gamesRemaining: number): number {
  const gb = gbFloat(leader, team);
  return Math.max(0, gamesRemaining - Math.floor(gb) + 1);
}

// ── Visual components ───────────────────────────────────────────────────────

function ProbBar({ prob, isUser }: { prob: number; isUser: boolean }) {
  const pct = Math.round(prob * 100);
  const color = prob >= 0.85 ? 'bg-green-light' : prob >= 0.50 ? 'bg-gold' : prob >= 0.20 ? 'bg-cream-dim' : 'bg-red-400/50';
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="w-20 h-1.5 bg-navy-lighter rounded-full overflow-hidden shrink-0">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color, isUser && 'ring-1 ring-white/30')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        'font-mono text-xs tabular-nums shrink-0',
        prob >= 0.85 ? 'text-green-light' : prob >= 0.50 ? 'text-gold' : prob >= 0.20 ? 'text-cream-dim' : 'text-red-400',
      )}>
        {pct}%
      </span>
    </div>
  );
}

function MagicNumberBadge({ mn, gamesPlayed }: { mn: number; gamesPlayed: number }) {
  if (gamesPlayed < 10) return null; // too early in season
  if (mn <= 0) return <span className="font-mono text-xs text-green-light font-bold">CLINCHED</span>;
  if (mn > 100) return null; // too far from clinching to show
  return (
    <span className={cn(
      'font-mono text-xs font-bold px-1.5 py-0.5 rounded',
      mn <= 5 ? 'bg-green-light/20 text-green-light' :
      mn <= 15 ? 'bg-gold/20 text-gold' :
      'text-cream-dim/40',
    )}>
      M{mn}
    </span>
  );
}

// ── Playoff Picture Panel ───────────────────────────────────────────────────

function PlayoffPicturePanel({
  divisions,
  userTeamId,
  gamesRemaining,
  gamesPlayed,
  engine,
}: {
  divisions: DivisionStandings[];
  userTeamId: string | null;
  gamesRemaining: number;
  gamesPlayed: number;
  engine: SeasonEngine;
}) {
  // Collect division leaders and wild card teams per league
  const byLeague: Record<string, { leaders: TeamRecord[]; wildCards: TeamRecord[] }> = {};

  for (const div of divisions) {
    if (!byLeague[div.league]) byLeague[div.league] = { leaders: [], wildCards: [] };
    if (div.teams.length > 0) {
      byLeague[div.league].leaders.push(div.teams[0]);
    }
  }

  // Wild card: top 2 non-leaders per league sorted by win pct
  for (const [league, data] of Object.entries(byLeague)) {
    const leaderIds = new Set(data.leaders.map(t => t.teamId));
    const leagueDivisions = divisions.filter(d => d.league === league);
    const nonLeaders: TeamRecord[] = [];
    for (const div of leagueDivisions) {
      for (const t of div.teams.slice(1)) nonLeaders.push(t);
    }
    const sorted = nonLeaders.sort((a, b) => {
      const pa = a.wins / (a.wins + a.losses || 1);
      const pb = b.wins / (b.wins + b.losses || 1);
      return pb - pa;
    });
    data.wildCards = sorted.slice(0, 2);
    void leaderIds;
  }

  return (
    <Panel title="Playoff Picture" className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(byLeague).map(([league, { leaders, wildCards }]) => (
          <div key={league}>
            <p className="font-mono text-xs text-gold uppercase tracking-wider mb-3">{league}</p>
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono text-cream-dim/40 uppercase tracking-wider">Division Leaders</p>
              {leaders.map(t => {
                const team = engine.getTeam(t.teamId);
                const isUser = t.teamId === userTeamId;
                const prob = playoffProb(t, t, gamesRemaining); // leader vs itself = high prob
                // Find second place in their division
                const theirDiv = divisions.find(d => d.league === league && d.teams.some(x => x.teamId === t.teamId));
                const second = theirDiv?.teams[1];
                const mn = second ? magicNumber(t, second, gamesRemaining) : 1;
                return (
                  <div key={t.teamId} className={cn(
                    'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border',
                    isUser ? 'border-gold/40 bg-gold/5' : 'border-navy-lighter/50 bg-navy-lighter/10',
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-cream-dim/30 w-4 text-center">✦</span>
                      <span className={cn('font-mono text-sm font-bold truncate', isUser ? 'text-gold' : 'text-cream')}>
                        {team?.abbreviation ?? t.teamId}
                      </span>
                      <span className="font-mono text-xs text-cream-dim">{t.wins}-{t.losses}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <MagicNumberBadge mn={mn} gamesPlayed={gamesPlayed} />
                      <ProbBar prob={Math.min(0.99, 0.5 + (second ? gbFloat(t, second) / Math.max(1, gamesRemaining) : 0) * 0.5)} isUser={isUser} />
                    </div>
                  </div>
                );
              })}

              <p className="text-[10px] font-mono text-cream-dim/40 uppercase tracking-wider mt-2">Wild Card</p>
              {wildCards.map((t, idx) => {
                const team = engine.getTeam(t.teamId);
                const isUser = t.teamId === userTeamId;
                const nextWC = wildCards[idx + 1];
                const prob = nextWC ? playoffProb(t, t, gamesRemaining) * 0.7 : 0.6;
                return (
                  <div key={t.teamId} className={cn(
                    'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border',
                    isUser ? 'border-gold/40 bg-gold/5' : 'border-navy-lighter/30 bg-navy-lighter/5',
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-cream-dim/30 w-4 text-center">WC</span>
                      <span className={cn('font-mono text-sm font-bold truncate', isUser ? 'text-gold' : 'text-cream')}>
                        {team?.abbreviation ?? t.teamId}
                      </span>
                      <span className="font-mono text-xs text-cream-dim">{t.wins}-{t.losses}</span>
                    </div>
                    <ProbBar prob={prob} isUser={isUser} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Wild Card Race Panel ─────────────────────────────────────────────────────

function WildCardRace({
  divisions,
  userTeamId,
  gamesRemaining,
  engine,
}: {
  divisions: DivisionStandings[];
  userTeamId: string | null;
  gamesRemaining: number;
  engine: SeasonEngine;
}) {
  const byLeague: Record<string, TeamRecord[]> = {};

  for (const div of divisions) {
    if (!byLeague[div.league]) byLeague[div.league] = [];
    // Add non-leaders from each division
    for (const t of div.teams.slice(1)) byLeague[div.league].push(t);
  }

  return (
    <Panel title="Wild Card Race" className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(byLeague).map(([league, teams]) => {
          const sorted = [...teams].sort((a, b) => {
            const pa = a.wins / (a.wins + a.losses || 1);
            const pb = b.wins / (b.wins + b.losses || 1);
            return pb - pa;
          });

          const wcLeader = sorted[0];

          return (
            <div key={league}>
              <p className="font-mono text-xs text-gold uppercase tracking-wider mb-2">{league}</p>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 px-1 pb-1">
                  <span className="font-mono text-[10px] text-cream-dim/30 w-8">WC</span>
                  <span className="font-mono text-[10px] text-cream-dim/40 flex-1">Team</span>
                  <span className="font-mono text-[10px] text-cream-dim/40 w-12 text-right">W-L</span>
                  <span className="font-mono text-[10px] text-cream-dim/40 w-10 text-right">GB</span>
                  <span className="font-mono text-[10px] text-cream-dim/40 w-24 text-right">Prob</span>
                </div>
                {sorted.slice(0, 6).map((t, idx) => {
                  const team = engine.getTeam(t.teamId);
                  const isUser = t.teamId === userTeamId;
                  const gb = idx === 0 ? '—' : gamesBehind(wcLeader, t);
                  const prob = idx === 0 ? 0.70 : idx === 1 ? 0.45 : playoffProb(t, wcLeader, gamesRemaining);
                  const isWCSpot = idx < 2;
                  return (
                    <div key={t.teamId} className={cn(
                      'flex items-center gap-2 px-1 py-1 rounded transition-colors',
                      isUser && 'bg-gold/5',
                      idx === 1 && 'border-b border-navy-lighter/40 pb-2 mb-1',
                    )}>
                      <span className={cn(
                        'font-mono text-[10px] w-8 font-bold',
                        isWCSpot ? 'text-green-light' : 'text-cream-dim/30',
                      )}>
                        {isWCSpot ? `WC${idx + 1}` : `+${idx - 1}`}
                      </span>
                      <span className={cn(
                        'font-mono text-xs flex-1 font-bold truncate',
                        isUser ? 'text-gold' : 'text-cream',
                      )}>
                        {team?.city ?? t.teamId} {team?.name ?? ''}
                      </span>
                      <span className="font-mono text-xs text-cream-dim w-12 text-right">{t.wins}-{t.losses}</span>
                      <span className="font-mono text-xs text-cream-dim/60 w-10 text-right">{gb}</span>
                      <div className="w-24 flex justify-end">
                        <ProbBar prob={prob} isUser={isUser} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

const STANDINGS_COLS = [
  { key: 'team', label: 'Team', align: 'left' as const },
  { key: 'w', label: 'W', align: 'right' as const },
  { key: 'l', label: 'L', align: 'right' as const },
  { key: 'pct', label: 'PCT', align: 'right' as const },
  { key: 'gb', label: 'GB', align: 'right' as const },
  { key: 'diff', label: '+/-', align: 'right' as const },
  { key: 'streak', label: 'STRK', align: 'right' as const },
  { key: 'l10', label: 'L10', align: 'right' as const },
  { key: 'home', label: 'HOME', align: 'right' as const },
  { key: 'away', label: 'AWAY', align: 'right' as const },
];

type TabMode = 'picture' | 'divisions' | 'wildcard';

export function StandingsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();
  const [tab, setTab] = useState<TabMode>('divisions');

  if (!season || !engine) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Standings</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">League standings across all divisions, updated after every simulated game.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const divisions = season.standings.getDivisionStandings();
  const gamesPlayed = season.currentDay > 0
    ? (divisions[0]?.teams[0] ? divisions[0].teams[0].wins + divisions[0].teams[0].losses : season.currentDay)
    : 0;
  const gamesLeft = approxGamesLeft(season.currentDay, season.totalDays, gamesPlayed);
  const isRegularSeason = season.phase === 'regular' || season.phase === 'preseason';
  const isPostseason = season.phase === 'postseason';

  const TABS: { key: TabMode; label: string }[] = [
    { key: 'picture', label: 'Playoff Picture' },
    { key: 'divisions', label: 'Division Standings' },
    { key: 'wildcard', label: 'Wild Card Race' },
  ];

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Standings</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {season.year} Season — Day {season.currentDay} of {season.totalDays}
          {isRegularSeason && gamesLeft > 0 && (
            <span className="ml-2 text-cream-dim/50">· ~{gamesLeft} games remaining</span>
          )}
          {isPostseason && (
            <span className="ml-2 text-gold font-bold">· POSTSEASON</span>
          )}
        </p>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 mb-5 p-1 bg-navy-light/40 rounded-lg w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-1.5 rounded-md font-mono text-xs font-semibold transition-all cursor-pointer',
              tab === key
                ? 'bg-gold text-navy shadow-sm'
                : 'text-cream-dim hover:text-cream',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Playoff Picture */}
      {tab === 'picture' && (
        <>
          <PlayoffPicturePanel
            divisions={divisions}
            userTeamId={userTeamId}
            gamesRemaining={gamesLeft}
            gamesPlayed={gamesPlayed}
            engine={engine}
          />
          {/* Clinch chart note */}
          <div className="text-[10px] font-mono text-cream-dim/30 text-center mt-2">
            M# = magic number to clinch division · Prob% = estimated playoff probability · Updated each simulated day
          </div>
        </>
      )}

      {/* Division Standings */}
      {tab === 'divisions' && (
        <div className="space-y-6">
          {divisions.map(div => {
            const leader = div.teams[0];
            const second = div.teams[1];
            return (
              <Panel
                key={`${div.league}-${div.division}`}
                title={`${div.league} ${div.division}`}
              >
                {/* Division leader highlight */}
                {leader && second && gamesLeft > 0 && (
                  <div className="flex items-center gap-3 mb-4 px-2 py-2 bg-navy-lighter/20 rounded-lg border border-navy-lighter/30">
                    <div className="font-mono text-xs text-cream-dim/50 shrink-0">Lead</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-gold">
                          {engine.getTeam(leader.teamId)?.abbreviation ?? leader.teamId}
                        </span>
                        <span className="font-mono text-xs text-cream-dim">
                          {leader.wins}-{leader.losses}
                        </span>
                        <span className="font-mono text-xs text-cream-dim/40">·</span>
                        <MagicNumberBadge mn={magicNumber(leader, second, gamesLeft)} gamesPlayed={gamesPlayed} />
                        <span className="font-mono text-xs text-cream-dim/40">
                          {gbFloat(leader, second).toFixed(1)} GB lead
                        </span>
                      </div>
                      <ProbBar
                        prob={Math.min(0.99, 0.5 + gbFloat(leader, second) / Math.max(1, gamesLeft) * 0.5)}
                        isUser={leader.teamId === userTeamId}
                      />
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-lighter">
                        {STANDINGS_COLS.map(c => (
                          <th key={c.key} className={cn(
                            'px-2 py-2 font-mono text-[10px] text-gold-dim uppercase tracking-wider font-semibold',
                            c.align === 'left' ? 'text-left' : 'text-right',
                          )}>
                            {c.label}
                          </th>
                        ))}
                        {gamesLeft > 0 && (
                          <th className="px-2 py-2 font-mono text-[10px] text-gold-dim uppercase tracking-wider font-semibold text-right">
                            PROB
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {div.teams.map((t: TeamRecord, i: number) => {
                        const team = engine.getTeam(t.teamId);
                        const isUser = t.teamId === userTeamId;
                        const isLeader = i === 0;
                        const prob = isLeader
                          ? Math.min(0.99, 0.5 + gbFloat(leader, div.teams[1] ?? t) / Math.max(1, gamesLeft) * 0.5)
                          : playoffProb(t, leader, gamesLeft);
                        const eliminated = gbFloat(leader, t) > gamesLeft && gamesLeft > 0;
                        return (
                          <tr
                            key={t.teamId}
                            onClick={() => navigate(`/franchise/team-stats/${t.teamId}`)}
                            className={cn(
                              'border-b border-navy-lighter/30 transition-colors cursor-pointer',
                              isUser ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-navy-lighter/20',
                              eliminated && 'opacity-40',
                            )}
                          >
                            <td className={cn(
                              'px-2 py-2 font-mono text-xs text-left',
                              isUser ? 'text-gold font-bold' : 'text-cream',
                            )}>
                              {isUser ? '► ' : ''}{team?.city ?? ''} {team?.name ?? t.teamId}
                              {eliminated && <span className="ml-1 text-[9px] text-red-400/60">ELIM</span>}
                            </td>
                            <td className="px-2 py-2 font-mono text-xs text-right text-cream">{t.wins}</td>
                            <td className="px-2 py-2 font-mono text-xs text-right text-cream">{t.losses}</td>
                            <td className="px-2 py-2 font-mono text-xs text-right text-cream-dim">{winPct(t)}</td>
                            <td className="px-2 py-2 font-mono text-xs text-right text-cream-dim">
                              {i === 0 ? '—' : gamesBehind(div.teams[0], t)}
                            </td>
                            <td className={cn(
                              'px-2 py-2 font-mono text-xs text-right',
                              t.runsScored > t.runsAllowed ? 'text-green-light' : 'text-red-400',
                            )}>
                              {runDifferential(t)}
                            </td>
                            <td className={cn(
                              'px-2 py-2 font-mono text-xs text-right font-bold',
                              t.streak > 0 ? 'text-green-light' : 'text-red-400',
                            )}>
                              {streakStr(t)}
                            </td>
                            <td className="px-2 py-2 font-mono text-xs text-right text-cream-dim">{last10Str(t)}</td>
                            <td className="px-2 py-2 font-mono text-xs text-right text-cream-dim">
                              {t.homeWins}-{t.homeLosses}
                            </td>
                            <td className="px-2 py-2 font-mono text-xs text-right text-cream-dim">
                              {t.awayWins}-{t.awayLosses}
                            </td>
                            {gamesLeft > 0 && (
                              <td className="px-2 py-2 text-right">
                                <ProbBar prob={prob} isUser={isUser} />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Wild Card Race */}
      {tab === 'wildcard' && (
        <WildCardRace
          divisions={divisions}
          userTeamId={userTeamId}
          gamesRemaining={gamesLeft}
          engine={engine}
        />
      )}
    </div>
  );
}
