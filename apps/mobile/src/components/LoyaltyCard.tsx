import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import type { Card } from '../lib/api';
import { onCardColor, vendorColors, squircle } from '../lib/theme';
import { DvoteLogo } from './DvoteLogo';

/**
 * One vendor card (cards design): the vendor's colour, logo, points balance and progress
 * to the next reward.
 */
export function LoyaltyCard({ card, onPress }: { card: Card; onPress?: () => void }) {
  const colors = vendorColors(card.vendor.id);
  const ink = onCardColor(colors);
  const next = card.nextReward;
  const progress = next ? Math.min(1, card.balance / next.pointsCost) : 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.vendor.name}: ${card.balance} points`}
      onPress={onPress}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        {/* faint dvote petals as the card pattern */}
        <View style={styles.pattern} pointerEvents="none">
          <DvoteLogo height={190} wordmark={false} color={ink === '#FFFFFF' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'} />
        </View>

        <View style={styles.top}>
          {card.vendor.logoUrl ? (
            <Image source={{ uri: card.vendor.logoUrl }} style={styles.logo} contentFit="contain" />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={[styles.logoInitial, { color: colors[0] }]}>{card.vendor.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text style={[styles.vendor, { color: ink }]} numberOfLines={1}>
            {card.vendor.name}
          </Text>
        </View>

        <View>
          <Text style={[styles.balance, { color: ink }]}>
            {card.balance.toLocaleString()}
            <Text style={styles.pts}> pts</Text>
          </Text>
          <View style={[styles.track, { backgroundColor: ink === '#FFFFFF' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)' }]}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: ink }]} />
          </View>
          <Text style={[styles.caption, { color: ink }]} numberOfLines={1}>
            {rewardCaption(card)}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Progress line shown under a card's balance (also used by the My cards list). */
export function rewardCaption(card: Card): string {
  const next = card.nextReward;
  if (next) return `${next.pointsNeeded} pts to ${next.name}`;
  if (card.affordableRewards > 0) {
    return `${card.affordableRewards} reward${card.affordableRewards === 1 ? '' : 's'} ready to redeem`;
  }
  return `Lifetime ${card.lifetimePoints.toLocaleString()} pts`;
}

const styles = StyleSheet.create({
  card: {
    ...squircle,
    height: 200,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  pattern: { position: 'absolute', right: -40, top: -10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 40, height: 40, borderRadius: 20 },
  logoFallback: { backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 18, fontWeight: '800' },
  vendor: { flex: 1, fontSize: 17, fontWeight: '700' },
  balance: { fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
  pts: { fontSize: 17, fontWeight: '600' },
  track: { ...squircle, height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  fill: { ...squircle, height: '100%', borderRadius: 3 },
  caption: { fontSize: 13, fontWeight: '600', marginTop: 8, opacity: 0.95 },
});
