import CreditCardIcon from '@hugeicons/core-free-icons/CreditCardIcon';
import { Icon } from '../../components/Icon';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { ErrorBox, PrimaryButton, Screen } from '../../components/ui';
import { api, ApiError, type Card } from '../../lib/api';
import { useSession } from '../../lib/session';
import { TAB_BAR_SPACE, theme } from '../../lib/theme';

/** All cards: one card per shop where the customer has points. */
export default function Cards() {
  const { handleAuthError } = useSession();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCards(await api.cards());
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : 'Could not load your cards.');
    }
  }, [handleAuthError]);

  // Reload every time the tab is shown (points may have been added at the counter).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <FlatList
        data={cards ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
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
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Cards</Text>
            {cards && cards.length > 0 ? (
              <Text style={styles.count}>
                {cards.length} shop{cards.length === 1 ? '' : 's'}
              </Text>
            ) : null}
            <ErrorBox message={error} />
          </View>
        }
        ListEmptyComponent={
          cards === null ? (
            error ? null : <ActivityIndicator color={theme.text} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon icon={CreditCardIcon} size={36} color={theme.text} />
              </View>
              <Text style={styles.emptyTitle}>No cards yet</Text>
              <Text style={styles.emptyText}>
                Buy something at a dvote coffee shop and show your QR code at the counter. Your card for that shop
                appears here with your first points.
              </Text>
              <PrimaryButton title="Show my QR code" onPress={() => router.push('/qr')} />
            </View>
          )
        }
        renderItem={({ item }) => (
          <LoyaltyCard card={item} onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.id } })} />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: theme.gutter, paddingBottom: TAB_BAR_SPACE },
  header: { paddingTop: 12, paddingBottom: 20, gap: 4 },
  title: { fontSize: 34, fontWeight: '700', color: theme.text },
  count: { fontSize: 15, color: theme.muted, marginBottom: 6 },
  empty: { alignItems: 'center', gap: 12, marginTop: 40, paddingHorizontal: 8 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: theme.text },
  emptyText: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
});
