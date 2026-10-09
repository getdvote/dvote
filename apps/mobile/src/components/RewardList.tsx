import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { localized, useI18n } from '../i18n';
import type { VendorPage } from '../lib/api';
import { theme } from '../lib/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { RewardSheet, type Reward } from './RewardSheet';
import { EmptySection, Group } from './ui';

/**
 * Every active reward of a shop, cheapest-first in the shop's order, each with its cost and
 * either "N pts to go" or "You have enough points" for this balance. Used on the shop page
 * and on card details. Tap a reward to see its details (RewardSheet).
 */
export function RewardList({ rewards, balance }: { rewards: VendorPage['rewards']; balance: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Reward | null>(null);
  // Kept while the sheet slides away, so its content doesn't vanish mid-animation.
  const [shown, setShown] = useState<Reward | null>(null);
  if (rewards.length === 0) {
    return <EmptySection icon={GiftIcon} title={t('rewards.none')} text={t('rewards.noneText')} />;
  }
  return (
    <>
      <Group>
        {rewards.map((r) => {
          const short = r.pointsCost - balance;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => {
                setShown(r);
                setOpen(r);
              }}
              style={({ pressed }) => [styles.reward, pressed && styles.pressed]}
            >
              <View style={styles.icon}>
                {r.imageUrl ? (
                  <Image source={{ uri: r.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Icon icon={GiftIcon} size={20} color={theme.text} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {localized(r.name, r.nameAr)}
                </Text>
                {localized(r.description, r.descriptionAr) ? (
                  <Text style={styles.text} numberOfLines={2}>
                    {localized(r.description, r.descriptionAr)}
                  </Text>
                ) : null}
                <Text style={[styles.text, short <= 0 && styles.ready]}>
                  {short <= 0 ? t('rewards.enough') : t('rewards.toGo', { count: short })}
                </Text>
              </View>
              <Text style={styles.cost}>{t('common.pts', { count: r.pointsCost })}</Text>
            </Pressable>
          );
        })}
      </Group>
      <RewardSheet
        reward={shown}
        balance={balance}
        visible={open !== null}
        onClose={() => setOpen(null)}
        onClosed={() => setShown(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  reward: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { fontSize: 17, fontWeight: '600', color: theme.text },
  text: { fontSize: 14, color: theme.muted, marginTop: 2 },
  ready: { color: theme.success, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  cost: { fontSize: 16, fontWeight: '700', color: theme.text },
});
