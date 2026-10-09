import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import GiftCard02Icon from '@hugeicons/core-free-icons/GiftCard02Icon';
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';
import { ErrorBox, Group, PageHeader, PrimaryButton, Row, Screen } from '../components/ui';
import { api, ApiError, type Card } from '../lib/api';
import { t as translate, useI18n } from '../i18n';
import { useSession } from '../lib/session';
import { theme, vendorColors, squircle } from '../lib/theme';
import { useLiveRefresh } from '../lib/live';
import { showDate } from '../lib/dates';

/**
 * My cards list (My profile → My cards): every card as a row (logo, shop, when it was added,
 * balance), for a quick overview. Tapping a row opens a small sheet: the card's details
 * (history) or the shop's page.
 * The My cards tab shows the same cards as full-size cards. Rows open the card's history.
 */
export default function MyCards() {
  const { handleAuthError } = useSession();
  const { t } = useI18n();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Card | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Where to go once the sheet has slid away (navigating under an open sheet would leave it on top).
  const next = useRef<(() => void) | null>(null);

  const pick = (card: Card) => {
    setPicked(card);
    setSheetOpen(true);
  };
  const go = (to: () => void) => {
    next.current = to;
    setSheetOpen(false);
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      setCards(await api.cards());
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('cards.couldNotLoad'));
    }
  }, [handleAuthError, t]);

  // Reload when the page is shown again (e.g. back from a card after points were added).
  useLiveRefresh(load);

  return (
    <Screen>
      <PageHeader title={t('cards.title')} />
      <FlatList
        data={cards ?? []}
        keyExtractor={(c) => c.id}
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
        ListHeaderComponent={
          <View style={styles.header}>
            <ErrorBox message={error} />
            {cards && cards.length > 0 ? (
              <Text style={styles.count}>{t('cards.shops', { count: cards.length })}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          cards === null ? (
            error ? null : <ActivityIndicator color={theme.text} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon icon={GiftCard02Icon} size={36} color={theme.text} />
              </View>
              <Text style={styles.emptyTitle}>{t('cards.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('cards.emptyListText')}</Text>
              <PrimaryButton title={t('common.showMyQr')} onPress={() => router.push('/qr')} />
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <CardRow
            card={item}
            first={index === 0}
            last={index === (cards?.length ?? 0) - 1}
            onPress={() => pick(item)}
          />
        )}
      />

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onClosed={() => {
          next.current?.();
          next.current = null;
          setPicked(null);
        }}
      >
        {picked ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ShopLogo card={picked} size={56} />
              <View style={styles.rowText}>
                <Text style={styles.sheetName} numberOfLines={1}>
                  {picked.vendor.name}
                </Text>
                <Text style={styles.added}>{t('common.points', { count: picked.balance })}</Text>
              </View>
            </View>
            <Group>
              <Row
                icon={GiftCard02Icon}
                label={t('cards.cardDetails')}
                onPress={() => go(() => router.push({ pathname: '/card/[id]', params: { id: picked.id } }))}
              />
              <Row
                icon={Store01Icon}
                label={t('cards.shopDetails')}
                onPress={() =>
                  go(() =>
                    router.push({
                      pathname: '/shop/[id]',
                      params: { id: picked.vendor.id, name: picked.vendor.name, logoUrl: picked.vendor.logoUrl ?? undefined },
                    }),
                  )
                }
              />
            </Group>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

/** One card as a list row: logo, shop name and added date, balance, chevron. Rows join into one white group. */
function CardRow({ card, first, last, onPress }: { card: Card; first: boolean; last: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${translate('cards.cardA11y', { name: card.vendor.name, balance: translate('common.points', { count: card.balance }) })}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, first && styles.rowFirst, last && styles.rowLast, pressed && styles.pressed]}
    >
      <ShopLogo card={card} size={48} />
      <View style={styles.rowText}>
        <Text style={styles.vendor} numberOfLines={1}>
          {card.vendor.name}
        </Text>
        <Text style={styles.added} numberOfLines={1}>
          {translate('cards.addedOn', { date: showDate(new Date(card.createdAt)) })}
        </Text>
      </View>
      <Text style={styles.balance}>
        {card.balance.toLocaleString()}
        <Text style={styles.pts}> {translate('common.ptsUnit', { count: card.balance })}</Text>
      </Text>
      <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} mirror />
      {!last ? <View style={styles.separator} /> : null}
    </Pressable>
  );
}

/** The shop's logo filling a circle (like on its shop page); without one, its initial on the card colour. */
function ShopLogo({ card, size }: { card: Card; size: number }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (card.vendor.logoUrl) {
    return <Image source={{ uri: card.vendor.logoUrl }} style={[styles.logo, box]} contentFit="cover" />;
  }
  const [color] = vendorColors(card.vendor.id, card.vendor.cardDesign);
  return (
    <View style={[styles.logo, box, { backgroundColor: color }]}>
      <Text style={[styles.logoInitial, { fontSize: size * 0.38 }]}>{card.vendor.name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: theme.gutter, paddingBottom: 40 },
  header: { gap: 12, paddingBottom: 10 },
  count: { fontSize: 15, color: theme.muted, marginLeft: 2 },
  row: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.surface,
  },
  rowFirst: { ...squircle, borderTopLeftRadius: theme.radius, borderTopRightRadius: theme.radius },
  rowLast: { ...squircle, borderBottomLeftRadius: theme.radius, borderBottomRightRadius: theme.radius },
  pressed: { opacity: 0.6 },
  separator: {
    position: 'absolute',
    left: 78, // lines up with the shop name
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.separator,
  },
  // Same look as the logo on the shop page: the photo fills the circle, with a 4 pt ring in
  // the page colour.
  logo: {
    borderWidth: 4,
    borderColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.surface,
  },
  logoInitial: { fontWeight: '700', color: '#fff' },
  sheet: { paddingHorizontal: theme.gutter, gap: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  sheetName: { fontSize: 20, fontWeight: '700', color: theme.text },
  rowText: { flex: 1, gap: 4 },
  added: { fontSize: 13, color: theme.muted },
  vendor: { fontSize: 17, fontWeight: '600', color: theme.text },
  balance: { fontSize: 17, fontWeight: '700', color: theme.text },
  pts: { fontSize: 13, fontWeight: '500', color: theme.muted },
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
