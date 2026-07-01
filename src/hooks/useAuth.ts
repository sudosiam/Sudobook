import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { pendingSyncCount, runSync } from '@/lib/sync';
import { toast } from '@/store/useToast';
import { useAppStore } from '@/store/useAppStore';

/** Supabase auth state + actions. No-op friendly when Supabase is absent. */
export function useAuth() {
  const activeUserId = useAppStore((s) => s.activeUserId);
  const userEmail = useAppStore((s) => s.userEmail);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user.id ?? null, data.session?.user.email ?? null);
      if (data.session) void runSync();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user.id ?? null, session?.user.email ?? null);
      if (session) void runSync();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setUser]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sync not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud sync not configured');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) return;
    const queued = await pendingSyncCount();
    if (queued > 0) {
      toast.error(
        `${queued} change(s) not yet in cloud — sign in again with the same account to resume sync`,
      );
    }
    await supabase.auth.signOut();
  };

  return { isSupabaseConfigured, activeUserId, userEmail, signIn, signUp, signOut };
}
