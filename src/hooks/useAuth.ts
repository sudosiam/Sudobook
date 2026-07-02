import { useEffect } from 'react';
import { db } from '@/lib/db';
import { isDexieCloudConfigured, isCloudLoggedIn } from '@/lib/cloud';
import { pendingSyncCount } from '@/lib/sync';
import { seedDatabase } from '@/lib/seed';
import { toast } from '@/store/useToast';
import { useAppStore } from '@/store/useAppStore';

/** Dexie Cloud auth — OTP email login. App works offline without signing in. */
export function useAuth() {
  const activeUserId = useAppStore((s) => s.activeUserId);
  const userEmail = useAppStore((s) => s.userEmail);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    if (!isDexieCloudConfigured) {
      setUser(null, null);
      return;
    }

    const applyUser = () => {
      const user = db.cloud.currentUser.value;
      if (user.isLoggedIn && user.userId) {
        setUser(user.userId, user.email ?? null);
      } else {
        setUser(null, null);
      }
    };

    applyUser();
    const sub = db.cloud.currentUser.subscribe(applyUser);
    return () => sub.unsubscribe();
  }, [setUser]);

  const login = async (email?: string) => {
    if (!isDexieCloudConfigured) throw new Error('Cloud sync not configured');
    await db.cloud.login(email ? { email, grant_type: 'otp' } : undefined);
    toast.success('Signed in — cloud backup active');
  };

  const signOut = async () => {
    if (!isDexieCloudConfigured || !isCloudLoggedIn()) return;

    const queued = await pendingSyncCount();
    if (queued > 0) {
      toast.error('Sync still in progress — wait for sync to finish before signing out');
      return;
    }

    await db.cloud.logout({ force: true });
    await seedDatabase();
    toast.info('Signed out — local books reset. Sign in again to restore from cloud.');
  };

  return {
    isCloudConfigured: isDexieCloudConfigured,
    activeUserId,
    userEmail,
    login,
    signOut,
  };
}
