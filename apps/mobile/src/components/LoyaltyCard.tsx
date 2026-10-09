import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { t } from '../i18n';
import type { Card } from '../lib/api';
import { cardDesign, squircle, type CardPattern as CardPatternKind } from '../lib/theme';
import { DvoteLogo } from './DvoteLogo';

/** One vendor card: the design the vendor chose (1 of 10: colours + pattern), its logo and the balance. */
export function LoyaltyCard({ card, onPress }: { card: Card; onPress?: () => void }) {
  const design = cardDesign(card.vendor.id, card.vendor.cardDesign);
  const { colors, ink } = design;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('cards.cardA11y', { name: card.vendor.name, balance: t('common.points', { count: card.balance }) })}
      onPress={onPress}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <CardPattern kind={design.pattern} tint={ink === '#FFFFFF' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'} />

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

        <Text style={[styles.balance, { color: ink }]}>
          {card.balance.toLocaleString()}
          <Text style={styles.pts}> {t('common.ptsUnit', { count: card.balance })}</Text>
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

/** The faint decoration of a card design. Same four patterns as the dashboard previews. */
export function CardPattern({ kind, tint }: { kind: CardPatternKind; tint: string }) {
  if (kind === 'circles') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.circle, { width: 220, height: 220, right: -70, top: -90, backgroundColor: tint }]} />
        <View style={[styles.circle, { width: 140, height: 140, right: 40, bottom: -70, backgroundColor: tint }]} />
      </View>
    );
  }
  if (kind === 'stripes') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.stripe, { right: -40 + i * 46, backgroundColor: tint }]} />
        ))}
      </View>
    );
  }
  if (kind === 'dots') {
    return (
      <View style={styles.dots} pointerEvents="none">
        {Array.from({ length: 30 }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: tint }]} />
        ))}
      </View>
    );
  }
  // faint dvote petals
  return (
    <View style={styles.pattern} pointerEvents="none">
      <DvoteLogo height={190} wordmark={false} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...squircle,
    height: 200,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  pattern: { position: 'absolute', right: -40, top: -10 },
  circle: { position: 'absolute', borderRadius: 999 },
  stripe: { position: 'absolute', top: -60, width: 22, height: 340, transform: [{ rotate: '28deg' }] },
  dots: { position: 'absolute', right: 18, top: 18, width: 150, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 40, height: 40, borderRadius: 20 },
  logoFallback: { backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 18, fontWeight: '800' },
  vendor: { flex: 1, fontSize: 17, fontWeight: '700' },
  // Sits in the card's upper part so it stays visible when the open stack overlaps the
  // bottom of every card but the front one (CardStack's STEP).
  balance: { fontSize: 34, fontWeight: '800', letterSpacing: 0.5, marginTop: 36 },
  pts: { fontSize: 17, fontWeight: '600' },
});
