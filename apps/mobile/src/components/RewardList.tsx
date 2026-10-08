import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { VendorPage } from '../lib/api';
import { theme } from '../lib/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { EmptySection, Group } from './ui';

/**
 * Every active reward of a shop, cheapest-first in the shop's order, each with its cost and
 * either "N pts to go" or "You have enough points" for this balance. Used on the shop page
 * and on card details.
 */
export function RewardList({ rewards, balance }: { rewards: VendorPage['rewards']; balance: number }) {
  if (rewards.length === 0) {
    return <EmptySection icon={GiftIcon} title="No rewards yet" text="This shop's rewards will show here." />;
  }
  return (
    <Group>
      {rewards.map((r) => {
        const short = r.pointsCost - balance;
        return (
          <View key={r.id} style={styles.reward}>
            <View style={styles.icon}>
              {r.imageUrl ? (
                <Image source={{ uri: r.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Icon icon={GiftIcon} size={20} color={theme.text} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {r.name}
              </Text>
              {r.description ? (
                <Text style={styles.text} numberOfLines={2}>
                  {r.description}
                </Text>
              ) : null}
              <Text style={[styles.text, short <= 0 && styles.ready]}>
                {short <= 0 ? 'You have enough points' : `${short.toLocaleString()} pts to go`}
              </Text>
            </View>
            <Text style={styles.cost}>{r.pointsCost.toLocaleString()} pts</Text>
          </View>
        );
      })}
    </Group>
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
  cost: { fontSize: 16, fontWeight: '700', color: theme.text },
});
