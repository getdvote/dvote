import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { RewardCards } from '../../components/RewardCards';
import { ErrorBox, PageHeader, Screen } from '../../components/ui';
import { api, ApiError, type VendorPage } from '../../lib/api';
import { useI18n } from '../../i18n';
import { useSession } from '../../lib/session';
import { theme } from '../../lib/theme';

/** Rewards shown per page; the next page loads when the list is scrolled near its end. */
const PAGE_SIZE = 10;

/**
 * Every active reward of a shop as full-width cards, one after another (opened from "View all"
 * on Card details or the shop page). GET /api/app/vendors/{id} returns the whole catalogue, so pages are
 * revealed on the phone as the customer scrolls.
 */
export default function AllRewards() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const { handleAuthError } = useSession();
  const { t } = useI18n();
  const [shop, setShop] = useState<VendorPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [viewport, setViewport] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      setShop(await api.vendor(vendorId));
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('shop.couldNotLoad'));
    }
  }, [vendorId, handleAuthError, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = shop ? shop.rewards.slice(0, pages * PAGE_SIZE) : [];
  const hasMore = shop ? visible.length < shop.rewards.length : false;

  return (
    <Screen>
      <PageHeader title={t('card.allRewards')} />
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEventThrottle={200}
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        // a page shorter than the screen can't be scrolled, so load the next one straight away
        onContentSizeChange={(_, height) => {
          if (hasMore && viewport > 0 && height < viewport) setPages((p) => p + 1);
        }}
        onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
          if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
            setPages((p) => p + 1);
          }
        }}
      >
        <ErrorBox message={error} />
        {!shop && !error ? <ActivityIndicator color={theme.text} style={{ marginTop: 40 }} /> : null}
        {shop ? <RewardCards rewards={visible} balance={shop.card?.balance ?? 0} layout="column" /> : null}
        {hasMore ? <ActivityIndicator color={theme.text} style={{ marginTop: 16 }} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingTop: 8, paddingBottom: 40 },
});
