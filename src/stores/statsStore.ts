import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BattingStats, PitchingStats } from '@/engine/types/stats.ts';
import { createEmptyBattingStats, createEmptyPitchingStats } from '@/engine/types/stats.ts';
import type { BoxScorePlayer, BoxScorePitcher } from '@/engine/types/game.ts';

// Per-player season stats keyed by playerId
export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  gamesPlayed: number;
  batting: BattingStats;
  pitching: PitchingStats;
  // Game log: last 20 games
  gameLog: GameLogEntry[];
}

export interface GameLogEntry {
  gameId: string;
  date: number;  // season day
  opponent: string;
  isHome: boolean;
  // Batting line
  ab: number;
  h: number;
  r: number;
  rbi: number;
  hr: number;
  bb: number;
  so: number;
  sb: number;
  // Pitching line (if pitcher)
  ip: string;
  er: number;
  kPitching: number;
  bbPitching: number;
  decision: string;
}

// Franchise records
export interface FranchiseRecord {
  playerId: string;
  playerName: string;
  teamId: string;
  value: number;
  season: number;
  gameId?: string;
  gameDate?: number;
}

export interface RecordsState {
  // Single-game records
  mostHRGame: FranchiseRecord | null;
  mostRBIGame: FranchiseRecord | null;
  mostHitsGame: FranchiseRecord | null;
  mostKGame: FranchiseRecord | null;   // strikeouts by a pitcher
  mostIPGame: FranchiseRecord | null;
  // Season records
  highestBA: FranchiseRecord | null;
  mostHRSeason: FranchiseRecord | null;
  mostRBISeason: FranchiseRecord | null;
  mostSBSeason: FranchiseRecord | null;
  lowestERA: FranchiseRecord | null;
  mostKSeason: FranchiseRecord | null;
  mostWSeason: FranchiseRecord | null;
}

interface StatsStoreState {
  // Season stats — playerID → PlayerSeasonStats
  playerStats: Record<string, PlayerSeasonStats>;
  // Current season year
  currentSeason: number;
  // Franchise records (all-time)
  records: RecordsState;
  // League aggregate totals for league context calculation
  leagueTotals: {
    totalAB: number;
    totalPA: number;
    totalH: number;
    totalDoubles: number;
    totalTriples: number;
    totalHR: number;
    totalBB: number;
    totalHBP: number;
    totalSF: number;
    totalSO: number;
    totalRuns: number;
    // Actual game-score runs (more reliable than batter-credited runs)
    totalGameRuns: number;
    gamesPlayed: number;
    totalER: number;
    totalIP: number;
  };
}

interface StatsStoreActions {
  /** Record stats from a completed game. */
  recordGameStats: (
    gameId: string,
    gameDay: number,
    season: number,
    awayTeamId: string,
    homeTeamId: string,
    awayBatters: BoxScorePlayer[],
    homeBatters: BoxScorePlayer[],
    awayPitchers: BoxScorePitcher[],
    homePitchers: BoxScorePitcher[],
    getPlayerTeamId: (playerId: string) => string,
    getPlayerPosition: (playerId: string) => string,
    awayScore?: number,
    homeScore?: number,
  ) => void;

  /** Reset stats for a new season. */
  resetSeason: (season: number) => void;

  /** Get stats for a specific player. */
  getPlayerStats: (playerId: string) => PlayerSeasonStats | null;

  /** Get all player stats sorted by a batting stat. */
  getBattingLeaders: (minPA?: number) => PlayerSeasonStats[];

  /** Get all pitcher stats sorted by a pitching stat. */
  getPitchingLeaders: (minIP?: number) => PlayerSeasonStats[];
}

function emptyPlayerStats(
  playerId: string,
  name: string,
  teamId: string,
  position: string
): PlayerSeasonStats {
  return {
    playerId,
    playerName: name,
    teamId,
    position,
    gamesPlayed: 0,
    batting: createEmptyBattingStats(),
    pitching: createEmptyPitchingStats(),
    gameLog: [],
  };
}

function emptyRecords(): RecordsState {
  return {
    mostHRGame: null,
    mostRBIGame: null,
    mostHitsGame: null,
    mostKGame: null,
    mostIPGame: null,
    highestBA: null,
    mostHRSeason: null,
    mostRBISeason: null,
    mostSBSeason: null,
    lowestERA: null,
    mostKSeason: null,
    mostWSeason: null,
  };
}

