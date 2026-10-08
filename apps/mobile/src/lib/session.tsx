import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, SIGN_OUT_CODES, type Me } from './api';
import { supabase } from './supabase';

interface SessionState {
  /** true until the stored sign-in (if any) has been checked */
  loading: boolean;
  session: Session | null;
  me: Me | null;
  /** Error loading the profile right after sign-in (e.g. blocked account). */
  meError: string | null;
  refreshMe: () => Promise<void>;
  setMe: (me: Me) => void;
  signOut: () => Promise<void>;
  /** Call after an API error: signs out if the sign-in is no longer valid. */
  handleAuthError: (err: unknown) => Promise<boolean>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setMe(null);
  }, []);

  /** Loads (and on the first visit creates) the customer profile. */
  const refreshMe = useCallback(async () => {
    try {
      setMeError(null);
      setMe(await api.me());
    } catch (err) {
      setMeError(err instanceof ApiError ? err.message : 'Could not load your profile.');
      if (err instanceof ApiError && SIGN_OUT_CODES.has(err.code)) await signOut();
    }
  }, [signOut]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refreshMe();
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (!next) setMe(null);
      if (event === 'SIGNED_IN') void refreshMe();
    });
    return () => data.subscription.unsubscribe();
  }, [refreshMe]);

  const handleAuthError = useCallback(
    async (err: unknown) => {
      if (err instanceof ApiError && SIGN_OUT_CODES.has(err.code)) {
        await signOut();
        return true;
      }
      return false;
    },
    [signOut],
  );

  const value = useMemo<SessionState>(
    () => ({ loading, session, me, meError, refreshMe, setMe, signOut, handleAuthError }),
    [loading, session, me, meError, refreshMe, signOut, handleAuthError],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
