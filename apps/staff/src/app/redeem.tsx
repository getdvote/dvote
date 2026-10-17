import { randomUUID } from 'expo-crypto';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { Text, ErrorBox, PrimaryButton, Screen, TextLink, VendorHeader } from '../components/ui';
import { api, ApiError, friendlyMessage, type RedeemPreview } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/**
 * Confirm a reward (after scanning a customer's redeem QR): the reward (photo, name, points)
 * and who is redeeming it (name, points now → after). "Give reward" takes the points from the
 * customer's card on the server; the customer's app shows "Reward redeemed" at once.
 */
export default function Redeem() {
  const { me, branchId, handleAuthError, scannedCode: code, setScannedCode } = useSession();
  const params = useLocalSearchParams<{ rewardId?: string }>();
  const [preview, setPreview] = useState<RedeemPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per confirmation: a retry after a network error never takes points twice.
  const idempotencyKey = useRef(randomUUID()).current;

  useEffect(() => {
    let active = true;
    if (!code) return;
    void (async () => {
      try {
        const result = await api.preview(code, 'redeem', branchId ?? undefined);
        if (!result.usable) throw new Error(friendlyMessage(result.reason ?? 'qr_invalid'));
        const walletReward = result.wallet?.rewards.find((r) => r.rewardId === params.rewardId);
        if (walletReward && !walletReward.usable)
          throw new Error(friendlyMessage(walletReward.reason ?? 'reward_unavailable'));
        const reward = result.wallet ? walletReward : result.redeem;
        if (!reward) throw new Error(friendlyMessage('reward_unavailable'));
        if (active) setPreview(reward);
      } catch (err) {
        if (!active || (await handleAuthError(err))) return;
        setError(err instanceof Error ? err.message : 'Could not load the reward. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code, branchId, params.rewardId, handleAuthError, refresh]);
  if (!me || !code) return <Redirect href="/home" />;
  if (!preview)
    return (
      <Screen>
        <View style={styles.loading}>
          {loading ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              <ErrorBox message={error} />
              <TextLink
                title="Try again"
                onPress={() => {
                  setLoading(true);
                  setError(null);
                  setRefresh((n) => n + 1);
                }}
              />
            </>
          )}
          <TextLink
            title={params.rewardId ? 'Choose another reward' : 'Back to Redeem'}
            onPress={() =>
              params.rewardId
                ? router.replace('/rewards')
                : router.replace({ pathname: '/home', params: { mode: 'redeem' } })
            }
          />
        </View>
      </Screen>
    );
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
        rewardId: p.rewardId,
        expectedPointsCost: p.pointsCost,
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
            <Image
              source={{ uri: p.rewardImageUrl }}
              style={styles.image}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
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
        {params.rewardId && !busy ? (
          <TextLink title="Choose another reward" onPress={() => router.replace('/rewards')} />
        ) : null}
        <TextLink
          title="Cancel"
          onPress={() => {
            setScannedCode(null);
            router.replace({ pathname: '/home', params: { mode: 'redeem' } });
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', gap: 20 },
  content: { gap: 14, paddingBottom: 16 },
  title: { fontSize: 17, fontWeight: '600', color: theme.text, textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  image: { width: '100%', height: 170, backgroundColor: theme.subtle },
  cardBody: { padding: 16, gap: 4 },
  reward: { fontSize: 22, fontWeight: '700', color: theme.text },
  rewardAr: { fontSize: 17, color: theme.muted, writingDirection: 'rtl' },
  cost: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  customer: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  muted: { fontSize: 15, color: theme.muted },
  value: { fontSize: 15, color: theme.text, fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '700' },
  footer: { paddingBottom: 24, gap: 16 },
});
