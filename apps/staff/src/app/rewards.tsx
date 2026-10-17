import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { ErrorBox, PrimaryButton, Screen, Text, TextLink, VendorHeader } from '../components/ui';
import { api, ApiError, friendlyMessage, type ScanPreview } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Staff select a reward after identifying a customer with their saved Wallet card. */
export default function Rewards() {
  const { me, branchId, scannedCode: code, setScannedCode, handleAuthError } = useSession();
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    if (!code) return;
    void (async () => {
      try {
        const result = await api.preview(code, 'redeem', branchId ?? undefined);
        if (!result.usable)
          throw new ApiError(
            409,
            result.reason ?? 'qr_invalid',
            friendlyMessage(result.reason ?? 'qr_invalid'),
          );
        if (!result.wallet) throw new Error('Scan the customer’s Wallet card to choose a reward.');
        if (active) setPreview(result);
      } catch (err) {
        if (!active || (await handleAuthError(err))) return;
        setError(err instanceof Error ? err.message : 'Could not load rewards. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code, branchId, handleAuthError, refresh]);

  if (!me || !code) return <Redirect href="/home" />;
  const branch = me.branches.find((b) => b.id === branchId);
  const wallet = preview?.wallet;
  return (
    <Screen>
      <VendorHeader vendorName={me.vendor.name} logoUrl={me.vendor.logoUrl} branchName={branch?.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Choose a reward</Text>
        {loading ? <ActivityIndicator color={theme.text} /> : null}
        <ErrorBox message={error} />
        {error ? (
          <TextLink
            title="Try again"
            onPress={() => {
              setLoading(true);
              setError(null);
              setRefresh((n) => n + 1);
            }}
          />
        ) : null}
        {!loading && !error && wallet ? (
          <>
            <View style={styles.customer}>
              <Text style={styles.name}>{wallet.customerName ?? 'dvote customer'}</Text>
              <Text style={styles.balance}>{wallet.balance.toLocaleString('en-US')} points</Text>
              <Text style={styles.muted}>Available at {me.vendor.name}</Text>
            </View>
            {wallet.rewards.length === 0 ? (
              <Text style={styles.muted}>This shop has no available rewards yet.</Text>
            ) : null}
            {wallet.rewards.map((reward) => (
              <View key={reward.rewardId} style={styles.card}>
                {reward.rewardImageUrl ? (
                  <Image source={{ uri: reward.rewardImageUrl }} style={styles.image} resizeMode="cover" />
                ) : null}
                <View style={styles.body}>
                  <Text style={styles.name}>{reward.rewardName}</Text>
                  {reward.rewardNameAr ? <Text style={styles.arabic}>{reward.rewardNameAr}</Text> : null}
                  {reward.rewardDescription ? (
                    <Text style={styles.muted}>{reward.rewardDescription}</Text>
                  ) : null}
                  <Text style={styles.cost}>{reward.pointsCost.toLocaleString('en-US')} points</Text>
                  <PrimaryButton
                    title="Redeem"
                    disabled={!reward.usable}
                    onPress={() =>
                      router.replace({ pathname: '/redeem', params: { rewardId: reward.rewardId } })
                    }
                  />
                  {!reward.usable ? (
                    <Text style={styles.muted}>
                      {reward.reason === 'insufficient_points'
                        ? `Needs ${Math.max(0, reward.pointsCost - wallet.balance).toLocaleString('en-US')} more points`
                        : friendlyMessage(reward.reason ?? 'reward_unavailable')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
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
  content: { gap: 16, paddingVertical: 20 },
  title: { fontSize: 22, fontWeight: '700', color: theme.text },
  customer: { padding: 20, gap: 6, borderRadius: 16, backgroundColor: theme.subtle },
  name: { fontSize: 18, fontWeight: '600', color: theme.text },
  balance: { fontSize: 28, fontWeight: '700', color: theme.text },
  muted: { fontSize: 14, lineHeight: 21, color: theme.muted },
  arabic: { fontSize: 16, color: theme.muted, writingDirection: 'rtl' },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.surface,
  },
  image: { width: '100%', height: 150, backgroundColor: theme.subtle },
  body: { padding: 16, gap: 12 },
  cost: { fontSize: 15, fontWeight: '600', color: theme.text },
  footer: { paddingVertical: 20 },
});
