import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { squircle, theme } from '../lib/theme';
import { Text } from './Text';

const OPEN_MS = 280;
const CLOSE_MS = 220;

/**
 * Bottom sheet: the dark backdrop fades in place while only the sheet slides up (the Modal's
 * own "slide" would move the backdrop too). Tap the backdrop to close. Stays mounted until
 * the closing slide has finished, then calls `onClosed` (e.g. to clear what it showed).
 */
export function BottomSheet({
  visible,
  onClose,
  onClosed,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(600);
  const progress = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = open
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setMounted(false);
        closedRef.current?.();
      });
    }
  }, [visible, progress]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel={t('common.close')} />
      </Animated.View>
      <View style={styles.bottom} pointerEvents="box-none">
        <Animated.View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16 },
            { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }) }] },
          ]}
        >
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    ...squircle,
    backgroundColor: theme.surface,
    borderTopLeftRadius: theme.radius + 8,
    borderTopRightRadius: theme.radius + 8,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.placeholder,
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '600', color: theme.text, textAlign: 'center', marginBottom: 14 },
});
