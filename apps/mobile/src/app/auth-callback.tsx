import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen } from '../components/ui';
import { completeSignInFromUrl } from '../lib/auth';
import { theme } from '../lib/theme';

/**
 * The app is opened here by links from Supabase: Google / Facebook sign-in, email
 * confirmation, password reset (dvote://auth-callback?code=…).
 */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    completeSignInFromUrl(url)
      .then((kind) => router.replace(kind === 'recovery' ? '/reset-password' : '/(tabs)/cards'))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'This link did not work.'));
  }, [url]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.middle}>
        {error ? (
          <>
            <Text style={styles.title}>Couldn't sign you in</Text>
            <Text style={styles.text}>{error}</Text>
            <PrimaryButton title="Back to log in" onPress={() => router.replace('/welcome')} />
          </>
        ) : (
          <>
            <ActivityIndicator color={theme.text} />
            <Text style={styles.text}>Signing you in…</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: theme.text },
  text: { fontSize: 16, color: theme.secondary, textAlign: 'center' },
});
