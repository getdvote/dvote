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
import { api, ApiError, SIGN_OUT_CODES, type StaffMe } from './api';
import { supabase } from './supabase';

interface SessionState {
  /** true until the stored login (if any) has been checked */
  loading: boolean;
  session: Session | null;
  me: StaffMe | null;
  /** The branch points are booked at: own branch, or the one a vendor admin picked. */
  branchId: string | null;
  chooseBranch: (id: string) => void;
  /** The QR just checked on the scan screen. Kept in memory, never in the URL. */
  scannedCode: string | null;
  setScannedCode: (code: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Call after an API error: signs out if the login is no longer valid. */
  handleAuthError: (err: unknown) => Promise<boolean>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<StaffMe | null>(null);
  const [pickedBranch, setPickedBranch] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setMe(null);
    setPickedBranch(null);
    setScannedCode(null);
  }, []);

  /** Loads the staff profile; a non-staff or disabled account is signed out. */
  const loadMe = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch (err) {
      await signOut();
      throw err;
    }
  }, [signOut]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadMe().catch(() => undefined);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [loadMe]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new ApiError(401, 'login_failed', error.message === 'Invalid login credentials'
          ? 'Wrong email or password.'
          : error.message);
      }
      await loadMe();
    },
    [loadMe],
  );

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
    () => ({
      loading,
      session,
      me,
      branchId: me?.branch?.id ?? pickedBranch ?? (me?.branches.length === 1 ? me.branches[0].id : null),
      chooseBranch: setPickedBranch,
      scannedCode,
      setScannedCode,
      signIn,
      signOut,
      handleAuthError,
    }),
    [loading, session, me, pickedBranch, scannedCode, signIn, signOut, handleAuthError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
