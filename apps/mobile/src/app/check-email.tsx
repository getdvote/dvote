import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import { Icon } from '../components/Icon';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { useI18n } from '../i18n';
import { PrimaryButton, Screen } from '../components/ui';
import { theme } from '../lib/theme';

/** After email sign-up: Supabase sent a confirmation link. */
export default function CheckEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { t } = useI18n();
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Icon icon={Mail01Icon} size={40} color={theme.text} />
        </View>
        <Text style={styles.title}>{t('auth.checkTitle')}</Text>
        <Text style={styles.text}>
          {t('auth.checkSentTo')}
          {'\n'}
          <Text style={styles.email}>{email ?? t('auth.checkYourEmail')}</Text>
          {'\n'}
          {t('auth.checkOpen')}
        </Text>
        <Text style={styles.hint}>{t('auth.checkHint')}</Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title={t('common.backToLogin')} onPress={() => router.replace('/welcome')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '700', color: theme.text },
  text: { fontSize: 16, color: theme.secondary, textAlign: 'center', lineHeight: 23 },
  email: { fontWeight: '600', color: theme.text },
  hint: { fontSize: 14, color: theme.muted, textAlign: 'center' },
  footer: { paddingHorizontal: theme.gutter, paddingBottom: 16 },
});
