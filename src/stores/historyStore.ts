import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Award } from '@/engine/season/index.ts';
import type { AITradeRecord } from '@/engine/season/AITradeManager.ts';

export interface SeasonRecord {
  year: number;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  winPct: string;
  divisionRank: number;
  playoffResult: 'champion' | 'runner-up' | 'league-cs' | 'division-series' | 'missed' | 'unknown';
}

export interface ChampionRecord {
  year: number;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
}

export interface AllStarResult {
  year: number;
  awayScore: number;
  homeScore: number;
  homeLeague: string;
  awayLeague: string;
  mvpPlayerId: string;
  mvpPlayerName: string;
}

export interface TradeHistoryEntry {
  year: number;
  day: number;
  description: string;
  isUserTrade: boolean;
}

interface HistoryState {
  seasonRecords: SeasonRecord[];
  champions: ChampionRecord[];
  awardHistory: (Award & { year: number })[];
  allStarResults: AllStarResult[];
  tradeHistory: TradeHistoryEntry[];

  // Actions
  recordSeasonEnd: (record: SeasonRecord) => void;
  recordChampion: (champion: ChampionRecord) => void;
  recordAwards: (awards: Award[], year: number) => void;
  recordAllStarGame: (result: AllStarResult) => void;
  recordTrades: (trades: AITradeRecord[], year: number) => void;
  recordUserTrade: (description: string, year: number, day: number) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      seasonRecords: [],
      champions: [],
      awardHistory: [],
      allStarResults: [],
      tradeHistory: [],

      recordSeasonEnd: (record) =>
        set(s => ({
          seasonRecords: [
            ...s.seasonRecords.filter(r => !(r.year === record.year && r.teamId === record.teamId)),
            record,
          ],
        })),

      recordChampion: (champion) =>
        set(s => ({
          champions: [
            ...s.champions.filter(c => c.year !== champion.year),
            champion,
          ],
        })),

      recordAwards: (awards, year) =>
        set(s => ({
          awardHistory: [
            ...s.awardHistory.filter(a => a.year !== year),
            ...awards.map(a => ({ ...a, year })),
          ],
        })),

      recordAllStarGame: (result) =>
        set(s => ({
          allStarResults: [
            ...s.allStarResults.filter(r => r.year !== result.year),
            result,
          ],
        })),

      recordTrades: (trades, year) =>
        set(s => ({
          tradeHistory: [
            ...s.tradeHistory,
            ...trades.map(t => ({
              year,
              day: t.day,
              description: t.description,
              isUserTrade: false,
            })),
          ],
        })),

      recordUserTrade: (description, year, day) =>
        set(s => ({
          tradeHistory: [
            ...s.tradeHistory,
            { year, day, description, isUserTrade: true },
          ],
        })),

      clearHistory: () =>
        set({
          seasonRecords: [],
          champions: [],
          awardHistory: [],
          allStarResults: [],
          tradeHistory: [],
        }),
    }),
    {
      name: 'claudeball-history',
    }
  )
);
