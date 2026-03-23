/**
 * Achievement system — tracks unlocked trophies and milestones.
 * Persisted to localStorage.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  category: 'franchise' | 'game' | 'roster' | 'season' | 'hidden';
  icon: string;  // single char or short text
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string; // ISO date
  season?: number;
}

// ── Achievement definitions ─────────────────────────────────────
export const ACHIEVEMENTS: Achievement[] = [
  // Franchise
  { id: 'first-franchise', title: 'Welcome, GM', description: 'Start your first franchise', tier: 'bronze', category: 'franchise', icon: 'GM' },
  { id: 'first-save', title: 'Saved for Posterity', description: 'Save your game for the first time', tier: 'bronze', category: 'franchise', icon: 'S' },
  { id: 'sim-30', title: 'Fast Forward', description: 'Sim 30 days in one click', tier: 'bronze', category: 'franchise', icon: 'FF' },
  { id: 'coaching-hire', title: 'Staff Builder', description: 'Hire a coaching staff member', tier: 'bronze', category: 'franchise', icon: 'HC' },

  // Roster
  { id: 'first-trade', title: 'Dealmaker', description: 'Complete your first trade', tier: 'silver', category: 'roster', icon: 'TR' },
  { id: 'first-signing', title: 'Free Agent Frenzy', description: 'Sign a free agent', tier: 'bronze', category: 'roster', icon: 'FA' },
  { id: 'callup', title: 'Fresh Legs', description: 'Call up a player from the minors', tier: 'bronze', category: 'roster', icon: 'UP' },
  { id: 'prospect-scout', title: 'Eagle Eye', description: 'View a Prospect Scouting Report Card', tier: 'bronze', category: 'roster', icon: 'SC' },
  { id: 'extension', title: 'Locked In', description: 'Sign a contract extension', tier: 'silver', category: 'roster', icon: 'EX' },

  // Game
  { id: 'first-game', title: 'Play Ball!', description: 'Play your first live game', tier: 'bronze', category: 'game', icon: 'PB' },
  { id: 'shutout-win', title: 'Whitewash', description: 'Win a game by shutout', tier: 'silver', category: 'game', icon: 'SO' },
  { id: 'blowout', title: 'Mercy Rule', description: 'Win a game by 10+ runs', tier: 'silver', category: 'game', icon: 'KO' },
  { id: 'manager-decision', title: 'Skip\'s Call', description: 'Make a Manager Decision during sim', tier: 'bronze', category: 'game', icon: 'MD' },

  // Season
  { id: 'win-50', title: 'Competitive', description: 'Win 50 games in a season', tier: 'bronze', category: 'season', icon: '50' },
  { id: 'win-75', title: 'Contender', description: 'Win 75 games in a season', tier: 'silver', category: 'season', icon: '75' },
  { id: 'win-100', title: 'Dominant', description: 'Win 100 games in a season', tier: 'gold', category: 'season', icon: 'C' },
  { id: 'playoffs', title: 'October Baseball', description: 'Make the playoffs', tier: 'silver', category: 'season', icon: 'PO' },
  { id: 'world-series', title: 'World Champion', description: 'Win the World Series', tier: 'diamond', category: 'season', icon: 'WS' },
  { id: 'awards-ceremony', title: 'Award Season', description: 'Watch the Awards Ceremony', tier: 'bronze', category: 'season', icon: 'AW' },
  { id: 'season-story', title: 'Storyteller', description: 'Read your Season Story', tier: 'bronze', category: 'season', icon: 'ST' },

  // Hidden
  { id: 'help-reader', title: 'RTFM', description: 'Open the Help overlay', tier: 'bronze', category: 'hidden', icon: '?' },
  { id: 'idea-submit', title: 'Feedback Loop', description: 'Submit an idea or feedback', tier: 'bronze', category: 'hidden', icon: 'FB' },
  { id: 'all-pages', title: 'Explorer', description: 'Visit every page in the app', tier: 'gold', category: 'hidden', icon: 'EX' },
];

// ── Store ────────────────────────────────────────────────────────
interface AchievementState {
  unlocked: UnlockedAchievement[];
  recentUnlock: string | null; // ID of most recent unlock (for toast)

  unlock: (id: string, season?: number) => boolean; // returns true if newly unlocked
  isUnlocked: (id: string) => boolean;
  clearRecent: () => void;
  getProgress: () => { total: number; unlocked: number; pct: number };
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlocked: [],
      recentUnlock: null,

      unlock: (id, season) => {
        if (get().unlocked.some(u => u.id === id)) return false;
        const entry: UnlockedAchievement = { id, unlockedAt: new Date().toISOString(), season };
        set(s => ({ unlocked: [...s.unlocked, entry], recentUnlock: id }));
        return true;
      },

      isUnlocked: (id) => get().unlocked.some(u => u.id === id),

      clearRecent: () => set({ recentUnlock: null }),

      getProgress: () => {
        const total = ACHIEVEMENTS.length;
        const unlocked = get().unlocked.length;
        return { total, unlocked, pct: Math.round((unlocked / total) * 100) };
      },
    }),
    { name: 'claudeball-achievements', partialize: s => ({ unlocked: s.unlocked }) }
  )
);

// ── Tier colors ──────────────────────────────────────────────────
export function tierColor(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze': return '#cd7f32';
    case 'silver': return '#c0c0c0';
    case 'gold': return '#d4a843';
    case 'diamond': return '#b9f2ff';
  }
}

export function tierBorder(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze': return 'border-[#cd7f32]/40';
    case 'silver': return 'border-gray-400/40';
    case 'gold': return 'border-gold/50';
    case 'diamond': return 'border-cyan-300/50';
  }
}

export function tierBg(tier: AchievementTier): string {
  switch (tier) {
    case 'bronze': return 'bg-[#cd7f32]/10';
    case 'silver': return 'bg-gray-400/10';
    case 'gold': return 'bg-gold/10';
    case 'diamond': return 'bg-cyan-300/10';
  }
}
