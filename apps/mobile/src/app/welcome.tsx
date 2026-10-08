import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DvoteLogo } from '../components/DvoteLogo';
import { ErrorBox, Field, PillButton, PrimaryButton, Screen } from '../components/ui';
import { signInWithEmail, signInWithProvider, signUpWithEmail } from '../lib/auth';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

type Mode = 'login' | 'signup';

/** Log in / Sign up: Google, Facebook, or email + password. */
export default function Welcome() {
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | 'facebook' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/(tabs)/cards" />;

  async function social(provider: 'google' | 'facebook') {
    setError(null);
    setBusy(provider);
    try {
      if (await signInWithProvider(provider)) router.replace('/(tabs)/cards');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'signup' && !name.trim()) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    setBusy('email');
    try {
      if (mode === 'login') {
        await signInWithEmail(cleanEmail, password);
        router.replace('/(tabs)/cards');
      } else {
        const mustConfirm = await signUpWithEmail(name.trim(), cleanEmail, password);
        if (mustConfirm) router.replace({ pathname: '/check-email', params: { email: cleanEmail } });
        else router.replace('/(tabs)/cards');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <DvoteLogo height={44} />
            <Text style={styles.title}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              Collect points at your favourite coffee shops{'\n'}and turn them into free treats.
            </Text>
          </View>

          <View style={styles.socials}>
            <PillButton
              title="Continue with Google"
              onPress={() => void social('google')}
              loading={busy === 'google'}
              icon={<FontAwesome name="google" size={20} color="#EA4335" />}
            />
            <PillButton
              title="Continue with Facebook"
              onPress={() => void social('facebook')}
              loading={busy === 'facebook'}
              icon={<FontAwesome name="facebook-square" size={21} color="#1877F2" />}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>or with email</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.segment} accessibilityRole="tablist">
            {(['login', 'signup'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
                style={[styles.segmentItem, mode === m && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>
                  {m === 'login' ? 'Log in' : 'Sign up'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.form}>
            {mode === 'signup' ? (
              <Field
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
              />
            ) : null}
            <Field
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <Field
              placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'}
              value={password}
              onChangeText={setPassword}
              secure
              autoCapitalize="none"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
            <ErrorBox message={error} />
            <PrimaryButton
              title={mode === 'login' ? 'Log in' : 'Create account'}
              onPress={() => void submit()}
              loading={busy === 'email'}
            />
            {mode === 'login' ? (
              <Pressable onPress={() => router.push('/forgot-password')} hitSlop={10}>
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            ) : (
              <Text style={styles.legal}>
                By creating an account you agree to the dvote Terms and Privacy Policy.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: theme.gutter, paddingTop: 32, paddingBottom: 32 },
  brand: { alignItems: 'center', gap: 12, marginBottom: 28 },
  title: { fontSize: 28, fontWeight: '700', color: theme.text, marginTop: 12 },
  subtitle: { fontSize: 15, color: theme.muted, textAlign: 'center', lineHeight: 21 },
  socials: { gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.placeholder },
  or: { fontSize: 13, color: theme.muted },
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.fill,
    borderRadius: 22,
    padding: 3,
    marginBottom: 16,
  },
  segmentItem: { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: theme.surface },
  segmentText: { fontSize: 15, fontWeight: '600', color: theme.muted },
  segmentTextOn: { color: theme.text },
  form: { gap: 12 },
  link: { textAlign: 'center', fontSize: 15, color: theme.link, marginTop: 4 },
  legal: { textAlign: 'center', fontSize: 12, color: theme.muted, lineHeight: 17 },
});
