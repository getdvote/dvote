import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { ErrorBox, PageHeader, Screen } from '../../components/ui';
import { api, ApiError, type Card, type CardEvent } from '../../lib/api';
import { useSession } from '../../lib/session';
import { theme } from '../../lib/theme';

/** One card + its history (earned, redeemed, corrections). */
export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { handleAuthError } = useSession();
  const [card, setCard] = useState<Card | null>(null);
  const [events, setEvents] = useState<CardEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cards, history] = await Promise.all([api.cards(), api.cardEvents(id)]);
      setCard(cards.find((c) => c.id === id) ?? null);
      setEvents(history);
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Could not load this card.');
    }
  }, [id, handleAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <PageHeader title={card?.vendor.name ?? 'Card'} />
      <FlatList
        data={events ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 20, marginBottom: 12 }}>
            {card ? <LoyaltyCard card={card} /> : null}
            <ErrorBox message={error} />
            {events ? <Text style={styles.section}>History</Text> : null}
          </View>
        }
        ListEmptyComponent={
          events === null && !error ? <ActivityIndicator color={theme.text} /> : <Text style={styles.empty}>No activity yet.</Text>
        }
        renderItem={({ item, index }) => (
          <EventRow event={item} currency={card?.vendor.currency ?? ''} first={index === 0} last={index === (events?.length ?? 0) - 1} />
        )}
      />
    </Screen>
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
        <Ionicons
          name={event.type === 'earn' ? 'add' : event.type === 'redeem' ? 'gift-outline' : 'swap-vertical'}
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
  section: { fontSize: 15, fontWeight: '600', color: theme.muted },
  empty: { textAlign: 'center', color: theme.muted, marginTop: 12 },
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
