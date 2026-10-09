import GiftCard02Icon from '@hugeicons/core-free-icons/GiftCard02Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import { CardStack } from '../../components/CardStack';
import { Icon } from '../../components/Icon';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { NearYou } from '../../components/NearYou';
import { ErrorBox, PrimaryButton, Screen } from '../../components/ui';
import { api, ApiError, type Card } from '../../lib/api';
import { useI18n } from '../../i18n';
import { useSession } from '../../lib/session';
import { TAB_BAR_SPACE, theme } from '../../lib/theme';
import { useLiveRefresh } from '../../lib/live';

/**
 * My cards: one card per shop where the customer has points, as an Apple Wallet-style stack
 * (tap to fan out, tap a card for its details; the X at the bottom closes it), then
 * "For you" (offers, not in the API yet: empty state). While the stack is open only the
 * cards show: no "For you" and no tab bar.
 */
export default function Cards() {
  const { handleAuthError } = useSession();
  const { t } = useI18n();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Hide the tab bar while the stack is open; the X button takes its place.
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: expanded ? { display: 'none' } : undefined });
  }, [expanded, navigation]);

  // Leaving the tab (or the app opening a card) folds the stack back up.
  useFocusEffect(useCallback(() => () => setExpanded(false), []));
  const openCard = (card: Card) => router.push({ pathname: '/card/[id]', params: { id: card.id } });

  const load = useCallback(async () => {
    try {
      setError(null);
      setCards(await api.cards());
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('cards.couldNotLoad'));
    }
  }, [handleAuthError, t]);

  // Reload every time the tab is shown (points may have been added at the counter).
  useLiveRefresh(load);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
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
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('cards.title')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('notifications.title')}
              onPress={() => router.push('/notifications')}
              style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]}
              hitSlop={6}
            >
              <Icon icon={Notification01Icon} size={22} color={theme.text} />
            </Pressable>
          </View>
          {cards && cards.length > 0 ? <Text style={styles.count}>{t('cards.shops', { count: cards.length })}</Text> : null}
          <ErrorBox message={error} />
        </View>

        {cards === null ? (
          error ? null : <ActivityIndicator color={theme.text} style={{ marginTop: 40 }} />
        ) : cards.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon icon={GiftCard02Icon} size={36} color={theme.text} />
            </View>
            <Text style={styles.emptyTitle}>{t('cards.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('cards.emptyText')}</Text>
            <PrimaryButton title={t('common.showMyQr')} onPress={() => router.push('/qr')} />
          </View>
        ) : cards.length === 1 ? (
          <LoyaltyCard card={cards[0]} onPress={() => openCard(cards[0])} />
        ) : (
          <CardStack cards={cards} expanded={expanded} onExpand={() => setExpanded(true)} onOpenCard={openCard} />
        )}

        {/* Shops near the customer, nearest first (replaces the "Offers coming soon" placeholder). */}
        {cards !== null && !expanded ? <NearYou /> : null}
      </ScrollView>

      {expanded ? (
        <View style={[styles.closeWrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setExpanded(false)}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.8 }]}
          >
            <Icon icon={Cancel01Icon} size={26} color={theme.text} />
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: theme.gutter, paddingBottom: TAB_BAR_SPACE },
  header: { paddingTop: 12, paddingBottom: 20, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1, fontSize: 34, fontWeight: '700', color: theme.text },
  // Same size and look as the round back button in PageHeader.
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Same size and look as the tab bar's QR button it replaces.
  close: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
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
