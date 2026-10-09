import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import ArrowDataTransferVerticalIcon from '@hugeicons/core-free-icons/ArrowDataTransferVerticalIcon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import Clock01Icon from '@hugeicons/core-free-icons/Clock01Icon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { CAROUSEL_LIMIT, RewardCards } from '../../components/RewardCards';
import { Text } from '../../components/Text';
import { EmptySection, ErrorBox, PageHeader, PillButton, Screen, SectionTitle } from '../../components/ui';
import { api, ApiError, type Card, type CardEvent, type VendorPage } from '../../lib/api';
import { localized, t as translate, useI18n } from '../../i18n';
import { showDate } from '../../lib/dates';
import { useSession } from '../../lib/session';
import { theme, vendorColors, squircle } from '../../lib/theme';

/**
 * Card details: the card, the shop that issued it (opens the shop page), the shop's first
 * rewards as a horizontal carousel with "View all" (from GET /api/app/vendors/{id}) and the history. The title is fixed ("Card details") so it doesn't change while data loads.
 *
 * History shows HISTORY_PAGE events; "More" loads the next HISTORY_PAGE older ones.
 */
const HISTORY_PAGE = 5;
/** The API's max `limit`. */
const HISTORY_MAX = 100;

export default function CardDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { handleAuthError } = useSession();
  const { t } = useI18n();
  const [card, setCard] = useState<Card | null>(null);
  const [events, setEvents] = useState<CardEvent[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  // how many events are shown, so a reload on focus keeps the pages already opened
  const shown = useRef(HISTORY_PAGE);
  const [rewards, setRewards] = useState<VendorPage['rewards'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      // ask for one extra event: if it comes back there is more to load
      const count = Math.min(shown.current, HISTORY_MAX - 1);
      const [cards, history] = await Promise.all([api.cards(), api.cardEvents(id, count + 1)]);
      const found = cards.find((c) => c.id === id) ?? null;
      setCard(found);
      setEvents(history.slice(0, count));
      setHasMore(history.length > count);
      setMoreError(null);
      // every reward of the shop (the card itself only knows the next one)
      if (found) setRewards((await api.vendor(found.vendor.id)).rewards);
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('card.couldNotLoad'));
    }
  }, [id, handleAuthError, t]);

  const loadMore = async () => {
    if (!events?.length || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api.cardEvents(id, HISTORY_PAGE + 1, events[events.length - 1].id);
      const next = [...events, ...page.slice(0, HISTORY_PAGE)];
      shown.current = next.length;
      setEvents(next);
      setHasMore(page.length > HISTORY_PAGE);
    } catch (err) {
      if (!(await handleAuthError(err))) {
        setMoreError(err instanceof ApiError ? err.message : t('card.couldNotLoadMore'));
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // Reload when shown again (points may have been added at the counter).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loading = !card && !error;

  return (
    <Screen>
      <PageHeader title={t('card.title')} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <ErrorBox message={error} />
        {loading ? <ActivityIndicator color={theme.text} style={{ marginTop: 40 }} /> : null}

        {card ? (
          <>
            <LoyaltyCard card={card} />

            <SectionTitle title={t('card.issuedBy')} />
            <IssuedBy card={card} />

            <SectionTitle title={t('card.rewards')} />
            <Rewards card={card} rewards={rewards} />

            <SectionTitle title={t('card.history')} />
            {events === null ? (
              <ActivityIndicator color={theme.text} />
            ) : events.length === 0 ? (
              <EmptySection
                icon={Clock01Icon}
                title={t('card.noActivity')}
                text={t('card.noActivityText')}
              />
            ) : (
              <View>
                {events.map((e, i) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    currency={card.vendor.currency}
                    first={i === 0}
                    last={i === events.length - 1}
                  />
                ))}
                {hasMore ? (
                  <View style={styles.more}>
                    <ErrorBox message={moreError} />
                    <PillButton title={t('card.more')} loading={loadingMore} onPress={() => void loadMore()} />
                  </View>
                ) : null}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** The shop that issued the card; opens the shop page. */
function IssuedBy({ card }: { card: Card }) {
  const { vendor } = card;
  const [color] = vendorColors(vendor.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translate('card.issuedByA11y', { name: vendor.name })}
      onPress={() =>
        router.push({
          pathname: '/shop/[id]',
          params: { id: vendor.id, name: vendor.name, logoUrl: vendor.logoUrl ?? '' },
        })
      }
      style={({ pressed }) => [styles.box, styles.issuedBy, pressed && styles.pressed]}
    >
      {vendor.logoUrl ? (
        <Image source={{ uri: vendor.logoUrl }} style={styles.logo} contentFit="contain" />
      ) : (
        <View style={[styles.logo, { backgroundColor: color }]}>
          <Text style={styles.logoInitial}>{vendor.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.shopName} numberOfLines={1}>
          {vendor.name}
        </Text>
        <Text style={styles.shopHint}>{translate('card.viewShop')}</Text>
      </View>
      <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} mirror />
    </Pressable>
  );
}

/** What's ready, progress to the next reward, then every reward of the shop. */
function Rewards({ card, rewards }: { card: Card; rewards: VendorPage['rewards'] | null }) {
  const next = card.nextReward;
  const ready = card.affordableRewards;
  return (
    <View style={{ gap: 12 }}>
      {ready > 0 ? (
        <View style={[styles.box, styles.readyBox]}>
          <View style={[styles.rewardIcon, { backgroundColor: '#E6F7EC' }]}>
            <Icon icon={GiftIcon} size={20} color={theme.success} />
          </View>
          <Text style={styles.readyText}>{translate('cards.ready', { count: ready })}</Text>
        </View>
      ) : null}
      {next ? (
        <View style={[styles.box, styles.nextBox]}>
          <View style={styles.nextTop}>
            <View style={styles.rewardIcon}>
              <Icon icon={GiftIcon} size={20} color={theme.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardName}>{localized(next.name, next.nameAr)}</Text>
              <Text style={styles.rewardDetail}>
                {translate('common.pts', { count: next.pointsCost })} · {translate('rewards.toGo', { count: next.pointsNeeded })}
              </Text>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (card.balance / next.pointsCost) * 100)}%` }]} />
          </View>
        </View>
      ) : null}
      {rewards === null ? (
        <ActivityIndicator color={theme.text} />
      ) : (
        <>
          {rewards.length > 0 ? (
            <View style={styles.allHeader}>
              <Text style={styles.allTitle}>{translate('card.allRewards')}</Text>
              {rewards.length > CAROUSEL_LIMIT ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push({ pathname: '/rewards/[vendorId]', params: { vendorId: card.vendor.id } })}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.viewAll}>{translate('rewards.viewAll')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <RewardCards rewards={rewards} balance={card.balance} layout="row" />
        </>
      )}
    </View>
  );
}

function EventRow({ event, currency, first, last }: { event: CardEvent; currency: string; first: boolean; last: boolean }) {
  const positive = event.delta > 0;
  const title =
    event.type === 'earn'
      ? translate('card.earned')
      : event.type === 'redeem'
        ? (localized(event.rewardName, event.rewardNameAr) ?? translate('card.redeemed'))
        : translate('card.correction');
  const detail = [
    event.purchaseAmount ? translate('card.bill', { amount: event.purchaseAmount.replace(/\.00$/, ''), currency }) : null,
    event.branchName,
    showDate(new Date(event.createdAt)),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.row, first && styles.rowFirst, last && styles.rowLast, !last && styles.rowBorder]}>
      <View style={[styles.icon, { backgroundColor: positive ? '#E6F7EC' : '#FFF1E6' }]}>
        <Icon
          icon={event.type === 'earn' ? Add01Icon : event.type === 'redeem' ? GiftIcon : ArrowDataTransferVerticalIcon}
          size={18}
          color={positive ? theme.success : '#E8820C'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text style={[styles.delta, { color: positive ? theme.success : theme.text }]}>
        {positive ? '+' : ''}
        {event.delta}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingBottom: 40 },
  box: { ...squircle, backgroundColor: theme.surface, borderRadius: theme.radius },
  pressed: { opacity: 0.6 },
  issuedBy: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 72 },
  logo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  shopName: { fontSize: 17, fontWeight: '600', color: theme.text },
  shopHint: { fontSize: 14, color: theme.muted, marginTop: 2 },
  readyBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  readyText: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.text },
  nextBox: { padding: 16, gap: 14 },
  nextTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFEEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardName: { fontSize: 17, fontWeight: '600', color: theme.text },
  rewardDetail: { fontSize: 14, color: theme.muted, marginTop: 2 },
  allHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  allTitle: { fontSize: 15, fontWeight: '600', color: theme.muted, marginStart: 2 },
  viewAll: { fontSize: 15, fontWeight: '600', color: theme.link },
  track: { ...squircle, height: 6, borderRadius: 3, backgroundColor: theme.fill, overflow: 'hidden' },
  fill: { ...squircle, height: '100%', borderRadius: 3, backgroundColor: theme.brand },
  row: {
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowFirst: { ...squircle, borderTopLeftRadius: theme.radius, borderTopRightRadius: theme.radius },
  rowLast: { ...squircle, borderBottomLeftRadius: theme.radius, borderBottomRightRadius: theme.radius },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '500', color: theme.text },
  rowDetail: { fontSize: 13, color: theme.muted, marginTop: 2 },
  delta: { fontSize: 17, fontWeight: '700' },
  more: { gap: 12, marginTop: 16 },
});
