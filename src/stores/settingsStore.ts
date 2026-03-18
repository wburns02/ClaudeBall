import { create } from 'zustand';

export type Difficulty = 'rookie' | 'veteran' | 'legend';
export type Theme = 'classic' | 'dark' | 'retro';

export interface Settings {
  masterVolume: number;   // 0-100
  musicVolume: number;    // 0-100
  sfxVolume: number;      // 0-100
  autoPlaySpeed: number;  // 1-10
  showAnimations: boolean;
  difficulty: Difficulty;
  theme: Theme;
}

const STORAGE_KEY = 'claudeball_settings';

const DEFAULT_SETTINGS: Settings = {
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 80,
  autoPlaySpeed: 3,
  showAnimations: true,
  difficulty: 'veteran',
  theme: 'classic',
};

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveToStorage(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

interface SettingsStore extends Settings {
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...loadFromStorage(),

  setSetting: (key, value) => {
    set((state) => {
      const next = { ...state, [key]: value };
      saveToStorage({
        masterVolume: next.masterVolume,
        musicVolume: next.musicVolume,
        sfxVolume: next.sfxVolume,
        autoPlaySpeed: next.autoPlaySpeed,
        showAnimations: next.showAnimations,
        difficulty: next.difficulty,
        theme: next.theme,
      });
      return { [key]: value };
    });
  },

  resetToDefaults: () => {
    saveToStorage(DEFAULT_SETTINGS);
    set({ ...DEFAULT_SETTINGS });
  },
}));
