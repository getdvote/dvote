import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { localized, useI18n } from '../i18n';
import { squircle, theme } from '../lib/theme';
import { Icon } from './Icon';
import { RewardSheet, type Reward, type RewardShop } from './RewardSheet';
import { Text } from './Text';
import { EmptySection } from './ui';

/** How many rewards the row shows on card details and the shop page; the rest are behind "View all". */
export const CAROUSEL_LIMIT = 5;

/**
 * A shop's rewards as cards: image, name, description and points cost (green when this
 * balance can afford it). Tap a card to see its details (RewardSheet).
 * - `row`: the first CAROUSEL_LIMIT in a horizontal scroll (card details, shop page; the
 *   parent shows "View all" when there are more).
 * - `column`: every reward given, one full-width card after another (All rewards).
 */
export function RewardCards({
  rewards,
  balance,
  shop,
  layout,
}: {
  rewards: Reward[];
  balance: number;
  /** The shop the rewards belong to (Redeem opens a QR for it). */
  shop: RewardShop;
  layout: 'row' | 'column';
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Reward | null>(null);
  // Kept while the sheet slides away, so its content doesn't vanish mid-animation.
  const [shown, setShown] = useState<Reward | null>(null);
  if (rewards.length === 0) {
    return <EmptySection icon={GiftIcon} title={t('rewards.none')} text={t('rewards.noneText')} />;
  }
  const row = layout === 'row';
  const cards = (row ? rewards.slice(0, CAROUSEL_LIMIT) : rewards).map((r) => (
    <RewardCard
      key={r.id}
      reward={r}
      balance={balance}
      wide={!row}
      onPress={() => {
        setShown(r);
        setOpen(r);
      }}
    />
  ));
  return (
    <>
      {row ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // bleed to the screen edges so cards scroll under the page gutter
          style={styles.scroller}
          contentContainerStyle={styles.row}
        >
          {cards}
        </ScrollView>
      ) : (
        <View style={styles.column}>{cards}</View>
      )}
      <RewardSheet
        reward={shown}
        balance={balance}
        shop={shop}
        visible={open !== null}
        onClose={() => setOpen(null)}
        onClosed={() => setShown(null)}
      />
    </>
  );
}

function RewardCard({
  reward,
  balance,
  wide,
  onPress,
}: {
  reward: Reward;
  balance: number;
  wide: boolean;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const description = localized(reward.description, reward.descriptionAr);
  const enough = reward.pointsCost <= balance;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, wide ? styles.cardWide : styles.cardNarrow, pressed && styles.pressed]}
    >
      <View style={wide ? styles.imageWide : styles.image}>
        {reward.imageUrl ? (
          <Image source={{ uri: reward.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={['#EFEDFF', '#DCD8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.placeholder]}
          >
            <Icon icon={GiftIcon} size={wide ? 48 : 36} color={theme.brand} strokeWidth={1.5} />
          </LinearGradient>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {localized(reward.name, reward.nameAr)}
        </Text>
        {wide ? (
          description ? (
            <Text style={styles.description} numberOfLines={3}>
              {description}
            </Text>
          ) : null
        ) : (
          // two lines tall even when short, so every card in the row has the same height
          <Text style={[styles.description, styles.descriptionFixed]} numberOfLines={2}>
            {description ?? ' '}
          </Text>
        )}
        <Text style={[styles.cost, enough && styles.ready]}>{t('common.pts', { count: reward.pointsCost })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroller: { marginHorizontal: -theme.gutter },
  row: { paddingHorizontal: theme.gutter, gap: 12 },
  column: { gap: 12 },
  card: { ...squircle, backgroundColor: theme.surface, borderRadius: theme.radius, overflow: 'hidden' },
  // narrow enough that the next card peeks in, hinting the row scrolls
  cardNarrow: { width: 176 },
  cardWide: { alignSelf: 'stretch' },
  pressed: { opacity: 0.6 },
  image: { height: 120 },
  imageWide: { height: 160 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 14, gap: 4 },
  name: { fontSize: 16, fontWeight: '600', color: theme.text },
  description: { fontSize: 13, lineHeight: 18, color: theme.muted },
  descriptionFixed: { minHeight: 36 },
  cost: { fontSize: 15, fontWeight: '700', color: theme.text, marginTop: 4 },
  ready: { color: theme.success },
});
