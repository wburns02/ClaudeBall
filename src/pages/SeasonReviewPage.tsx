import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { usePlayerModal } from '@/stores/playerModalStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { battingAvg, era, formatIP } from '@/engine/types/stats.ts';
import {
  calcBattingAdvanced, calcPitchingAdvanced,
  deriveLeagueContext, DEFAULT_LEAGUE_CONTEXT,
} from '@/engine/stats/AdvancedStats.ts';
import { winPct, streakStr } from '@/engine/season/index.ts';
import { cn } from '@/lib/cn.ts';

function GradeCircle({ grade, label }: { grade: string; label: string }) {
  const color = grade === 'A+' || grade === 'A' ? 'text-gold border-gold/50 bg-gold/10'
    : grade === 'B+' || grade === 'B' ? 'text-green-light border-green-light/40 bg-green-light/5'
    : grade === 'C+' || grade === 'C' ? 'text-cream border-cream/20 bg-cream/5'
    : 'text-red-400 border-red-400/30 bg-red-400/5';

  return (
    <div className="text-center">
      <div className={cn('w-16 h-16 rounded-full border-2 flex items-center justify-center mx-auto', color)}>
        <span className="font-display text-2xl font-bold">{grade}</span>
      </div>
      <p className="font-mono text-[10px] text-cream-dim/50 uppercase mt-2">{label}</p>
    </div>
  );
}

