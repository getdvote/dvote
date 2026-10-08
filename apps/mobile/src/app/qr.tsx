import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { PrimaryButton, Screen } from '../components/ui';
import { theme } from '../lib/theme';

/**
 * QR button (tab bar). The API is ready (POST /api/app/qr-codes); this screen is the next
 * step: draw the QR, poll it, and show "+N points" when the staff scan it.
 */
export default function Qr() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Ionicons name="qr-code-outline" size={40} color={theme.text} />
        </View>
        <Text style={styles.heading}>Your QR code</Text>
        <Text style={styles.text}>
          Soon you'll show your QR here at the counter to collect points and redeem rewards.
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Close" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 22, fontWeight: '700', color: theme.text },
  text: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21 },
  footer: { paddingHorizontal: theme.gutter, paddingBottom: 16 },
});
