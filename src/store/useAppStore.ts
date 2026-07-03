import { create } from 'zustand';
import { getCurrentFY } from '@/lib/sequences';

const SIDEBAR_KEY = 'sudobooks:sidebar-open';

function readSidebarOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

interface AppState {
  currentFY: string;
  sidebarOpen: boolean;
  setCurrentFY: (fy: string) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentFY: getCurrentFY(),
  sidebarOpen: readSidebarOpen(),
  setCurrentFY: (fy) => set({ currentFY: fy }),
  setSidebarOpen: (open) => {
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ sidebarOpen: open });
  },
}));
