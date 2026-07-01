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
  activeUserId: string | null;
  userEmail: string | null;
  isAuthLoading: boolean;
  sidebarOpen: boolean;
  setCurrentFY: (fy: string) => void;
  setUser: (id: string | null, email?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentFY: getCurrentFY(),
  activeUserId: null,
  userEmail: null,
  isAuthLoading: false,
  sidebarOpen: readSidebarOpen(),
  setCurrentFY: (fy) => set({ currentFY: fy }),
  setUser: (id, email = null) => set({ activeUserId: id, userEmail: email, isAuthLoading: false }),
  setSidebarOpen: (open) => {
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ sidebarOpen: open });
  },
}));
