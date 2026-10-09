import { randomUUID } from 'expo-crypto';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorBox, PrimaryButton, Screen, TextLink, VendorHeader } from '../components/ui';
import { api, ApiError, type RedeemPreview } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/**
 * Confirm a reward (after scanning a customer's redeem QR): the reward (photo, name, points)
 * and who is redeeming it (name, points now → after). "Give reward" takes the points from the
 * customer's card on the server; the customer's app shows "Reward redeemed" at once.
 */
export default function Redeem() {
  const { me, branchId, handleAuthError, scannedCode: code, setScannedCode } = useSession();
  const params = useLocalSearchParams<{ preview?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per confirmation: a retry after a network error never takes points twice.
  const idempotencyKey = useRef(randomUUID()).current;

  let preview: RedeemPreview | null = null;
  try {
    preview = params.preview ? (JSON.parse(params.preview) as RedeemPreview) : null;
  } catch {
    preview = null;
  }
  if (!me || !code || !preview) return <Redirect href="/home" />;
  const branch = me.branches.find((b) => b.id === branchId);
  const p = preview;

  async function give() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.redeem({
        code: code!,
        // vendor admins have no branch of their own: send the one picked on Home
        branchId: me!.branch ? undefined : (branchId ?? undefined),
        idempotencyKey,
      });
      setScannedCode(null); // used: never reuse it
      router.replace({
        pathname: '/done',
        params: {
          kind: 'redeem',
          reward: result.rewardName,
          points: String(result.pointsRedeemed),
          balance: String(result.cardBalance),
          customer: p.customerName ?? '',
        },
      });
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <VendorHeader vendorName={me.vendor.name} logoUrl={me.vendor.logoUrl} branchName={branch?.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Confirm reward</Text>

        <View style={styles.card}>
          {p.rewardImageUrl ? (
            <Image source={{ uri: p.rewardImageUrl }} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : null}
          <View style={styles.cardBody}>
            <Text style={styles.reward}>{p.rewardName}</Text>
            {p.rewardNameAr ? <Text style={styles.rewardAr}>{p.rewardNameAr}</Text> : null}
            {p.rewardDescription ? <Text style={styles.muted}>{p.rewardDescription}</Text> : null}
            <Text style={styles.cost}>{p.pointsCost.toLocaleString('en-US')} points</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.customer}>{p.customerName ?? 'dvote customer'}</Text>
            <View style={styles.row}>
              <Text style={styles.muted}>Points now</Text>
              <Text style={styles.value}>{p.balance.toLocaleString('en-US')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.muted}>After this reward</Text>
              <Text style={[styles.value, styles.strong]}>{p.balanceAfter.toLocaleString('en-US')}</Text>
            </View>
          </View>
        </View>

        <ErrorBox message={error} />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Give reward" onPress={give} loading={busy} />
        <TextLink
          title="Cancel"
          onPress={() => {
            setScannedCode(null);
            router.replace('/home');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 16 },
  title: { fontSize: 17, fontWeight: '600', color: theme.text, textAlign: 'center', marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#ECECF1' },
  image: { width: '100%', height: 170, backgroundColor: '#EEE' },
  cardBody: { padding: 16, gap: 4 },
  reward: { fontSize: 22, fontWeight: '700', color: theme.text },
  rewardAr: { fontSize: 17, color: theme.muted, writingDirection: 'rtl' },
  cost: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 6 },
  label: { fontSize: 13, fontWeight: '600', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  customer: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  muted: { fontSize: 15, color: theme.muted },
  value: { fontSize: 15, color: theme.text, fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '700' },
  footer: { paddingBottom: 24, gap: 16 },
});
