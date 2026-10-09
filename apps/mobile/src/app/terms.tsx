import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '../components/Text';
import { PageHeader, PillButton, Screen } from '../components/ui';
import { useI18n } from '../i18n';
import { config } from '../lib/config';
import { theme } from '../lib/theme';

/**
 * Terms and conditions (You → More, About). The text is a web page served by the API
 * (apps/api/public/legal/terms.html, terms-ar.html in Arabic), shown here in a WebView, so it can be
 * edited and redeployed without a new app release. Links that leave the page open outside the app.
 */
export default function Terms() {
  const { t, language } = useI18n();
  const url = `${config.apiUrl}/legal/${language === 'ar' ? 'terms-ar' : 'terms'}.html`;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumped by "Try again" to reload

  return (
    <Screen>
      <PageHeader title={t('info.termsTitle')} />
      {failed ? (
        <View style={styles.middle}>
          <Text style={styles.text}>{t('info.termsFailed')}</Text>
          <PillButton
            title={t('common.tryAgain')}
            onPress={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      ) : (
        <WebView
          key={attempt}
          source={{ uri: url }}
          style={styles.web}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.text} />
            </View>
          )}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          // only the terms page itself loads here; mail and other sites open outside the app
          onShouldStartLoadWithRequest={(req) => {
            if (req.url === url || req.url.startsWith(`${url}#`)) return true;
            void Linking.openURL(req.url).catch(() => undefined);
            return false;
          }}
          originWhitelist={['*']}
          allowsBackForwardNavigationGestures={false}
          setSupportMultipleWindows={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: theme.background },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32, paddingBottom: 80 },
  text: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21 },
});
