import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getMyProfile } from '../api/profiles';
import { getMySubscription, signOut as apiSignOut, type SubscriptionInfo } from '../api/auth';
import type { Profile, UserRole } from '../types/database.types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  subscription: SubscriptionInfo | null; // players only
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setSubscription(null);
      return;
    }
    try {
      const p = await getMyProfile(s.user.id);
      setProfile(p);
      if (p?.role === 'player') {
        setSubscription(await getMySubscription(s.user.id));
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      setProfile(null);
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Initial session read.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadUserData(data.session);
      if (mounted) setLoading(false);
    });

    // Subscribe to future auth changes (login/logout/token refresh).
    const {
      data: { subscription: sub },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      await loadUserData(s);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setSession(null);
    setProfile(null);
    setSubscription(null);
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (session?.user.id && profile?.role === 'player') {
      setSubscription(await getMySubscription(session.user.id));
    }
  }, [session, profile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role: profile?.role ?? null,
        subscription,
        loading,
        signOut,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
