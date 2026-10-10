import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, errorMessage, vendorApi, type AdminMe, type StaffMe } from './api';
import { supabase } from './supabase';

/**
 * Platform-admin sign-in: email + password, then a 6-digit code from an authenticator app
 * (Supabase MFA). The API only accepts two-factor tokens (aal2), unless the server runs
 * with ADMIN_MFA_REQUIRED=false (local development).
 *
 * The same screen signs in vendor accounts (vendor admins and branch managers, from
 * /api/vendor/staff/me): they see only their own vendor. Plain staff use the staff app.
 *
 *   signedOut → (password) → mfaVerify (has an authenticator) ──code──┐
 *                          → mfaEnroll (none yet: scan a QR) ──code──┤→ ready
 *                          → ready (server doesn't require MFA)      ┘
 */
export type AuthStatus = 'loading' | 'signedOut' | 'mfaVerify' | 'mfaEnroll' | 'ready';

export interface Enrollment {
  factorId: string;
  qrCode: string; // SVG data URL to show as an image
  secret: string; // for typing into the app by hand
}

interface AuthState {
  status: AuthStatus;
  admin: AdminMe | null;
  /** Set when a vendor account (not a platform admin) is signed in. */
  staff: StaffMe | null;
  /** Shown on the sign-in screen (e.g. "not a dvote admin"). */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  startEnroll: () => Promise<Enrollment>;
  confirmEnroll: (factorId: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [staff, setStaff] = useState<StaffMe | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined);
    setAdmin(null);
    setStaff(null);
    setStatus('signedOut');
  }, []);

  /** Not a platform admin: maybe a vendor account. */
  const resolveVendor = useCallback(async () => {
    try {
      const me = await vendorApi.me();
      if (me.role === 'staff') {
        setNotice('Staff accounts use the dvote staff app. The dashboard is for merchant admins and branch managers.');
        await signOut();
        return;
      }
      setStaff(me);
      setNotice(null);
      setStatus('ready');
    } catch (err) {
      setNotice(err instanceof ApiError && err.code === 'not_staff' ? 'This account has no access to the dvote dashboard.' : errorMessage(err));
      await signOut();
    }
  }, [signOut]);

  /** After a password (or a stored session): decide what's still needed. */
  const resolve = useCallback(async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      setStatus('mfaVerify');
      return;
    }
    try {
      setAdmin(await api.me());
      setNotice(null);
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'mfa_required') {
        setStatus('mfaEnroll');
        return;
      }
      if (err instanceof ApiError && err.code === 'not_admin') {
        await resolveVendor();
        return;
      }
      setNotice(errorMessage(err));
      await signOut();
    }
  }, [signOut, resolveVendor]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => (data.session ? resolve() : setStatus('signedOut')));
  }, [resolve]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setNotice(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
      await resolve();
    },
    [resolve],
  );

  const verifyCode = useCallback(
    async (code: string) => {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp.find((f) => f.status === 'verified');
      if (!factor) {
        setStatus('mfaEnroll');
        return;
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw new Error('That code is not right. Try the newest one from your app.');
      await resolve();
    },
    [resolve],
  );

  const startEnroll = useCallback(async (): Promise<Enrollment> => {
    // Clear half-finished setups from earlier attempts first.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `dvote dashboard ${Date.now()}` });
    if (error || !data) throw new Error(error?.message ?? 'Could not start the authenticator setup.');
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }, []);

  const confirmEnroll = useCallback(
    async (factorId: string, code: string) => {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw new Error('That code is not right. Try the newest one from your app.');
      await resolve();
    },
    [resolve],
  );

  const value = useMemo(
    () => ({ status, admin, staff, notice, signIn, verifyCode, startEnroll, confirmEnroll, signOut }),
    [status, admin, staff, notice, signIn, verifyCode, startEnroll, confirmEnroll, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