function parseIPToThirds(ip: string): number {
  const parts = ip.split('.');
  const full = parseInt(parts[0]) || 0;
  const thirds = parseInt(parts[1]) || 0;
  return full * 3 + thirds;
}

type SetFn = (fn: (state: StatsStoreState) => Partial<StatsStoreState>) => void;

function updateRecords(
  records: RecordsState,
  stats: Record<string, PlayerSeasonStats>,
  season: number
): RecordsState {
  const newRecords = { ...records };

  for (const ps of Object.values(stats)) {
    const { playerId, playerName, teamId, batting, pitching } = ps;

    // Season records
    const ba = ps.batting.ab >= 150 ? batting.h / batting.ab : 0;
    if (ba > 0 && (!newRecords.highestBA || ba > newRecords.highestBA.value)) {
      newRecords.highestBA = { playerId, playerName, teamId, value: ba, season };
    }
    if (batting.hr > (newRecords.mostHRSeason?.value ?? -1)) {
      newRecords.mostHRSeason = { playerId, playerName, teamId, value: batting.hr, season };
    }
    if (batting.rbi > (newRecords.mostRBISeason?.value ?? -1)) {
      newRecords.mostRBISeason = { playerId, playerName, teamId, value: batting.rbi, season };
    }
    if (batting.sb > (newRecords.mostSBSeason?.value ?? -1)) {
      newRecords.mostSBSeason = { playerId, playerName, teamId, value: batting.sb, season };
    }
    const innings = pitching.ip / 3;
    if (innings >= 20) {
      const pEra = innings === 0 ? 0 : (pitching.er / innings) * 9;
      if (!newRecords.lowestERA || pEra < newRecords.lowestERA.value) {
        newRecords.lowestERA = { playerId, playerName, teamId, value: pEra, season };
      }
    }
    if (pitching.so > (newRecords.mostKSeason?.value ?? -1)) {
      newRecords.mostKSeason = { playerId, playerName, teamId, value: pitching.so, season };
    }
    if (pitching.wins > (newRecords.mostWSeason?.value ?? -1)) {
      newRecords.mostWSeason = { playerId, playerName, teamId, value: pitching.wins, season };
    }
  }

  return newRecords;
}

