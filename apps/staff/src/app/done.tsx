import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen, VendorHeader } from '../components/ui';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/**
 * Design 5: "380 points granted, Thanks!" + Back home. After a reward (`kind=redeem`):
 * "Reward given: <reward>", the points taken and what the customer has left.
 */
export default function Done() {
  const { me, branchId } = useSession();
  const { kind, points, amount, currency, reward, balance, customer } = useLocalSearchParams<{
    kind?: 'collect' | 'redeem';
    points: string;
    amount?: string;
    currency?: string;
    reward?: string;
    balance?: string;
    customer?: string;
  }>();
  if (!me) return <Redirect href="/login" />;
  const n = Number(points ?? 0);
  const branch = me.branches.find((b) => b.id === branchId);

  return (
    <Screen>
      <VendorHeader vendorName={me.vendor.name} logoUrl={me.vendor.logoUrl} branchName={branch?.name} />
      <View style={styles.middle} accessibilityLiveRegion="polite">
        {kind === 'redeem' ? (
          <>
            <Text style={styles.big}>Reward given:{'\n'}{reward}</Text>
            <Text style={styles.detail}>
              {n.toLocaleString('en-US')} points taken{customer ? ` from ${customer}` : ''}.
            </Text>
            {balance ? <Text style={styles.detail}>The customer has {Number(balance).toLocaleString('en-US')} points left.</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.big}>
              {n} {n === 1 ? 'point' : 'points'} granted,{'\n'}Thanks!
            </Text>
            {amount ? (
              <Text style={styles.detail}>
                for a bill of {amount} {currency}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Back home" onPress={() => router.replace('/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1, justifyContent: 'center', gap: 12 },
  big: { fontSize: 32, fontWeight: '700', color: theme.text, textAlign: 'center', lineHeight: 40 },
  detail: { fontSize: 15, color: theme.muted, textAlign: 'center' },
  footer: { paddingBottom: 24 },
});
