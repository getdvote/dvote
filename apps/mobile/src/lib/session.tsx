import type { Session } from '@supabase/supabase-js';
import { t } from '../i18n';
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

  /**
   * Signs out and clears the session here at once. (Supabase's SIGNED_OUT event clears it a
   * moment later; until then the welcome screen still saw a session and sent the customer
   * straight back to their cards, so logging out looked like it did nothing.)
   */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined); // the local session is removed even if the server call fails
    setSession(null);
    setMe(null);
  }, []);

  /** Loads (and on the first visit creates) the customer profile. */
  const refreshMe = useCallback(async () => {
    try {
      setMeError(null);
      const fresh = await api.me();
      // The avatar comes as a new signed link each time; keep the old link while it is the
      // same file, so the photo doesn't reload on every refresh.
      const samePhoto = (a: string | null, b: string | null) => !!a && !!b && a.split('?')[0] === b.split('?')[0];
      setMe((old) => (old && samePhoto(old.avatarUrl, fresh.avatarUrl) ? { ...fresh, avatarUrl: old.avatarUrl } : fresh));
    } catch (err) {
      setMeError(err instanceof ApiError ? err.message : t('errors.couldNotLoadProfile'));
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
