import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import type { Card } from '../lib/api';
import { LoyaltyCard } from './LoyaltyCard';

const CARD_HEIGHT = 200; // LoyaltyCard's height
const PEEK = 14; // collapsed: how much of each card behind shows above the front one
const STEP = 150; // open: each card shows its logo, name and full balance (a smaller step would cut the number)
const MAX_PEEKING = 4; // collapsed: at most this many cards show behind the front one
const DURATION = 320;

/**
 * Apple Wallet-style stack of loyalty cards. Collapsed: the first card in front, the next
 * ones peeking above it; tap anywhere to open. Open: the cards fan out so each shows its
 * top strip, with the first card fully visible at the bottom; tap one for its details.
 * `expanded` is controlled by the screen (which also shows the X close button).
 */
export function CardStack({
  cards,
  expanded,
  onExpand,
  onOpenCard,
}: {
  cards: Card[];
  expanded: boolean;
  onExpand: () => void;
  onOpenCard: (card: Card) => void;
}) {
  const { t } = useI18n();
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current; // 0 collapsed, 1 open

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      // animates the container height, which the native driver can't do
      useNativeDriver: false,
    }).start();
  }, [expanded, progress]);

  const n = cards.length;
  const peeking = Math.min(n - 1, MAX_PEEKING);
  const height = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_HEIGHT + peeking * PEEK, CARD_HEIGHT + (n - 1) * STEP],
  });

  return (
    <Animated.View style={{ height }} accessibilityLabel={expanded ? undefined : t('cards.stackA11y', { count: n })}>
      {cards.map((card, i) => {
        // i = 0 is the front card: drawn last, at the bottom of the stack.
        const fromTop = n - 1 - i;
        const collapsedTop = Math.max(0, fromTop - (n - 1 - peeking)) * PEEK;
        const top = progress.interpolate({ inputRange: [0, 1], outputRange: [collapsedTop, fromTop * STEP] });
        return (
          <Animated.View key={card.id} style={[styles.slot, { top, zIndex: n - i }]}>
            <View style={styles.shadow}>
              <LoyaltyCard card={card} onPress={expanded ? () => onOpenCard(card) : onExpand} />
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', left: 0, right: 0 },
  // a soft edge between overlapping cards
  shadow: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 3,
  },
});
