import { createContext } from 'react';
import type { AdminMe, StaffMe } from './api';

export type AuthStatus = 'loading' | 'signedOut' | 'mfaVerify' | 'mfaEnroll' | 'ready' | 'trialEnded';

export interface Enrollment {
  factorId: string;
  qrCode: string; // SVG data URL to show as an image
  secret: string; // for typing into the app by hand
}

export interface AuthState {
  status: AuthStatus;
  admin: AdminMe | null;
  /** Set when a vendor account (not a platform admin) is signed in. */
  staff: StaffMe | null;
  /** Shown on the sign-in screen (e.g. "not a dvote admin"). */
  notice: string | null;
  /** Set with status 'trialEnded': the shop's free trial is over. */
  trial: { trialEndedAt: string | null; deleteAt: string | null } | null;
  signIn: (email: string, password: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  startEnroll: () => Promise<Enrollment>;
  confirmEnroll: (factorId: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Kept in its own module with only type imports, so hot reloads of auth.tsx or api.ts during
 * development don't create a second context (that showed "useAuth must be used inside <AuthProvider>").
 */
export const AuthContext = createContext<AuthState | null>(null);
