import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import ArrowDataTransferVerticalIcon from '@hugeicons/core-free-icons/ArrowDataTransferVerticalIcon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import Clock01Icon from '@hugeicons/core-free-icons/Clock01Icon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { Text } from '../../components/Text';
import { EmptySection, ErrorBox, PageHeader, Screen, SectionTitle } from '../../components/ui';
import { api, ApiError, type Card, type CardEvent } from '../../lib/api';
import { useSession } from '../../lib/session';
import { theme, vendorColors } from '../../lib/theme';

/**
 * Card details: the card, the shop that issued it (opens the shop page), its rewards and
 * history. The title is fixed ("Card details") so it doesn't change while data loads.
 */
export default function CardDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { handleAuthError } = useSession();
  const [card, setCard] = useState<Card | null>(null);
  const [events, setEvents] = useState<CardEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [cards, history] = await Promise.all([api.cards(), api.cardEvents(id)]);
      setCard(cards.find((c) => c.id === id) ?? null);
      setEvents(history);
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Could not load this card.');
    }
  }, [id, handleAuthError]);

  // Reload when shown again (points may have been added at the counter).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loading = !card && !error;

  return (
    <Screen>
      <PageHeader title="Card details" />
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

            <SectionTitle title="Issued by" />
            <IssuedBy card={card} />

            <SectionTitle title="Rewards" />
            <Rewards card={card} />

            <SectionTitle title="History" />
            {events === null ? (
              <ActivityIndicator color={theme.text} />
            ) : events.length === 0 ? (
              <EmptySection
                icon={Clock01Icon}
                title="No activity yet"
                text="Points you earn and rewards you redeem at this shop will show here."
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
      accessibilityLabel={`Issued by ${vendor.name}. Open shop`}
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
        <Text style={styles.shopHint}>View shop</Text>
      </View>
      <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} />
    </Pressable>
  );
}

/**
 * Rewards. The API only sends the next reward and how many are ready (not the shop's full
 * list; that needs GET /api/app/vendors/{id}), so the full list is an empty state for now.
 */
function Rewards({ card }: { card: Card }) {
  const next = card.nextReward;
  const ready = card.affordableRewards;
  if (!next && ready === 0) {
    return (
      <EmptySection
        icon={GiftIcon}
        title="Rewards coming soon"
        text="The rewards you can get at this shop, and their points, will show here."
      />
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {ready > 0 ? (
        <View style={[styles.box, styles.readyBox]}>
          <View style={[styles.rewardIcon, { backgroundColor: '#E6F7EC' }]}>
            <Icon icon={GiftIcon} size={20} color={theme.success} />
          </View>
          <Text style={styles.readyText}>
            {ready} reward{ready === 1 ? '' : 's'} ready to redeem
          </Text>
        </View>
      ) : null}
      {next ? (
        <View style={[styles.box, styles.nextBox]}>
          <View style={styles.nextTop}>
            <View style={styles.rewardIcon}>
              <Icon icon={GiftIcon} size={20} color={theme.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardName}>{next.name}</Text>
              <Text style={styles.rewardDetail}>
                {next.pointsCost.toLocaleString()} pts · {next.pointsNeeded.toLocaleString()} to go
              </Text>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (card.balance / next.pointsCost) * 100)}%` }]} />
          </View>
        </View>
      ) : null}
      <EmptySection
        icon={GiftIcon}
        title="All rewards coming soon"
        text="Soon you'll see every reward at this shop here, not just the next one."
      />
    </View>
  );
}

function EventRow({ event, currency, first, last }: { event: CardEvent; currency: string; first: boolean; last: boolean }) {
  const positive = event.delta > 0;
  const title =
    event.type === 'earn' ? 'Points earned' : event.type === 'redeem' ? (event.rewardName ?? 'Reward redeemed') : 'Correction by dvote';
  const detail = [
    event.purchaseAmount ? `Bill ${event.purchaseAmount.replace(/\.00$/, '')} ${currency}` : null,
    event.branchName,
    new Date(event.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
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
  box: { backgroundColor: theme.surface, borderRadius: theme.radius },
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
  track: { height: 6, borderRadius: 3, backgroundColor: theme.fill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.brand },
  row: {
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowFirst: { borderTopLeftRadius: theme.radius, borderTopRightRadius: theme.radius },
  rowLast: { borderBottomLeftRadius: theme.radius, borderBottomRightRadius: theme.radius },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '500', color: theme.text },
  rowDetail: { fontSize: 13, color: theme.muted, marginTop: 2 },
  delta: { fontSize: 17, fontWeight: '700' },
});
