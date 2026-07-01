import { create } from 'zustand';
import { getCurrentFY } from '@/lib/sequences';

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
  sidebarOpen: false,
  setCurrentFY: (fy) => set({ currentFY: fy }),
  setUser: (id, email = null) => set({ activeUserId: id, userEmail: email, isAuthLoading: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
