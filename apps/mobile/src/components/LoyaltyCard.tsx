import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { t } from '../i18n';
import type { Card } from '../lib/api';
import { onCardColor, vendorColors, squircle } from '../lib/theme';
import { DvoteLogo } from './DvoteLogo';

/** One vendor card (cards design): the vendor's colour, logo and points balance. */
export function LoyaltyCard({ card, onPress }: { card: Card; onPress?: () => void }) {
  const colors = vendorColors(card.vendor.id);
  const ink = onCardColor(colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('cards.cardA11y', { name: card.vendor.name, balance: t('common.points', { count: card.balance }) })}
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

        <Text style={[styles.balance, { color: ink }]}>
          {card.balance.toLocaleString()}
          <Text style={styles.pts}> {t('common.ptsUnit', { count: card.balance })}</Text>
        </Text>
      </LinearGradient>
    </Pressable>
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
