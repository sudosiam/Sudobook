import { create } from 'zustand';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: string | null;
  isOnline: boolean;
  setStatus: (s: SyncStatus) => void;
  setPendingCount: (n: number) => void;
  setOnline: (v: boolean) => void;
  setLastSync: (ts: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  lastSyncAt: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setOnline: (isOnline) => set({ isOnline }),
  setLastSync: (lastSyncAt) => set({ lastSyncAt }),
}));
