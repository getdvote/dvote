import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import CancelCircleIcon from '@hugeicons/core-free-icons/CancelCircleIcon';
import Coins01Icon from '@hugeicons/core-free-icons/Coins01Icon';
import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import MapsSearchIcon from '@hugeicons/core-free-icons/MapsSearchIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Text, TextInput } from '../../components/Text';
import { ErrorBox, Screen } from '../../components/ui';
import { useI18n } from '../../i18n';
import { api, ApiError, type VendorListItem } from '../../lib/api';
import { useSession } from '../../lib/session';
import { squircle, TAB_BAR_SPACE, theme, vendorColors } from '../../lib/theme';
import { useLiveRefresh } from '../../lib/live';

/** "10.00" → "10" */
const amount = (v: string) => (v.endsWith('.00') ? v.slice(0, -3) : v);

/**
 * Explore (tab): every coffee shop on dvote, A–Z, with how points are earned there, how many
 * rewards and branches it has, and the customer's points if they already have its card.
 * A row opens the shop page. The search box filters by name (on the server).
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
  useLiveRefresh(useCallback(() => load(current.current), [load]));

  return (
    <Screen>
      <FlatList
        data={shops ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
        renderItem={({ item }) => <ShopRow shop={item} />}
      />
    </Screen>
  );
}

function ShopRow({ shop }: { shop: VendorListItem }) {
  const { t } = useI18n();
  const [color] = vendorColors(shop.id);
  const meta = [t('explore.rewards', { count: shop.rewardsCount }), t('explore.branches', { count: shop.branchesCount })].join(
    ' · ',
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('explore.shopA11y', { name: shop.name })}
      onPress={() =>
        router.push({ pathname: '/shop/[id]', params: { id: shop.id, name: shop.name, logoUrl: shop.logoUrl ?? '' } })
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {shop.logoUrl ? (
        <Image source={{ uri: shop.logoUrl }} style={styles.logo} contentFit="cover" />
      ) : (
        <View style={[styles.logo, { backgroundColor: color }]}>
          <Text style={styles.logoInitial}>{shop.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.rowText}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {shop.name}
          </Text>
          {shop.myBalance !== null ? (
            <View style={styles.balance}>
              <Text style={styles.balanceText}>{t('explore.myPoints', { count: shop.myBalance })}</Text>
            </View>
          ) : null}
        </View>

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
        <Text style={styles.meta}>{meta}</Text>
      </View>

      <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} mirror />
    </Pressable>
  );
}

const LOGO = 56;

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
  row: {
    ...squircle,
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pressed: { opacity: 0.7 },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.fill,
  },
  logoInitial: { fontSize: 22, fontWeight: '700', color: '#fff' },
  rowText: { flex: 1, gap: 4 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: theme.text },
  balance: { backgroundColor: '#E6F7EC', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  balanceText: { fontSize: 12, fontWeight: '700', color: theme.success },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  info: { flexShrink: 1, fontSize: 14, color: theme.secondary },
  meta: { fontSize: 13, color: theme.muted, marginTop: 2 },
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