export function SeasonReviewPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, season } = useFranchiseStore();
  const playerStats = useStatsStore(s => s.playerStats);
  const openPlayer = usePlayerModal(s => s.openPlayer);

  if (!engine || !userTeamId || !season) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Season Review</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          A comprehensive look back at your season's story, stats, and highlights.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const userTeam = engine.getTeam(userTeamId);
  const userRecord = season.standings.getRecord(userTeamId);
  const gamesPlayed = userRecord ? userRecord.wins + userRecord.losses : 0;

  // League context for WAR
  const leagueCtx = useMemo(() => {
    const allStats = Object.values(playerStats);
    if (allStats.length === 0) return DEFAULT_LEAGUE_CONTEXT;
    let tAB = 0, tPA = 0, tH = 0, tD = 0, tT = 0, tHR = 0, tBB = 0, tHBP = 0, tSF = 0, tSO = 0, tR = 0, tER = 0, tIP = 0;
    for (const p of allStats) {
      tAB += p.batting.ab; tPA += p.batting.pa; tH += p.batting.h; tD += p.batting.doubles;
      tT += p.batting.triples; tHR += p.batting.hr; tBB += p.batting.bb; tHBP += p.batting.hbp;
      tSF += p.batting.sf; tSO += p.batting.so; tR += p.batting.r; tER += p.pitching.er; tIP += p.pitching.ip;
    }
    return deriveLeagueContext(tAB, tPA, tH, tD, tT, tHR, tBB, tHBP, tSF, tSO, tR, 0, tER, tIP);
  }, [playerStats]);

  // Team stats leaders
  const teamStats = useMemo(() => {
    const teamPlayers = Object.values(playerStats).filter(ps => ps.teamId === userTeamId);

    // Best batter by WAR
    const batters = teamPlayers
      .filter(ps => ps.position !== 'P' && ps.batting.pa >= 30)
      .map(ps => ({
        ...ps,
        war: calcBattingAdvanced(ps.batting, leagueCtx, ps.position).war,
        avg: battingAvg(ps.batting),
      }))
      .sort((a, b) => b.war - a.war);

    // Best pitcher by WAR
    const pitchers = teamPlayers
      .filter(ps => ps.position === 'P' && ps.pitching.ip >= 15)
      .map(ps => ({
        ...ps,
        war: calcPitchingAdvanced(ps.pitching, leagueCtx).war,
        eraVal: era(ps.pitching),
      }))
      .sort((a, b) => b.war - a.war);

    // HR leader
    const hrLeader = teamPlayers
      .filter(ps => ps.batting.hr > 0)
      .sort((a, b) => b.batting.hr - a.batting.hr)[0];

    // RBI leader
    const rbiLeader = teamPlayers
      .filter(ps => ps.batting.rbi > 0)
      .sort((a, b) => (b.batting.rbi ?? 0) - (a.batting.rbi ?? 0))[0];

    // K leader (pitcher)
    const kLeader = pitchers.sort((a, b) => b.pitching.so - a.pitching.so)[0];

    // Total team WAR
    const totalWar = [...batters, ...pitchers].reduce((sum, p) => sum + p.war, 0);

    return {
      mvpBatter: batters[0] ?? null,
      mvpPitcher: pitchers[0] ?? null,
      hrLeader,
      rbiLeader,
      kLeader,
      totalWar,
      batters: batters.slice(0, 5),
      pitchers: pitchers.slice(0, 5),
    };
  }, [playerStats, userTeamId, leagueCtx]);

  // Division standings
  const divStandings = useMemo(() => {
    const divs = season.standings.getDivisionStandings();
    return divs.find((d: any) => d.teams.some((t: any) => t.teamId === userTeamId));
  }, [season, userTeamId]);

  const divRank = divStandings?.teams.findIndex((t: any) => t.teamId === userTeamId) ?? -1;

  // Season streaks from schedule
  const streaks = useMemo(() => {
    const userGames = season.schedule
      .filter(g => g.played && (g.awayId === userTeamId || g.homeId === userTeamId))
      .sort((a, b) => a.date - b.date);

    let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
    let biggestWin = { margin: 0, opponent: '', score: '' };
    let biggestLoss = { margin: 0, opponent: '', score: '' };

    for (const g of userGames) {
      const isHome = g.homeId === userTeamId;
      const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      const oppId = isHome ? g.awayId : g.homeId;
      const oppTeam = engine.getTeam(oppId);
      const margin = myScore - oppScore;

      if (margin > 0) {
        curWin++; curLoss = 0;
        maxWin = Math.max(maxWin, curWin);
        if (margin > biggestWin.margin) {
          biggestWin = { margin, opponent: oppTeam?.name ?? oppId, score: `${myScore}-${oppScore}` };
        }
      } else {
        curLoss++; curWin = 0;
        maxLoss = Math.max(maxLoss, curLoss);
        if (Math.abs(margin) > biggestLoss.margin) {
          biggestLoss = { margin: Math.abs(margin), opponent: oppTeam?.name ?? oppId, score: `${myScore}-${oppScore}` };
        }
      }
    }

    return { maxWin, maxLoss, biggestWin, biggestLoss, totalGames: userGames.length };
  }, [season, userTeamId, engine]);

  // Season grade
  const seasonGrade = useMemo(() => {
    if (!userRecord || gamesPlayed < 10) return 'N/A';
    const wpct = userRecord.wins / gamesPlayed;
    if (wpct >= 0.650) return 'A+';
    if (wpct >= 0.580) return 'A';
    if (wpct >= 0.530) return 'B+';
    if (wpct >= 0.500) return 'B';
    if (wpct >= 0.450) return 'C';
    if (wpct >= 0.400) return 'D';
    return 'F';
  }, [userRecord, gamesPlayed]);

  const offenseGrade = useMemo(() => {
    if (!userRecord || gamesPlayed < 10) return 'N/A';
    const rpg = userRecord.runsScored / gamesPlayed;
    if (rpg >= 5.5) return 'A+';
    if (rpg >= 5.0) return 'A';
    if (rpg >= 4.5) return 'B+';
    if (rpg >= 4.0) return 'B';
    if (rpg >= 3.5) return 'C';
    return 'D';
  }, [userRecord, gamesPlayed]);

  const defenseGrade = useMemo(() => {
    if (!userRecord || gamesPlayed < 10) return 'N/A';
    const rapg = userRecord.runsAllowed / gamesPlayed;
    if (rapg <= 3.0) return 'A+';
    if (rapg <= 3.5) return 'A';
    if (rapg <= 4.0) return 'B+';
    if (rapg <= 4.5) return 'B';
    if (rapg <= 5.0) return 'C';
    return 'D';
  }, [userRecord, gamesPlayed]);

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="text-center mb-8">
        <p className="font-mono text-cream-dim/40 text-xs uppercase tracking-widest mb-2">
          {season.year} Season Review
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-gold tracking-wide uppercase mb-2">
          {userTeam?.city} {userTeam?.name}
        </h1>
        {userRecord && (
          <p className="font-mono text-2xl text-cream">
            {userRecord.wins}-{userRecord.losses}
            <span className="text-cream-dim ml-2 text-lg">{winPct(userRecord)}</span>
          </p>
        )}
        <p className="font-mono text-sm text-cream-dim/60 mt-1">
          {divStandings ? `${divRank + 1}${divRank === 0 ? 'st' : divRank === 1 ? 'nd' : divRank === 2 ? 'rd' : 'th'} in ${divStandings.division}` : ''}
          {gamesPlayed > 0 ? ` · ${gamesPlayed} games played` : ''}
        </p>
      </div>

      {/* Season Grades */}
      <div className="flex justify-center gap-8 mb-8">
        <GradeCircle grade={seasonGrade} label="Overall" />
        <GradeCircle grade={offenseGrade} label="Offense" />
        <GradeCircle grade={defenseGrade} label="Pitching" />
      </div>

      {/* Key Numbers */}
      {userRecord && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Runs Scored</p>
            <p className="font-mono text-2xl font-bold text-cream mt-1">{userRecord.runsScored}</p>
            <p className="font-mono text-xs text-cream-dim/40">{(userRecord.runsScored / Math.max(1, gamesPlayed)).toFixed(1)}/game</p>
          </div>
          <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Runs Allowed</p>
            <p className="font-mono text-2xl font-bold text-cream mt-1">{userRecord.runsAllowed}</p>
            <p className="font-mono text-xs text-cream-dim/40">{(userRecord.runsAllowed / Math.max(1, gamesPlayed)).toFixed(1)}/game</p>
          </div>
          <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Team WAR</p>
            <p className="font-mono text-2xl font-bold text-gold mt-1">{teamStats.totalWar.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border border-navy-lighter bg-navy-light/30 px-4 py-3 text-center">
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Run Diff</p>
            <p className={cn('font-mono text-2xl font-bold mt-1',
              userRecord.runsScored > userRecord.runsAllowed ? 'text-green-light' : 'text-red-400',
            )}>
              {userRecord.runsScored > userRecord.runsAllowed ? '+' : ''}{userRecord.runsScored - userRecord.runsAllowed}
            </p>
          </div>
        </div>
      )}

      {/* Team MVPs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Position MVP */}
        {teamStats.mvpBatter && (
          <Panel title="Team MVP (Position)">
            <button
              onClick={() => openPlayer(teamStats.mvpBatter!.playerId)}
              className="w-full text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg text-gold">{teamStats.mvpBatter.playerName}</p>
                  <p className="font-mono text-xs text-cream-dim">
                    {teamStats.mvpBatter.position} · .{Math.round(teamStats.mvpBatter.avg * 1000).toString().padStart(3, '0')} AVG · {teamStats.mvpBatter.batting.hr} HR · {teamStats.mvpBatter.batting.rbi} RBI
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold text-gold">{teamStats.mvpBatter.war.toFixed(1)}</p>
                  <p className="font-mono text-[10px] text-cream-dim/40">WAR</p>
                </div>
              </div>
            </button>
          </Panel>
        )}

        {/* Pitching MVP */}
        {teamStats.mvpPitcher && (
          <Panel title="Team MVP (Pitching)">
            <button
              onClick={() => openPlayer(teamStats.mvpPitcher!.playerId)}
              className="w-full text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg text-gold">{teamStats.mvpPitcher.playerName}</p>
                  <p className="font-mono text-xs text-cream-dim">
                    P · {teamStats.mvpPitcher.eraVal.toFixed(2)} ERA · {teamStats.mvpPitcher.pitching.so} K · {formatIP(teamStats.mvpPitcher.pitching.ip)} IP
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold text-blue-400">{teamStats.mvpPitcher.war.toFixed(1)}</p>
                  <p className="font-mono text-[10px] text-cream-dim/40">WAR</p>
                </div>
              </div>
            </button>
          </Panel>
        )}
      </div>

      {/* Season Highlights */}
      <Panel title="Season Highlights" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center py-2">
            <p className="font-mono text-2xl font-bold text-green-light">{streaks.maxWin}</p>
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Longest Win Streak</p>
          </div>
          <div className="text-center py-2">
            <p className="font-mono text-2xl font-bold text-red-400">{streaks.maxLoss}</p>
            <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Longest Losing Streak</p>
          </div>
          {streaks.biggestWin.margin > 0 && (
            <div className="text-center py-2">
              <p className="font-mono text-lg font-bold text-green-light">{streaks.biggestWin.score}</p>
              <p className="font-mono text-[10px] text-cream-dim/50">Biggest Win</p>
              <p className="font-mono text-[9px] text-cream-dim/30">vs {streaks.biggestWin.opponent}</p>
            </div>
          )}
          {streaks.biggestLoss.margin > 0 && (
            <div className="text-center py-2">
              <p className="font-mono text-lg font-bold text-red-400">{streaks.biggestLoss.score}</p>
              <p className="font-mono text-[10px] text-cream-dim/50">Worst Loss</p>
              <p className="font-mono text-[9px] text-cream-dim/30">vs {streaks.biggestLoss.opponent}</p>
            </div>
          )}
        </div>
      </Panel>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Panel title="Top Batters (by WAR)">
          <div className="space-y-2">
            {teamStats.batters.map((p, i) => (
              <button
                key={p.playerId}
                onClick={() => openPlayer(p.playerId)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-navy-lighter/20 transition-colors cursor-pointer"
              >
                <span className={cn('font-mono text-xs font-bold w-5', i === 0 ? 'text-gold' : 'text-cream-dim/40')}>{i + 1}</span>
                <span className="font-body text-sm text-cream flex-1 text-left truncate">{p.playerName}</span>
                <span className="font-mono text-[10px] text-cream-dim/40">{p.position}</span>
                <span className="font-mono text-[10px] text-cream-dim">.{Math.round(p.avg * 1000).toString().padStart(3, '0')}</span>
                <span className="font-mono text-xs font-bold text-gold w-8 text-right">{p.war.toFixed(1)}</span>
              </button>
            ))}
            {teamStats.batters.length === 0 && (
              <p className="font-mono text-xs text-cream-dim/40 text-center py-4">Not enough games played</p>
            )}
          </div>
        </Panel>

        <Panel title="Top Pitchers (by WAR)">
          <div className="space-y-2">
            {teamStats.pitchers.map((p, i) => (
              <button
                key={p.playerId}
                onClick={() => openPlayer(p.playerId)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-navy-lighter/20 transition-colors cursor-pointer"
              >
                <span className={cn('font-mono text-xs font-bold w-5', i === 0 ? 'text-gold' : 'text-cream-dim/40')}>{i + 1}</span>
                <span className="font-body text-sm text-cream flex-1 text-left truncate">{p.playerName}</span>
                <span className="font-mono text-[10px] text-cream-dim">{p.eraVal.toFixed(2)}</span>
                <span className="font-mono text-[10px] text-cream-dim/40">{p.pitching.so}K</span>
                <span className="font-mono text-xs font-bold text-blue-400 w-8 text-right">{p.war.toFixed(1)}</span>
              </button>
            ))}
            {teamStats.pitchers.length === 0 && (
              <p className="font-mono text-xs text-cream-dim/40 text-center py-4">Not enough innings pitched</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Division Final Standings */}
      {divStandings && (
        <Panel title={`${divStandings.league} ${divStandings.division} Standings`} className="mb-6">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-navy-lighter/40 text-cream-dim/50">
                <th className="text-left py-1.5">Team</th>
                <th className="text-right py-1.5">W</th>
                <th className="text-right py-1.5 pl-2">L</th>
                <th className="text-right py-1.5 pl-2">PCT</th>
              </tr>
            </thead>
            <tbody>
              {divStandings.teams.map((t: any, i: number) => {
                const isUser = t.teamId === userTeamId;
                const abbr = engine.getTeam(t.teamId)?.abbreviation ?? t.teamId;
                return (
                  <tr key={t.teamId} className={cn('border-b border-navy-lighter/20', isUser && 'bg-gold/5')}>
                    <td className={cn('py-1.5', isUser ? 'text-gold font-bold' : 'text-cream')}>
                      {i + 1}. {abbr} {isUser && '★'}
                    </td>
                    <td className="text-right text-cream">{t.wins}</td>
                    <td className="text-right text-cream pl-2">{t.losses}</td>
                    <td className="text-right text-cream-dim pl-2">{winPct(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {/* Navigation */}
      <div className="flex justify-center gap-3 mt-8">
        <Button variant="ghost" onClick={() => navigate('/franchise/timeline')}>Season Timeline</Button>
        <Button variant="ghost" onClick={() => navigate('/franchise/war')}>WAR Dashboard</Button>
        <Button onClick={() => navigate('/franchise')}>Back to Dashboard</Button>
      </div>
    </div>
  );
}
