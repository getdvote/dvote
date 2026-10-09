import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { useI18n } from '../i18n';
import { ErrorBox, Field, PageHeader, PrimaryButton, Screen } from '../components/ui';
import { setNewPassword } from '../lib/auth';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Opened from the password-reset email (the link already signed the person in). */
export default function ResetPassword() {
  const { session } = useSession();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return <Redirect href="/welcome" />;

  async function save() {
    if (password.length < 6) return setError(t('auth.newShort'));
    setBusy(true);
    setError(null);
    try {
      await setNewPassword(password);
      router.replace('/(tabs)/cards');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.newCouldNotSave'));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title={t('auth.newTitle')} onBack={() => router.replace('/(tabs)/cards')} />
      <View style={styles.body}>
        <Text style={styles.text}>{t('auth.newIntro')}</Text>
        <Field placeholder={t('auth.newPlaceholder')} value={password} onChangeText={setPassword} secure autoComplete="new-password" />
        <ErrorBox message={error} />
        <PrimaryButton title={t('auth.newSave')} onPress={() => void save()} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: theme.gutter, gap: 14 },
  text: { fontSize: 16, color: theme.secondary },
});
