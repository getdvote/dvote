import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import Coins01Icon from '@hugeicons/core-free-icons/Coins01Icon';
import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DvoteLogo } from '../../components/DvoteLogo';
import { Icon } from '../../components/Icon';
import { ImageViewer } from '../../components/ImageViewer';
import { MenuGallery } from '../../components/MenuGallery';
import { CAROUSEL_LIMIT, RewardCards } from '../../components/RewardCards';
import { Text } from '../../components/Text';
import {
  EmptySection,
  ErrorBox,
  Group,
  PageHeader,
  PillButton,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '../../components/ui';
import { api, ApiError, type VendorPage } from '../../lib/api';
import { t as translate, useI18n } from '../../i18n';
import { openInMaps } from '../../lib/maps';
import { useSession } from '../../lib/session';
import { theme, vendorColors, squircle } from '../../lib/theme';
import { useLiveRefresh } from '../../lib/live';

/**
 * Shop page (opened from Card details → Issued by). Name and logo come in the route params,
 * so the header shows at once; GET /api/app/vendors/{id} then fills in how points are earned,
 * the rewards (with what the customer can already afford), the menu pages and the branches
 * (address, photos, directions).
 *
 * Vendors have no cover image field yet, so the banner uses the shop's colour (same as its
 * card); pass `coverUrl` once the API has one and the photo is shown instead.
 */
export default function Shop() {
  const params = useLocalSearchParams<{ id: string; name?: string; logoUrl?: string; coverUrl?: string }>();
  const { handleAuthError } = useSession();
  const { t } = useI18n();
  const [shop, setShop] = useState<VendorPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setShop(await api.vendor(params.id));
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('shop.couldNotLoad'));
    }
  }, [params.id, handleAuthError, t]);

  useLiveRefresh(load);

  const shopName = shop?.name ?? (params.name || t('shop.fallbackName'));
  const logoUrl = shop?.logoUrl ?? params.logoUrl ?? null;
  const colors = vendorColors(params.id ?? '');
  const open = (images: string[], index = 0) => setViewer({ images, index });

  return (
    <Screen>
      <PageHeader title={shopName} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          {params.coverUrl ? (
            <Image source={{ uri: params.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
              {/* faint dvote petals, like the cards */}
              <View style={styles.pattern} pointerEvents="none">
                <DvoteLogo height={220} wordmark={false} color="rgba(255,255,255,0.10)" />
              </View>
            </LinearGradient>
          )}
        </View>

        <View style={styles.hero}>
          {logoUrl ? (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={t('shop.logoA11y', { name: shopName })}
              onPress={() => open([logoUrl])}
              style={({ pressed }) => pressed && { opacity: 0.85 }}
            >
              <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="contain" />
            </Pressable>
          ) : (
            <View style={[styles.logo, { backgroundColor: colors[0] }]}>
              <Text style={styles.logoInitial}>{shopName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{shopName}</Text>
          {shop?.card ? <Text style={styles.balance}>{t('shop.youHave', { count: shop.card.balance })}</Text> : null}
        </View>

        {/* Collect opens the normal collect QR, headed with this shop's name: a collect QR
            names no shop (the scanning staff decide it), so it isn't locked to this one. */}
        <View style={styles.actions}>
          <PrimaryButton
            title={t('shop.collect')}
            style={styles.action}
            onPress={() => router.push({ pathname: '/qr', params: { vendorId: params.id, vendorName: shopName } })}
          />
        </View>

        {!shop ? (
          error ? (
            <View style={styles.retry}>
              <ErrorBox message={error} />
              <PillButton title={t('common.tryAgain')} onPress={() => void load()} />
            </View>
          ) : (
            <ActivityIndicator color={theme.text} style={{ marginTop: 32 }} />
          )
        ) : (
          <>
            <SectionTitle title={t('shop.earnTitle')} />
            <EarnRule shop={shop} />

            <SectionTitle
              title={t('shop.rewards')}
              action={
                shop.rewards.length > CAROUSEL_LIMIT
                  ? {
                      label: t('rewards.viewAll'),
                      onPress: () => router.push({ pathname: '/rewards/[vendorId]', params: { vendorId: shop.id } }),
                    }
                  : undefined
              }
            />
            <RewardCards rewards={shop.rewards} balance={shop.card?.balance ?? 0} layout="row" />

            <SectionTitle title={t('shop.menu')} />
            <MenuGallery images={shop.menu.map((m) => m.url)} />

            <SectionTitle title={t('shop.branches')} />
            <Branches shop={shop} onOpenPhotos={open} />
          </>
        )}
      </ScrollView>
      <ImageViewer
        images={viewer?.images ?? []}
        startIndex={viewer?.index ?? 0}
        visible={viewer !== null}
        onClose={() => setViewer(null)}
      />
    </Screen>
  );
}

/** "10.00" → "10", "12.50" → "12.50" */
const amount = (v: string) => (v.endsWith('.00') ? v.slice(0, -3) : v);

function EarnRule({ shop }: { shop: VendorPage }) {
  const rule = shop.rule;
  if (!rule) {
    return (
      <EmptySection
        icon={Coins01Icon}
        title={translate('shop.noRule')}
        text={translate('shop.noRuleText')}
      />
    );
  }
  const notes = [
    Number(rule.minPurchase) > 0
      ? translate('shop.minBill', { amount: amount(rule.minPurchase), currency: shop.currency })
      : null,
    rule.maxPointsPerPurchase ? translate('shop.cap', { count: rule.maxPointsPerPurchase }) : null,
    translate('shop.roundedDown'),
  ].filter(Boolean);
  return (
    <Group>
      <View style={styles.rule}>
        <View style={styles.ruleIcon}>
          <Icon icon={Coins01Icon} size={22} color={theme.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ruleMain}>
            {translate('shop.rule', {
              amount: amount(rule.spendAmount),
              currency: shop.currency,
              points: translate('common.points', { count: rule.pointsPerSpend }),
            })}
          </Text>
          {notes.map((n) => (
            <Text key={n} style={styles.ruleNote}>
              {n}
            </Text>
          ))}
        </View>
      </View>
    </Group>
  );
}

/** Opens the branch in a maps app: iOS asks Apple Maps or Google Maps, Android opens Google Maps. */
function directions(b: VendorPage['branches'][number]) {
  if ((b.lat === null || b.lng === null) && !b.address) return;
  openInMaps({ name: b.name, lat: b.lat, lng: b.lng, address: b.address });
}

function Branches({ shop, onOpenPhotos }: { shop: VendorPage; onOpenPhotos: (images: string[], index: number) => void }) {
  if (shop.branches.length === 0) {
    return <EmptySection icon={Location01Icon} title={translate('shop.noBranches')} text={translate('shop.noBranchesText')} />;
  }
  return (
    <Group>
      {shop.branches.map((b) => {
        const canNavigate = (b.lat !== null && b.lng !== null) || !!b.address;
        const photos = b.photos.map((p) => p.url);
        return (
          <View key={b.id} style={styles.branch}>
            <Pressable
              accessibilityRole={canNavigate ? 'link' : undefined}
              accessibilityLabel={canNavigate ? translate('shop.directionsA11y', { name: b.name }) : b.name}
              disabled={!canNavigate}
              onPress={() => directions(b)}
              style={({ pressed }) => [styles.branchRow, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.ruleIcon}>
                <Icon icon={Location01Icon} size={20} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rewardName}>{b.name}</Text>
                <Text style={styles.rewardText} numberOfLines={2}>
                  {b.address ?? translate('shop.addressSoon')}
                </Text>
                {canNavigate ? <Text style={styles.link}>{translate('shop.directions')}</Text> : null}
              </View>
              {canNavigate ? <Icon icon={ArrowRight01Icon} size={18} color={theme.placeholder} mirror /> : null}
            </Pressable>
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                {photos.map((url, i) => (
                  <Pressable
                    key={url}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={translate('shop.photoA11y', { name: b.name, n: i + 1 })}
                    onPress={() => onOpenPhotos(photos, i)}
                  >
                    <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        );
      })}
    </Group>
  );
}

const LOGO_SIZE = 88;

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingBottom: 40 },
  banner: { ...squircle, height: 160, borderRadius: theme.radius, overflow: 'hidden', backgroundColor: theme.fill },
  pattern: { position: 'absolute', right: -40, top: -20 },
  // The logo overlaps the bottom of the banner.
  hero: { alignItems: 'center', gap: 10, marginTop: -LOGO_SIZE / 2 },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 4,
    borderColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.surface,
  },
  logoInitial: { fontSize: 32, fontWeight: '700', color: '#fff' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  action: { flex: 1 },
  name: { fontSize: 24, fontWeight: '700', color: theme.text, textAlign: 'center' },
  balance: { fontSize: 15, fontWeight: '600', color: theme.muted },
  retry: { gap: 12, marginTop: 24 },
  rule: { flexDirection: 'row', gap: 14, paddingVertical: 16, alignItems: 'flex-start' },
  ruleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleMain: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 4 },
  ruleNote: { fontSize: 14, color: theme.muted, lineHeight: 20 },
  rewardName: { fontSize: 17, fontWeight: '600', color: theme.text },
  rewardText: { fontSize: 14, color: theme.muted, marginTop: 2 },
  branch: { paddingVertical: 14, gap: 12 },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  link: { fontSize: 14, fontWeight: '600', color: theme.link, marginTop: 4 },
  photos: { gap: 8, paddingLeft: 54 },
  photo: { width: 96, height: 72, borderRadius: 10, backgroundColor: theme.fill },
});
