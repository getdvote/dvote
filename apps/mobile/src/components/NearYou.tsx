import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { api, type NearbyVendors } from '../lib/api';
import { useLiveRefresh } from '../lib/live';
import { refreshMyLocation, turnOnLocation, type LocationStatus } from '../lib/location';
import { squircle, theme, vendorColors } from '../lib/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { EmptySection, PillButton } from './ui';

/** "350 m" / "1.4 km" (Western digits in both languages). */
function distance(km: number, t: ReturnType<typeof useI18n>['t']) {
  return km < 1 ? t('cards.meters', { m: Math.max(10, Math.round((km * 1000) / 10) * 10) }) : t('cards.km', { km: km < 10 ? km.toFixed(1) : Math.round(km) });
}

/**
 * My cards → "Near you": the coffee shops closest to where the customer is, nearest first
 * (distance to each shop's closest open branch). The position is sent when the app opens
 * (lib/location); without location permission a "Turn on location" card shows instead.
 */
export function NearYou() {
  const { t } = useI18n();
  const [data, setData] = useState<NearbyVendors | null>(null);
  const [status, setStatus] = useState<LocationStatus | null>(null);

  const load = useCallback(async () => {
    const s = await refreshMyLocation(); // already sent this session → no new prompt, no extra call
    setStatus(s);
    try {
      setData(await api.nearbyVendors(5));
    } catch {
      // keep what's shown; the next refresh tries again
    }
  }, []);
  useLiveRefresh(load);

  const title = <Text style={styles.title}>{t('cards.nearYou')}</Text>;

  if (data === null) {
    return (
      <View style={styles.section}>
        {title}
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      </View>
    );
  }

  // No position known at all (never allowed / never sent): ask for it.
  if (!data.located || (status === 'denied' && data.items.length === 0)) {
    return (
      <View style={styles.section}>
        {title}
        <View style={styles.ask}>
          <EmptySection icon={Location01Icon} title={t('cards.locationOffTitle')} text={t('cards.locationOffText')} />
          <PillButton
            title={t('cards.turnOnLocation')}
            onPress={async () => {
              setStatus(await turnOnLocation());
              setData(await api.nearbyVendors(5).catch(() => data));
            }}
            style={styles.askButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {title}
      {data.items.length === 0 ? (
        <EmptySection icon={Location01Icon} title={t('cards.noneNearbyTitle')} text={t('cards.noneNearbyText')} />
      ) : (
        <View style={styles.group}>
          {data.items.map((shop, i) => (
            <Pressable
              key={shop.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/shop/[id]', params: { id: shop.id, name: shop.name, logoUrl: shop.logoUrl ?? '' } })}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { opacity: 0.6 }]}
            >
              {shop.logoUrl ? (
                <Image source={{ uri: shop.logoUrl }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={[styles.logo, { backgroundColor: vendorColors(shop.id, shop.cardDesign)[0] }]}>
                  <Text style={styles.initial}>{shop.name.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                  {shop.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[shop.category ? t(`categories.${shop.category}`) : null, shop.nearestBranch].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={styles.distance}>{distance(shop.distanceKm, t)}</Text>
              <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} mirror />
            </Pressable>
          ))}
        </View>
      )}
      <PillButton title={t('cards.seeAllShops')} onPress={() => router.push('/discover')} style={styles.all} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 32, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: theme.text },
  loading: { marginVertical: 24 },
  ask: { gap: 12 },
  askButton: { backgroundColor: '#fff' },
  group: { backgroundColor: '#fff', ...squircle, borderRadius: theme.radius, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },
  logo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: '#fff', fontSize: 18, fontWeight: '800' },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: theme.text },
  meta: { fontSize: 13, color: theme.muted },
  distance: { fontSize: 14, fontWeight: '600', color: theme.secondary, fontVariant: ['tabular-nums'] },
  all: { backgroundColor: '#fff' },
});
