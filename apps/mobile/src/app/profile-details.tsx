import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErrorBox, Group, PageHeader, Row, Screen, SoonTag } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/**
 * Profile details design: name, email, gender, birthday, "Save changes".
 * The API stores name and phone today; gender and birthday need backend fields (shown "Soon").
 */
export default function ProfileDetails() {
  const { me, setMe, handleAuthError } = useSession();
  const [name, setName] = useState(me?.name ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!me) return <Redirect href="/(tabs)/you" />;

  const changed = name.trim() !== (me.name ?? '') || phone.trim() !== (me.phone ?? '');

  async function save() {
    if (!name.trim()) return setError('Your name cannot be empty.');
    if (phone.trim() && !/^\+?[0-9]{7,15}$/.test(phone.trim())) {
      return setError('Enter the phone number with digits only, e.g. +201001234567.');
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMe(
        await api.updateMe({
          name: name.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      );
      setMessage('Saved');
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="Profile details" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Group>
          <View style={styles.inputRow}>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setMessage(null);
              }}
              placeholder="Your name"
              placeholderTextColor={theme.placeholder}
              style={styles.input}
              autoComplete="name"
              accessibilityLabel="Name"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={[styles.input, styles.readOnly]} numberOfLines={1}>
              {me.email ?? 'No email'}
            </Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setMessage(null);
              }}
              placeholder="Phone (optional)"
              placeholderTextColor={theme.placeholder}
              style={styles.input}
              keyboardType="phone-pad"
              autoComplete="tel"
              accessibilityLabel="Phone"
            />
          </View>
          <Row label="Gender" disabled right={<SoonTag />} />
          <Row label="Birthday" disabled right={<SoonTag />} />
          <Pressable
            accessibilityRole="button"
            disabled={!changed || busy}
            onPress={() => void save()}
            style={styles.saveRow}
          >
            <Text style={[styles.save, (!changed || busy) && styles.saveOff]}>
              {busy ? 'Saving…' : message ?? 'Save changes'}
            </Text>
          </Pressable>
        </Group>
        <ErrorBox message={error} />
        <Text style={styles.note}>
          Your email is the one you sign in with. Shops never see your name, email or phone.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, gap: 14, paddingBottom: 40 },
  inputRow: { height: theme.rowHeight, justifyContent: 'center' },
  input: { fontSize: 17, color: theme.text, paddingVertical: 0 },
  readOnly: { color: theme.muted },
  saveRow: { height: theme.rowHeight, alignItems: 'center', justifyContent: 'center' },
  save: { fontSize: 17, color: theme.link },
  saveOff: { color: theme.placeholder },
  note: { fontSize: 13, color: theme.muted, textAlign: 'center', paddingHorizontal: 12 },
});
