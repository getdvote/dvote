import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { useI18n } from '../i18n';
import { PrimaryButton, Screen } from '../components/ui';
import { completeSignInFromUrl } from '../lib/auth';
import { theme } from '../lib/theme';

/**
 * The app is opened here by links from Supabase: Google / Facebook sign-in, email
 * confirmation, password reset (dvote://auth-callback?code=…).
 */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    completeSignInFromUrl(url)
      .then((kind) => router.replace(kind === 'recovery' ? '/reset-password' : '/(tabs)/cards'))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t('auth.callbackLinkFailed')));
  }, [url, t]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.middle}>
        {error ? (
          <>
            <Text style={styles.title}>{t('auth.callbackFailed')}</Text>
            <Text style={styles.text}>{error}</Text>
            <PrimaryButton title={t('common.backToLogin')} onPress={() => router.replace('/welcome')} />
          </>
        ) : (
          <>
            <ActivityIndicator color={theme.text} />
            <Text style={styles.text}>{t('auth.callbackSigningIn')}</Text>
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
