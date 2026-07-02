import { useEffect } from 'react';
import { db } from '@/lib/db';
import { isDexieCloudConfigured, isCloudLoggedIn } from '@/lib/cloud';
import { pendingSyncCount, syncNow } from '@/lib/sync';
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

    // db.cloud.login() resolves when the popup closes — either after successful
    // OTP verification or when the user dismisses the popup. The BehaviorSubject
    // currentUser.value may not yet reflect the new state by the time we check,
    // because the observable update is queued as a microtask. Wait up to 2 s for
    // the first logged-in emission.
    const loggedIn = await new Promise<boolean>((resolve) => {
      // Check current state first (may already be updated).
      if (db.cloud.currentUser.value.isLoggedIn) {
        resolve(true);
        return;
      }
      const deadline = setTimeout(() => resolve(false), 2000);
      const sub = db.cloud.currentUser.subscribe((user) => {
        if (user.isLoggedIn) {
          clearTimeout(deadline);
          sub.unsubscribe();
          resolve(true);
        }
      });
    });

    if (!loggedIn) {
      // Popup was dismissed without completing OTP — not an error, just inform.
      throw new Error('Sign-in not completed — please enter the code from the email');
    }

    toast.success('Signed in — pulling your cloud data…');

    // Pull immediately so data from other devices appears without waiting
    // for the next automatic sync cycle.
    void syncNow().catch((err) => {
      console.warn('[login] initial sync failed:', err);
    });
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
