import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'sudo-books-theme';

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Read persisted theme before React mounts (avoids flash). */
export function getStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'dark';
    const parsed = JSON.parse(raw) as { state?: { theme?: Theme } };
    return parsed.state?.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
