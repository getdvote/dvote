import Facebook01Icon from '@hugeicons/core-free-icons/Facebook01Icon';
import GoogleIcon from '@hugeicons/core-free-icons/GoogleIcon';
import { Icon } from '../components/Icon';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/Text';
import { useI18n } from '../i18n';
import { DvoteLogo } from '../components/DvoteLogo';
import { ErrorBox, Field, PillButton, PrimaryButton, Screen } from '../components/ui';
import { signInWithEmail, signInWithProvider, signUpWithEmail } from '../lib/auth';
import { useSession } from '../lib/session';
import { theme, squircle } from '../lib/theme';

type Mode = 'login' | 'signup';

/** Log in / Sign up: Google, Facebook, or email + password. */
export default function Welcome() {
  const { session } = useSession();
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t('auth.signInFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'signup' && !name.trim()) return setError(t('auth.enterName'));
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError(t('auth.invalidEmail'));
    if (password.length < 6) return setError(t('auth.shortPassword'));
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
      setError(err instanceof Error ? err.message : t('common.somethingWrong'));
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
              {mode === 'login' ? t('auth.welcomeBack') : t('auth.createTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {t('auth.subtitle')}
            </Text>
          </View>

          <View style={styles.socials}>
            <PillButton
              title={t('auth.google')}
              onPress={() => void social('google')}
              loading={busy === 'google'}
              icon={<Icon icon={GoogleIcon} size={20} color="#EA4335" />}
            />
            <PillButton
              title={t('auth.facebook')}
              onPress={() => void social('facebook')}
              loading={busy === 'facebook'}
              icon={<Icon icon={Facebook01Icon} size={21} color="#1877F2" />}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>{t('auth.orEmail')}</Text>
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
                  {m === 'login' ? t('auth.login') : t('auth.signup')}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.form}>
            {mode === 'signup' ? (
              <Field
                placeholder={t('auth.fullName')}
                value={name}
                onChangeText={setName}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
              />
            ) : null}
            <Field
              placeholder={t('common.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <Field
              placeholder={mode === 'signup' ? t('auth.passwordNew') : t('auth.password')}
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
              title={mode === 'login' ? t('auth.login') : t('auth.createAccount')}
              onPress={() => void submit()}
              loading={busy === 'email'}
            />
            {mode === 'login' ? (
              <Pressable onPress={() => router.push('/forgot-password')} hitSlop={10}>
                <Text style={styles.link}>{t('auth.forgot')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.legal}>
                {t('auth.legal')}
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
    ...squircle,
    flexDirection: 'row',
    backgroundColor: theme.fill,
    borderRadius: 22,
    padding: 3,
    marginBottom: 16,
  },
  segmentItem: { ...squircle, flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: theme.surface },
  segmentText: { fontSize: 15, fontWeight: '600', color: theme.muted },
  segmentTextOn: { color: theme.text },
  form: { gap: 12 },
  link: { textAlign: 'center', fontSize: 15, color: theme.link, marginTop: 4 },
  legal: { textAlign: 'center', fontSize: 12, color: theme.muted, lineHeight: 17 },
});
