import CircleLock02Icon from '@hugeicons/core-free-icons/CircleLock02Icon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { localized, useI18n } from '../i18n';
import { api, type RewardHistory, type VendorPage } from '../lib/api';
import { showDate, showTime } from '../lib/dates';
import { squircle, theme } from '../lib/theme';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { Text } from './Text';
import { PillButton, PrimaryButton } from './ui';

export type Reward = VendorPage['rewards'][number];

/** The shop the reward belongs to (for the redeem QR's ticket). */
export interface RewardShop {
  id: string;
  name: string;
  logoUrl: string | null;
  cardDesign: number | null;
}

/**
 * Reward details sheet (tap a reward): image, points required, name, description and the
 * action. With enough points: Redeem, which opens a redeem QR for this reward (only this
 * shop's staff can confirm it; then its points are taken). Otherwise: a locked "Collect N
 * points more to redeem". Below: my history with this reward (how often, and when and where). Without a photo (uploaded in the dashboards) a placeholder
 * (gift on the dvote purple) shows until `imageUrl` is set.
 */
export function RewardSheet({
  reward,
  balance,
  shop,
  visible,
  onClose,
  onClosed,
}: {
  reward: Reward | null;
  balance: number;
  shop: RewardShop;
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
}) {
  const { t } = useI18n();
  const short = reward ? reward.pointsCost - balance : 0;
  const description = reward ? localized(reward.description, reward.descriptionAr) : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} title={t('rewards.details')}>
      {reward ? (
        <View>
          <View style={styles.image}>
            {reward.imageUrl ? (
              <Image source={{ uri: reward.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={['#EFEDFF', '#DCD8FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.placeholder]}
              >
                <Icon icon={GiftIcon} size={64} color={theme.brand} strokeWidth={1.5} />
              </LinearGradient>
            )}
          </View>

          <View style={styles.body}>
            <Text style={styles.required}>{t('rewards.required', { count: reward.pointsCost })}</Text>
            <Text style={styles.name}>{localized(reward.name, reward.nameAr)}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
            {reward.soldOutAt.length ? <SoldOut places={reward.soldOutAt} everywhere={reward.soldOutEverywhere} /> : null}

            {reward.soldOutEverywhere ? (
              <PillButton title={t('rewards.soldOutButton')} disabled onPress={() => undefined} style={styles.button} />
            ) : short <= 0 ? (
              <PrimaryButton
                title={t('rewards.redeem')}
                style={styles.redeem}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/qr',
                    params: {
                      purpose: 'redeem',
                      rewardId: reward.id,
                      rewardName: localized(reward.name, reward.nameAr),
                      pointsCost: String(reward.pointsCost),
                      vendorId: shop.id,
                      vendorName: shop.name,
                      logoUrl: shop.logoUrl ?? undefined,
                      cardDesign: shop.cardDesign != null ? String(shop.cardDesign) : undefined,
                    },
                  });
                }}
              />
            ) : (
              <PillButton
                title={t('rewards.collectMore', { count: short })}
                disabled
                icon={<Icon icon={CircleLock02Icon} size={20} color={theme.muted} />}
                onPress={() => undefined}
                style={styles.button}
              />
            )}

            {visible ? <History rewardId={reward.id} /> : null}
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

/**
 * Branches that ran out of this reward for now (set in the dashboard). Redeem stays on while
 * another branch has it (the staff app refuses it at a sold-out branch); sold out at every
 * branch turns it off.
 */
function SoldOut({ places, everywhere }: { places: Reward['soldOutAt']; everywhere: boolean }) {
  const { t } = useI18n();
  const back = (until: string | null) => {
    if (!until) return null;
    const at = new Date(until);
    const today = at.toDateString() === new Date().toDateString();
    return today ? t('rewards.backAt', { time: showTime(at) }) : t('rewards.backOn', { date: showDate(at), time: showTime(at) });
  };
  return (
    <View style={styles.soldOut}>
      <Text style={styles.soldOutTitle}>{t(everywhere ? 'rewards.soldOutEverywhere' : 'rewards.soldOut')}</Text>
      {places.map((p) => (
        <Text key={p.branchId} style={styles.soldOutRow}>
          {[p.branchName, back(p.until)].filter(Boolean).join(' · ')}
        </Text>
      ))}
    </View>
  );
}

/** Shown at most; older ones are summed up as "…and N earlier times". */
const HISTORY_ROWS = 3;

/**
 * My history with this reward: how many times I redeemed it (and the points that took), then
 * the latest times with day, time and branch. Loaded each time the sheet opens, so a reward
 * just redeemed at the counter is already listed.
 */
function History({ rewardId }: { rewardId: string }) {
  const { t } = useI18n();
  const [history, setHistory] = useState<RewardHistory | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setHistory(null);
    setFailed(false);
    api
      .rewardHistory(rewardId)
      .then((h) => live && setHistory(h))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [rewardId]);

  if (failed) return null; // the rest of the sheet still works
  return (
    <View style={styles.history}>
      <Text style={styles.historyTitle}>{t('rewards.yourHistory')}</Text>
      {!history ? (
        <ActivityIndicator color={theme.muted} style={styles.historyLoading} />
      ) : history.count === 0 ? (
        <Text style={styles.historyEmpty}>{t('rewards.neverRedeemed')}</Text>
      ) : (
        <View style={styles.historyCard}>
          <View style={styles.historyHead}>
            <Icon icon={GiftIcon} size={18} color={theme.brand} />
            <Text style={styles.historyCount}>{t('rewards.redeemedTimes', { count: history.count })}</Text>
            <Text style={styles.historySpent}>
              {t('rewards.pointsSpent', { points: t('common.points', { count: history.pointsSpent }) })}
            </Text>
          </View>
          {history.items.slice(0, HISTORY_ROWS).map((h) => {
            const at = new Date(h.at);
            return (
              <View key={h.id} style={styles.historyRow}>
                <View style={styles.historyWhen}>
                  <Text style={styles.historyDate}>{showDate(at)}</Text>
                  <Text style={styles.historyMeta} numberOfLines={1}>
                    {showTime(at)} · {h.branchName}
                  </Text>
                </View>
                <Text style={styles.historyPoints}>−{h.pointsCost.toLocaleString('en-US')}</Text>
              </View>
            );
          })}
          {history.count > HISTORY_ROWS ? (
            <Text style={styles.historyMore}>{t('rewards.earlier', { count: history.count - HISTORY_ROWS })}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { height: 240, marginHorizontal: theme.gutter, ...squircle, borderRadius: theme.radius, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: theme.gutter, paddingTop: 18, gap: 6 },
  required: { fontSize: 15, color: theme.secondary },
  name: { fontSize: 24, fontWeight: '700', color: theme.text },
  description: { fontSize: 16, color: theme.muted, lineHeight: 22 },
  // The sheet is white, so the pill gets the light page grey (the darker "Soon" tag stays visible on it).
  button: { backgroundColor: theme.surface, marginTop: 14 },
  redeem: { marginTop: 14 },
  soldOut: { marginTop: 10, gap: 2, backgroundColor: theme.surface, ...squircle, borderRadius: theme.radius, paddingHorizontal: 14, paddingVertical: 10 },
  soldOutTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
  soldOutRow: { fontSize: 14, color: theme.muted },
  history: { marginTop: 18, gap: 8 },
  historyTitle: { fontSize: 13, fontWeight: '600', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  historyLoading: { alignSelf: 'flex-start', marginVertical: 6 },
  historyEmpty: { fontSize: 15, color: theme.muted },
  historyCard: { backgroundColor: '#fff', ...squircle, borderRadius: theme.radius, paddingHorizontal: 14, paddingVertical: 6 },
  historyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  historyCount: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.text },
  historySpent: { fontSize: 14, color: theme.muted },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  historyWhen: { flex: 1, gap: 2 },
  historyDate: { fontSize: 15, fontWeight: '600', color: theme.text },
  historyMeta: { fontSize: 13, color: theme.muted },
  historyPoints: { fontSize: 15, fontWeight: '600', color: theme.text, fontVariant: ['tabular-nums'] },
  historyMore: { fontSize: 13, color: theme.muted, paddingVertical: 8 },
});
