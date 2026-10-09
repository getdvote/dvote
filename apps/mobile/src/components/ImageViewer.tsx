import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { squircle } from '../lib/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { t } from '../i18n';

/**
 * Full-screen image viewer: black background, swipe between images, "2 / 3" counter, close
 * button. On iOS each image can be pinch-zoomed (ScrollView zoom is iOS-only), which helps
 * read menu prices. Opens at `startIndex`; render with `images=[]` / `visible=false` to hide.
 */
export function ImageViewer({
  images,
  startIndex = 0,
  visible,
  onClose,
}: {
  images: string[];
  startIndex?: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={() => setIndex(startIndex)}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop}>
        <FlatList
          horizontal
          pagingEnabled
          data={images}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={{ width, height }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: item }}
                style={{ width, height }}
                contentFit="contain"
                transition={150}
                accessibilityLabel={images.length > 1 ? t('common.imageOf', { n: i + 1, total: images.length }) : t('common.image')}
              />
            </ScrollView>
          )}
        />

        <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
          {images.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {index + 1} / {images.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
          >
            <Icon icon={Cancel01Icon} size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    ...squircle,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
  },
  counterText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // 44 pt: Apple's minimum comfortable tap size (same as the back button).
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
