import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { squircle, theme } from '../lib/theme';
import { Text } from './Text';

const OPEN_MS = 280;
const CLOSE_MS = 220;
/** Widest the sheet gets (tablets, web); centred on wider screens. */
export const SHEET_MAX_WIDTH = 520;
/** A downward drag past this distance, or a fast flick, closes the sheet. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.8;

/**
 * The app's one bottom sheet: every sheet (event, reward, feedback, birthday) is built on it so
 * they look and move the same. The dark backdrop fades in place while only the sheet slides up
 * (the Modal's own "slide" would move the backdrop too). Closes on a backdrop tap, the Android
 * back button, or dragging the sheet down. Stays mounted until the closing slide has finished,
 * then calls `onClosed` (e.g. to clear what it showed). Lifts above the keyboard on iOS.
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
  const { t, rtl } = useI18n();
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(600);
  const progress = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = open
  const drag = useRef(new Animated.Value(0)).current; // how far the finger has pulled it down
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // Slides out from wherever a drag left it, so there is no jump.
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
  }, [visible, progress, drag]);

  // Drag down to close. The sheet takes a touch only when nothing inside it does, so buttons and
  // chips still get their taps; an inner list that starts scrolling takes the touch back.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          closeRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const slide = progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] });
  // The backdrop fades as the sheet is pulled down.
  const dragFade = drag.interpolate({ inputRange: [0, sheetHeight], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: Animated.multiply(progress, dragFade) }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel={t('common.close')} />
      </Animated.View>
      <KeyboardAvoidingView
        style={styles.bottom}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          {...pan.panHandlers}
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, direction: rtl ? 'rtl' : 'ltr' },
            { transform: [{ translateY: Animated.add(slide, drag) }] },
          ]}
        >
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    ...squircle,
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    // Page grey with white cards and buttons on it, like the app's pages and the QR screen.
    backgroundColor: theme.background,
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