export const useStatsStore = create<StatsStoreState & StatsStoreActions>()(
  persist(
    (set, get) => ({
      playerStats: {},
      currentSeason: 2026,
      records: emptyRecords(),
      leagueTotals: {
        totalAB: 0, totalPA: 0, totalH: 0, totalDoubles: 0, totalTriples: 0,
        totalHR: 0, totalBB: 0, totalHBP: 0, totalSF: 0, totalSO: 0,
        totalRuns: 0, totalGameRuns: 0, gamesPlayed: 0, totalER: 0, totalIP: 0,
      },

      recordGameStats: (
        gameId,
        gameDay,
        season,
        awayTeamId,
        homeTeamId,
        awayBatters,
        homeBatters,
        awayPitchers,
        homePitchers,
        getPlayerTeamId,
        getPlayerPosition,
        awayScore,
        homeScore,
      ) => {
        set((state) => {
          const playerStats = { ...state.playerStats };
          const lt = { ...state.leagueTotals };

          const processBatters = (batters: BoxScorePlayer[], isHome: boolean) => {
            const teamId = isHome ? homeTeamId : awayTeamId;
            const oppId = isHome ? awayTeamId : homeTeamId;
            for (const b of batters) {
              if (!playerStats[b.playerId]) {
                playerStats[b.playerId] = emptyPlayerStats(
                  b.playerId, b.name,
                  getPlayerTeamId(b.playerId) || teamId,
                  getPlayerPosition(b.playerId) || b.position
                );
              }
              const ps = playerStats[b.playerId];
              const bs = ps.batting;
              const pa = b.ab + b.bb;
              bs.pa += pa;
              bs.ab += b.ab;
              bs.h += b.h;
              bs.doubles += b.doubles;
              bs.triples += b.triples;
              bs.hr += b.hr;
              bs.rbi += b.rbi;
              bs.r += b.r;
              bs.bb += b.bb;
              bs.so += b.so;
              bs.sb += b.sb;
              ps.gamesPlayed++;

              // League totals
              lt.totalPA += pa;
              lt.totalAB += b.ab;
              lt.totalH += b.h;
              lt.totalDoubles += b.doubles;
              lt.totalTriples += b.triples;
              lt.totalHR += b.hr;
              lt.totalBB += b.bb;
              lt.totalSO += b.so;
              lt.totalRuns += b.r;

              // Game log entry
              const logEntry: GameLogEntry = {
                gameId, date: gameDay, opponent: oppId, isHome,
                ab: b.ab, h: b.h, r: b.r, rbi: b.rbi, hr: b.hr, bb: b.bb, so: b.so, sb: b.sb,
                ip: '', er: 0, kPitching: 0, bbPitching: 0, decision: '',
              };
              ps.gameLog = [...ps.gameLog.slice(-19), logEntry];

              // Single-game records
              // (updated below via updateRecords)
            }
          };

          const processPitchers = (pitchers: BoxScorePitcher[], isHome: boolean) => {
            const teamId = isHome ? homeTeamId : awayTeamId;
            const oppId = isHome ? awayTeamId : homeTeamId;
            for (const p of pitchers) {
              if (!playerStats[p.playerId]) {
                playerStats[p.playerId] = emptyPlayerStats(
                  p.playerId, p.name,
                  getPlayerTeamId(p.playerId) || teamId,
                  'P'
                );
              }
              const ps = playerStats[p.playerId];
              const pst = ps.pitching;
              const ipThirds = parseIPToThirds(p.ip);
              pst.ip += ipThirds;
              pst.h += p.h;
              pst.r += p.r;
              pst.er += p.er;
              pst.bb += p.bb;
              pst.so += p.so;
              pst.hr += p.hr;
              pst.pitchCount += p.pitchCount;
              if (p.decision === 'W') pst.wins++;
              if (p.decision === 'L') pst.losses++;
              if (p.decision === 'S') pst.saves++;
              if (p.decision === 'H') pst.holds++;

              lt.totalER += p.er;
              lt.totalIP += ipThirds;

              const logEntry: GameLogEntry = {
                gameId, date: gameDay, opponent: oppId, isHome,
                ab: 0, h: 0, r: 0, rbi: 0, hr: 0, bb: 0, so: 0, sb: 0,
                ip: p.ip, er: p.er, kPitching: p.so, bbPitching: p.bb, decision: p.decision,
              };
              ps.gameLog = [...ps.gameLog.slice(-19), logEntry];
            }
          };

          processBatters(awayBatters, false);
          processBatters(homeBatters, true);
          processPitchers(awayPitchers, false);
          processPitchers(homePitchers, true);
          lt.gamesPlayed++;
          // Track actual game scores for accurate R/G calculation
          if (awayScore !== undefined) lt.totalGameRuns += awayScore;
          if (homeScore !== undefined) lt.totalGameRuns += homeScore;

          const newRecords = updateRecords(state.records, playerStats, season);

          return { playerStats, leagueTotals: lt, records: newRecords, currentSeason: season };
        });
      },

      resetSeason: (season) => {
        set({ playerStats: {}, currentSeason: season, leagueTotals: {
          totalAB: 0, totalPA: 0, totalH: 0, totalDoubles: 0, totalTriples: 0,
          totalHR: 0, totalBB: 0, totalHBP: 0, totalSF: 0, totalSO: 0,
          totalRuns: 0, totalGameRuns: 0, gamesPlayed: 0, totalER: 0, totalIP: 0,
        }});
      },

      getPlayerStats: (playerId) => {
        return get().playerStats[playerId] ?? null;
      },

      getBattingLeaders: (minPA = 10) => {
        return Object.values(get().playerStats)
          .filter(p => p.batting.pa >= minPA && p.position !== 'P');
      },

      getPitchingLeaders: (minIP = 3) => {
        return Object.values(get().playerStats)
          .filter(p => p.pitching.ip >= minIP * 3);
      },
    }),
    {
      name: 'claudeball-stats',
      partialize: (state) => ({
        playerStats: state.playerStats,
        currentSeason: state.currentSeason,
        records: state.records,
        leagueTotals: state.leagueTotals,
      }),
    }
  )
);
