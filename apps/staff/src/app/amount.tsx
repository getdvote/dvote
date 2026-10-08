import { randomUUID } from 'expo-crypto';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ErrorBox, Field, PrimaryButton, Screen, TextLink, VendorHeader } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { describeRule, estimatePoints, parseAmount } from '../lib/points';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Design 4: enter the bill amount; the vendor's rule is shown; "Grant points". */
export default function Amount() {
  const { me, branchId, handleAuthError, scannedCode: code, setScannedCode } = useSession();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per bill: retrying after a network error can never add points twice.
  const idempotencyKey = useRef(randomUUID()).current;

  if (!me || !code) return <Redirect href="/home" />;
  const rule = me.activeRule;
  const branch = me.branches.find((b) => b.id === branchId);

  const amountMinor = parseAmount(text);
  const estimate = amountMinor && rule ? estimatePoints(amountMinor, rule) : null;

  async function grant() {
    if (!amountMinor) {
      setError('Enter the bill amount, e.g. 95 or 95.50');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.collect({
        code: code!,
        amount: amountMinor / 100,
        // vendor admins have no branch of their own: send the one picked on Home
        branchId: me!.branch ? undefined : (branchId ?? undefined),
        idempotencyKey,
      });
      setScannedCode(null); // used: never reuse it
      router.replace({
        pathname: '/done',
        params: { points: String(result.pointsAdded), amount: result.purchaseAmount, currency: result.currency },
      });
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <VendorHeader vendorName={me.vendor.name} logoUrl={me.vendor.logoUrl} branchName={branch?.name} />

        <View style={styles.middle}>
          <Text style={styles.title}>Enter bill amount</Text>
          <Field
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            placeholder="0"
            suffix={me.vendor.currency}
            keyboardType="decimal-pad"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={grant}
            accessibilityLabel="Bill amount"
          />
          {estimate !== null ? (
            <Text style={styles.estimate}>
              {estimate > 0 ? `= ${estimate} point${estimate === 1 ? '' : 's'}` : 'Too small to earn a point'}
            </Text>
          ) : null}
          <ErrorBox message={error} />
        </View>

        <View style={styles.footer}>
          {rule ? <Text style={styles.rule}>{describeRule(rule, me.vendor.currency)}</Text> : null}
          <PrimaryButton title="Grant points" onPress={grant} loading={busy} disabled={!amountMinor} />
          <TextLink title="Cancel" onPress={() => router.replace('/home')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  middle: { flex: 1, justifyContent: 'center', gap: 14 },
  title: { fontSize: 17, fontWeight: '600', color: theme.text, textAlign: 'center' },
  estimate: { fontSize: 15, color: theme.muted, textAlign: 'center' },
  footer: { paddingBottom: 24, gap: 16 },
  rule: { fontSize: 15, color: theme.muted, textAlign: 'center' },
});
