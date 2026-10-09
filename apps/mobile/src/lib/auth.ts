import AsyncStorage from '@react-native-async-storage/async-storage';
import { t, type TKey } from '../i18n';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/**
 * Where Supabase sends people back after Google / Facebook / email links:
 * dvote://auth-callback in a build, exp://<PC>:8081/--/auth-callback in Expo Go.
 * Both must be allowed in Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export const authRedirectUrl = () => makeRedirectUri({ path: 'auth-callback' });

const RECOVERY_FLAG = 'dvote-password-recovery';

/** Opens the Google / Facebook page; resolves true when signed in, false if cancelled. */
export async function signInWithProvider(provider: 'google' | 'facebook'): Promise<boolean> {
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error(error?.message ?? t('auth.couldNotStart'));
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  await completeSignInFromUrl(result.url);
  return true;
}

/** Sign-up with email + password. Returns true when the email must be confirmed first. */
export async function signUpWithEmail(name: string, email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
  return !data.session;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function sendPasswordReset(email: string): Promise<void> {
  await AsyncStorage.setItem(RECOVERY_FLAG, '1');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendlyAuthError(error.message));
  await AsyncStorage.removeItem(RECOVERY_FLAG);
}

const handledCodes = new Set<string>();

/**
 * Finishes a sign-in from a link the app was opened with (OAuth, email confirmation,
 * password reset). Safe to call twice for the same link. Returns 'recovery' for a
 * password-reset link, 'signed-in' otherwise.
 */
export async function completeSignInFromUrl(url: string): Promise<'recovery' | 'signed-in'> {
  const params = parseUrlParams(url);
  if (params.error_description || params.error) {
    throw new Error(friendlyAuthError(params.error_description ?? params.error));
  }
  if (params.code && !handledCodes.has(params.code)) {
    handledCodes.add(params.code);
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    // The same link can arrive twice on Android (browser result + deep link): only a
    // failure without any session is a real failure.
    if (error && !(await supabase.auth.getSession()).data.session) {
      throw new Error(friendlyAuthError(error.message));
    }
    // supabase-js marks a password-reset PKCE flow as redirectType 'recovery'
    if ((data as { redirectType?: string | null } | null)?.redirectType === 'recovery') return 'recovery';
  } else if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    if (params.type === 'recovery') return 'recovery';
  }
  if ((await AsyncStorage.getItem(RECOVERY_FLAG)) === '1') return 'recovery';
  return 'signed-in';
}

/** Query and #fragment parameters of a URL (no URL polyfill needed). */
function parseUrlParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of [url.split('?')[1]?.split('#')[0], url.split('#')[1]]) {
    for (const pair of (part ?? '').split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return out;
}

/** Supabase's English auth errors, in the app language. */
function friendlyAuthError(message: string): string {
  const map: Record<string, TKey> = {
    'Invalid login credentials': 'auth.wrongPassword',
    'Email not confirmed': 'auth.notConfirmed',
    'User already registered': 'auth.alreadyRegistered',
    'Password should be at least 6 characters.': 'auth.shortPassword',
  };
  if (/rate limit/i.test(message)) return t('auth.rateLimited');
  return map[message] ? t(map[message]) : message;
}
