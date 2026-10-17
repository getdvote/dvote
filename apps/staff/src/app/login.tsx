import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Text, ErrorBox, Field, PrimaryButton, Screen, TextLink, showHelp } from '../components/ui';
import { ApiError } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Design 1: "Login with your provided account" (accounts are created by the vendor). */
export default function Login() {
  const { me, signIn, accessError } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me) return <Redirect href="/home" />;

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.brand}>
          <Image
            source={require('../../assets/dvote-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="dvote"
          />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in with your staff account.</Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <Field
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secure
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <ErrorBox message={error ?? accessError} />
          <View style={styles.actions}>
            <PrimaryButton title="Login" onPress={submit} loading={busy} />
            <TextLink title="Need help?" onPress={showHelp} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  brand: { alignItems: 'center', paddingTop: 56, gap: 16 },
  logo: { width: 60, height: 54 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: { fontSize: 14, color: theme.muted, textAlign: 'center' },
  form: { marginTop: 32, gap: 20, padding: 20, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  actions: { marginTop: 8, gap: 28 },
});
