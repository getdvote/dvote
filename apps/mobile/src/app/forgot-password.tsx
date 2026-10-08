import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { ErrorBox, Field, PageHeader, PrimaryButton, Screen } from '../components/ui';
import { sendPasswordReset } from '../lib/auth';
import { theme } from '../lib/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(clean);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="Reset password" />
      <View style={styles.body}>
        {sent ? (
          <Text style={styles.text}>
            If an account exists for <Text style={styles.bold}>{email.trim()}</Text>, we sent a link to set a new
            password. Open it on this phone.
          </Text>
        ) : (
          <>
            <Text style={styles.text}>Enter your email and we'll send you a link to set a new password.</Text>
            <Field
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={() => void send()}
            />
            <ErrorBox message={error} />
            <PrimaryButton title="Send reset link" onPress={() => void send()} loading={busy} />
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
