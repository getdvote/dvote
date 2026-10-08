import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorBox, Field, PageHeader, PrimaryButton, Screen } from '../components/ui';
import { setNewPassword } from '../lib/auth';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Opened from the password-reset email (the link already signed the person in). */
export default function ResetPassword() {
  const { session } = useSession();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session) return <Redirect href="/welcome" />;

  async function save() {
    if (password.length < 6) return setError('Use at least 6 characters.');
    setBusy(true);
    setError(null);
    try {
      await setNewPassword(password);
      router.replace('/(tabs)/cards');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the password.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="New password" onBack={() => router.replace('/(tabs)/cards')} />
      <View style={styles.body}>
        <Text style={styles.text}>Choose a new password for your dvote account.</Text>
        <Field placeholder="New password (6+ characters)" value={password} onChangeText={setPassword} secure autoComplete="new-password" />
        <ErrorBox message={error} />
        <PrimaryButton title="Save password" onPress={() => void save()} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: theme.gutter, gap: 14 },
  text: { fontSize: 16, color: theme.secondary },
});
