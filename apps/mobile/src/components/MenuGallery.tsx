import Coffee02Icon from '@hugeicons/core-free-icons/Coffee02Icon';
import { Image } from 'expo-image';
import { FlatList, StyleSheet, View } from 'react-native';
import { theme } from '../lib/theme';
import { EmptySection } from './ui';

const PAGE_WIDTH = 220;
const PAGE_HEIGHT = 330; // menu pages are portrait (2:3)
const GAP = 12;

/**
 * A shop's menu as its menu-page images (e.g. Classics, Bakery, Sandwiches), side by side in
 * a horizontal swipe row. With no images yet it shows the "Menu coming soon" empty state.
 */
export function MenuGallery({ images }: { images: string[] }) {
  if (images.length === 0) {
    return (
      <EmptySection
        icon={Coffee02Icon}
        title="Menu coming soon"
        text="This shop's menu pages will show here."
      />
    );
  }
  return (
    <FlatList
      horizontal
      data={images}
      keyExtractor={(uri, i) => `${i}-${uri}`}
      showsHorizontalScrollIndicator={false}
      // Bleed to the screen edges so the next page peeks in, but line up with the content.
      style={styles.bleed}
      contentContainerStyle={styles.row}
      snapToInterval={PAGE_WIDTH + GAP}
      decelerationRate="fast"
      ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
      renderItem={({ item, index }) => (
        <Image
          source={{ uri: item }}
          style={styles.page}
          contentFit="cover"
          transition={150}
          accessibilityLabel={`Menu page ${index + 1} of ${images.length}`}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -theme.gutter },
  row: { paddingHorizontal: theme.gutter },
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    borderRadius: theme.radius,
    backgroundColor: theme.fill,
  },
});
