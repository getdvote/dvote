import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { useI18n } from '../i18n';
import { ErrorBox, Field, PageHeader, PrimaryButton, Screen } from '../components/ui';
import { sendPasswordReset } from '../lib/auth';
import { theme } from '../lib/theme';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) return setError(t('auth.invalidEmail'));
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(clean);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetCouldNotSend'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title={t('auth.resetTitle')} />
      <View style={styles.body}>
        {sent ? (
          <Text style={styles.text}>
            {t('auth.resetSentBefore')}
            <Text style={styles.bold}>{email.trim()}</Text>
            {t('auth.resetSentAfter')}
          </Text>
        ) : (
          <>
            <Text style={styles.text}>{t('auth.resetIntro')}</Text>
            <Field
              placeholder={t('common.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={() => void send()}
            />
            <ErrorBox message={error} />
            <PrimaryButton title={t('auth.resetSend')} onPress={() => void send()} loading={busy} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: theme.gutter, gap: 14 },
  text: { fontSize: 16, color: theme.secondary, lineHeight: 23 },
  bold: { fontWeight: '600', color: theme.text },
});
