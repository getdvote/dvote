import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, PrimaryButton, Screen, TextLink, VendorHeader, showHelp } from '../components/ui';
import { describeRule } from '../lib/points';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/** Branded staff welcome with a quiet logo backdrop and a clear scanning action. */
export default function Home() {
  const { me, branchId, chooseBranch, signOut } = useSession();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'redeem' ? 'redeem' : 'collect';
  if (!me) return <Redirect href="/login" />;

  const branch = me.branches.find((b) => b.id === branchId) ?? null;
  const mustPickBranch = !me.branch && me.branches.length > 1;

  return (
    <Screen backgroundLogoUrl={me.vendor.logoUrl}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>STAFF WORKSPACE</Text>
        <VendorHeader
          vendorName={me.vendor.name}
          logoUrl={me.vendor.logoUrl}
          branchName={branch?.name ?? null}
          prominent
        />
        <View style={styles.tabs}>
          {(['collect', 'redeem'] as const).map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === tab }}
              onPress={() => router.setParams({ mode: tab })}
              style={[styles.tab, mode === tab && styles.activeTab]}
            >
              <Text style={[styles.tabText, mode === tab && styles.activeTabText]}>
                {tab === 'collect' ? 'Collect' : 'Redeem'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.middle}>
          <View style={styles.scanCard}>
            <View style={styles.scanIcon} accessible={false}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <View style={styles.scanLine} />
            </View>
            <Text style={styles.title}>{mode === 'collect' ? 'Collect points' : 'Redeem a reward'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'collect'
                ? 'Scan a loyalty card, then enter the bill amount.'
                : 'Scan a loyalty card to see the customer’s points and choose a reward.'}
            </Text>
            {mustPickBranch ? (
              <View style={styles.picker}>
                <Text style={styles.pickerTitle}>Choose your branch</Text>
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
                      <Text style={[styles.choice, b.id === branchId && styles.chipTextOn]}>
                        {b.id === branchId ? '●' : '○'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <PrimaryButton
              title="Start scanning"
              onPress={() => router.push({ pathname: '/scan', params: { mode } })}
              disabled={!branchId || (mode === 'collect' && !me.activeRule)}
            />
            {mode === 'collect' && !me.activeRule ? (
              <Text style={styles.note}>Your shop has no point rule yet. Ask your manager to set one.</Text>
            ) : me.branches.length === 0 ? (
              <Text style={styles.note}>Your shop has no active branch yet.</Text>
            ) : (
              <Text style={styles.note}>
                {mode === 'collect' && me.activeRule
                  ? describeRule(me.activeRule, me.vendor.currency)
                  : 'Points are deducted only after you confirm the reward.'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <TextLink title="Need help?" onPress={showHelp} />
          <Pressable accessibilityRole="button" onPress={signOut} hitSlop={12}>
            <Text style={styles.signOut}>Log out ({me.email})</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: theme.subtle, borderRadius: 12, padding: 4, marginTop: 24 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: theme.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: theme.muted },
  activeTabText: { color: theme.onPrimary },
  scroll: { flex: 1, width: '100%', minWidth: 0 },
  content: { flexGrow: 1, width: '100%', paddingTop: 24, paddingBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: theme.muted },
  middle: { flex: 1, justifyContent: 'center', paddingVertical: 28, minWidth: 0 },
  scanCard: {
    gap: 16,
    padding: 20,
    width: '100%',
    minWidth: 0,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  scanIcon: {
    width: 56,
    height: 56,
    alignSelf: 'center',
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 17, height: 17, borderColor: theme.text },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 7 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 7 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 7 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 7 },
  scanLine: { width: 32, height: 2, backgroundColor: theme.border },
  title: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: theme.text,
  },
  subtitle: {
    textAlign: 'center',
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: -8,
    marginBottom: 6,
  },
  note: { textAlign: 'center', color: theme.muted, fontSize: 14, lineHeight: 21 },
  picker: { gap: 12, marginBottom: 12 },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: theme.text, textAlign: 'center' },
  chips: { gap: 8, width: '100%' },
  chip: {
    paddingHorizontal: 16,
    minHeight: 48,
    paddingVertical: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    justifyContent: 'space-between',
  },
  chipOn: { backgroundColor: theme.primary },
  chipText: { fontSize: 14, color: theme.text, flex: 1, flexShrink: 1 },
  choice: { fontSize: 18, color: theme.muted },
  chipTextOn: { color: theme.onPrimary },
  footer: { paddingBottom: 24, gap: 16, alignItems: 'center' },
  signOut: { fontSize: 13, color: theme.muted },
});
