import Coffee02Icon from '@hugeicons/core-free-icons/Coffee02Icon';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { theme, squircle } from '../lib/theme';
import { ImageViewer } from './ImageViewer';
import { useI18n } from '../i18n';
import { EmptySection } from './ui';

const PAGE_WIDTH = 220;
const PAGE_HEIGHT = 330; // menu pages are portrait (2:3)
const GAP = 12;

/**
 * A shop's menu as its menu-page images (e.g. Classics, Bakery, Sandwiches), side by side in
 * a horizontal swipe row. Tapping a page opens it full screen (swipe between pages, pinch to
 * zoom on iOS). With no images yet it shows the "Menu coming soon" empty state.
 */
export function MenuGallery({ images }: { images: string[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const { t } = useI18n();
  if (images.length === 0) {
    return (
      <EmptySection
        icon={Coffee02Icon}
        title={t('shop.menuSoon')}
        text={t('shop.menuSoonText')}
      />
    );
  }
  return (
    <>
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
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={t('shop.menuPageA11y', { n: index + 1, total: images.length })}
            onPress={() => setOpenAt(index)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Image source={{ uri: item }} style={styles.page} contentFit="cover" transition={150} />
          </Pressable>
        )}
      />
      <ImageViewer
        images={images}
        startIndex={openAt ?? 0}
        visible={openAt !== null}
        onClose={() => setOpenAt(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -theme.gutter },
  row: { paddingHorizontal: theme.gutter },
  pressed: { opacity: 0.85 },
  page: {
    ...squircle,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    borderRadius: theme.radius,
    backgroundColor: theme.fill,
  },
});
