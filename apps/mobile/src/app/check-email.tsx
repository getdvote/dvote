import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen } from '../components/ui';
import { theme } from '../lib/theme';

/** After email sign-up: Supabase sent a confirmation link. */
export default function CheckEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Ionicons name="mail-unread-outline" size={40} color={theme.text} />
        </View>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.text}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.email}>{email ?? 'your email'}</Text>.{'\n'}Open it on this phone to finish
          creating your account.
        </Text>
        <Text style={styles.hint}>No email? Check your spam folder, or try again in a few minutes.</Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Back to log in" onPress={() => router.replace('/welcome')} />
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
