import CancelCircleIcon from '@hugeicons/core-free-icons/CancelCircleIcon';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import Coins01Icon from '@hugeicons/core-free-icons/Coins01Icon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import MapsSearchIcon from '@hugeicons/core-free-icons/MapsSearchIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import Tag01Icon from '@hugeicons/core-free-icons/Tag01Icon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { DvoteLogo } from '../../components/DvoteLogo';
import { Icon, type AppIcon } from '../../components/Icon';
import { Text, TextInput } from '../../components/Text';
import { ErrorBox, Screen, SoonTag } from '../../components/ui';
import { useI18n } from '../../i18n';
import { api, ApiError, type VendorListItem } from '../../lib/api';
import { useSession } from '../../lib/session';
import { squircle, TAB_BAR_SPACE, theme, vendorColors } from '../../lib/theme';

/** "10.00" → "10" */
const amount = (v: string) => (v.endsWith('.00') ? v.slice(0, -3) : v);

/**
 * Explore (tab): every coffee shop on dvote, A–Z, each as a card: banner, logo, name, how
 * points are earned, where it is, and its category (soon), rewards and branches. Shops the
 * customer already has a card at are tagged "Your card" with their points. A card opens the
 * shop page. The search box filters by name (on the server).
 */
export default function Explore() {
  const { handleAuthError } = useSession();
  const { t } = useI18n();
  const [shops, setShops] = useState<VendorListItem[] | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0); // ignore answers to older searches
  const current = useRef(search); // the search text when the tab comes back into view
  current.current = search;

  const load = useCallback(
    async (term: string) => {
      const call = ++latest.current;
      try {
        setError(null);
        const list = await api.vendors(term);
        if (call === latest.current) setShops(list);
      } catch (err) {
        if (await handleAuthError(err)) return;
        if (call === latest.current) setError(err instanceof ApiError ? err.message : t('explore.couldNotLoad'));
      }
    },
    [handleAuthError, t],
  );

  // Search as you type, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => void load(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  // Fresh balances when coming back to the tab (points may have been added).
  useFocusEffect(
    useCallback(() => {
      void load(current.current);
    }, [load]),
  );

  return (
    <Screen>
      <FlatList
        data={shops ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(search);
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t('explore.title')}</Text>
            <Text style={styles.subtitle}>{t('explore.subtitle')}</Text>
            <View style={styles.search}>
              <Icon icon={Search01Icon} size={20} color={theme.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('explore.search')}
                placeholderTextColor={theme.placeholder}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel={t('explore.search')}
              />
              {search ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('explore.clearSearch')}
                  onPress={() => setSearch('')}
                  hitSlop={8}
                >
                  <Icon icon={CancelCircleIcon} size={20} color={theme.placeholder} />
                </Pressable>
              ) : null}
            </View>
            <ErrorBox message={error} />
          </View>
        }
        ListEmptyComponent={
          shops === null ? (
            error ? null : <ActivityIndicator color={theme.text} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon icon={MapsSearchIcon} size={34} color={theme.text} />
              </View>
              <Text style={styles.emptyTitle}>{search ? t('explore.noResultsTitle') : t('explore.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {search ? t('explore.noResults', { search: search.trim() }) : t('explore.emptyText')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <ShopCard shop={item} />}
      />
    </Screen>
  );
}

/**
 * One shop as a card. Vendors have no cover image or category in the API yet: the banner uses
 * the shop's colour with the dvote petals (like its loyalty card and shop page), and the
 * category shows "Soon".
 */
function ShopCard({ shop }: { shop: VendorListItem }) {
  const { t } = useI18n();
  const colors = vendorColors(shop.id);
  const mine = shop.myBalance !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        t('explore.shopA11y', { name: shop.name }),
        mine ? `${t('explore.yourCard')}, ${t('explore.myPoints', { count: shop.myBalance ?? 0 })}` : null,
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={() =>
        router.push({ pathname: '/shop/[id]', params: { id: shop.id, name: shop.name, logoUrl: shop.logoUrl ?? '' } })
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <View style={styles.pattern} pointerEvents="none">
          <DvoteLogo height={180} wordmark={false} color="rgba(255,255,255,0.10)" />
        </View>
        {mine ? (
          <View style={styles.mine}>
            <Icon icon={CheckmarkCircle02Icon} size={14} color={theme.success} />
            <Text style={styles.mineText}>
              {t('explore.yourCard')} · {t('explore.myPoints', { count: shop.myBalance ?? 0 })}
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.body}>
        {shop.logoUrl ? (
          <Image source={{ uri: shop.logoUrl }} style={styles.logo} contentFit="cover" />
        ) : (
          <View style={[styles.logo, { backgroundColor: colors[0] }]}>
            <Text style={styles.logoInitial}>{shop.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.name} numberOfLines={1}>
          {shop.name}
        </Text>

        <View style={styles.infoLine}>
          <Icon icon={Coins01Icon} size={15} color={theme.muted} />
          <Text style={styles.info} numberOfLines={1}>
            {shop.rule
              ? t('shop.rule', {
                  amount: amount(shop.rule.spendAmount),
                  currency: shop.currency,
                  points: t('common.points', { count: shop.rule.pointsPerSpend }),
                })
              : t('explore.noRule')}
          </Text>
        </View>
        {shop.firstAddress ? (
          <View style={styles.infoLine}>
            <Icon icon={Location01Icon} size={15} color={theme.muted} />
            <Text style={styles.info} numberOfLines={1}>
              {shop.firstAddress}
            </Text>
          </View>
        ) : null}

        <View style={styles.stats}>
          <Stat icon={Tag01Icon} label={t('explore.category')} soon />
          <Stat icon={GiftIcon} label={t('explore.rewards', { count: shop.rewardsCount })} />
          <Stat icon={Location01Icon} label={t('explore.branches', { count: shop.branchesCount })} />
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ icon, label, soon }: { icon: AppIcon; label: string; soon?: boolean }) {
  return (
    <View style={styles.stat}>
      <Icon icon={icon} size={14} color={theme.secondary} />
      <Text style={styles.statText}>{label}</Text>
      {soon ? <SoonTag /> : null}
    </View>
  );
}

const LOGO = 64;

const styles = StyleSheet.create({
  list: { paddingHorizontal: theme.gutter, paddingBottom: TAB_BAR_SPACE },
  header: { paddingTop: 12, paddingBottom: 16, gap: 6 },
  title: { fontSize: 34, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 15, color: theme.muted },
  search: {
    ...squircle,
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 16, color: theme.text },
  card: { ...squircle, backgroundColor: theme.surface, borderRadius: theme.radius, overflow: 'hidden' },
  pressed: { opacity: 0.7 },
  banner: { height: 110, overflow: 'hidden' },
  pattern: { position: 'absolute', right: -30, top: -20 },
  mine: {
    position: 'absolute',
    top: 12,
    end: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mineText: { fontSize: 12, fontWeight: '700', color: theme.text },
  // The logo overlaps the bottom of the banner.
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 6, marginTop: -LOGO / 2 },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    borderWidth: 3,
    borderColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.surface,
    marginBottom: 4,
  },
  logoInitial: { fontSize: 22, fontWeight: '700', color: '#fff' },
  name: { fontSize: 19, fontWeight: '700', color: theme.text },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  info: { flexShrink: 1, fontSize: 14, color: theme.secondary },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  stat: {
    ...squircle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.background,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statText: { fontSize: 12, fontWeight: '600', color: theme.secondary },
  empty: { alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
  emptyText: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21 },
});
