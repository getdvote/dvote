import CircleLock02Icon from '@hugeicons/core-free-icons/CircleLock02Icon';
import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { localized, useI18n } from '../i18n';
import type { VendorPage } from '../lib/api';
import { squircle, theme } from '../lib/theme';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { Text } from './Text';
import { PillButton, SoonTag } from './ui';

export type Reward = VendorPage['rewards'][number];

/**
 * Reward details sheet (tap a reward): image, points required, name, description and the
 * action. With enough points: Redeem, dimmed with "Soon" (no redeem API yet). Otherwise:
 * a locked "Collect N points more to redeem". Without a photo (uploaded in the dashboards) a placeholder
 * (gift on the dvote purple) shows until `imageUrl` is set.
 */
export function RewardSheet({
  reward,
  balance,
  visible,
  onClose,
  onClosed,
}: {
  reward: Reward | null;
  balance: number;
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

            {short <= 0 ? (
              // Redeem isn't available yet (no redeem API)
              <PillButton
                title={t('rewards.redeem')}
                disabled
                badge={<SoonTag />}
                onPress={() => undefined}
                style={styles.button}
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
          </View>
        </View>
      ) : null}
    </BottomSheet>
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
  button: { backgroundColor: theme.background, marginTop: 14 },
});
