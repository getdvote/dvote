import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen, TextLink, VendorHeader, showHelp } from '../components/ui';
import { describeRule } from '../lib/points';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Design 2: vendor name + logo + branch, and "Start scanning". */
export default function Home() {
  const { me, branchId, chooseBranch, signOut } = useSession();
  if (!me) return <Redirect href="/login" />;

  const branch = me.branches.find((b) => b.id === branchId) ?? null;
  const mustPickBranch = !me.branch && me.branches.length > 1;

  return (
    <Screen>
      <VendorHeader
        vendorName={me.vendor.name}
        logoUrl={me.vendor.logoUrl}
        branchName={branch?.name ?? null}
      />

      <View style={styles.middle}>
        {mustPickBranch ? (
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Which branch are you working at?</Text>
            <View style={styles.chips}>
              {me.branches.map((b) => (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: b.id === branchId }}
                  onPress={() => chooseBranch(b.id)}
                  style={[styles.chip, b.id === branchId && styles.chipOn]}
                >
                  <Text style={[styles.chipText, b.id === branchId && styles.chipTextOn]}>{b.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <PrimaryButton
          title="Start scanning"
          onPress={() => router.push('/scan')}
          disabled={!branchId || !me.activeRule}
        />
        {!me.activeRule ? (
          <Text style={styles.note}>Your shop has no point rule yet. Ask your manager to set one.</Text>
        ) : me.branches.length === 0 ? (
          <Text style={styles.note}>Your shop has no active branch yet.</Text>
        ) : (
          <Text style={styles.note}>{describeRule(me.activeRule, me.vendor.currency)}</Text>
        )}
      </View>

      <View style={styles.footer}>
        <TextLink title="Need help?" onPress={showHelp} />
        <Pressable accessibilityRole="button" onPress={signOut} hitSlop={12}>
          <Text style={styles.signOut}>Log out ({me.email})</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1, justifyContent: 'center', gap: 16 },
  note: { textAlign: 'center', color: theme.muted, fontSize: 15 },
  picker: { gap: 12, marginBottom: 12 },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: theme.text, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: theme.primary },
  chipText: { fontSize: 15, color: theme.text },
  chipTextOn: { color: theme.onPrimary },
  footer: { paddingBottom: 24, gap: 16, alignItems: 'center' },
  signOut: { fontSize: 13, color: theme.muted },
});
