import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n, type TKey } from '../i18n';
import { api, ApiError, type FeedbackCategory } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';
import { Text, TextInput } from './Text';
import { ErrorBox, PrimaryButton } from './ui';

const CATEGORIES: { id: FeedbackCategory; label: TKey }[] = [
  { id: 'bug', label: 'feedback.bug' },
  { id: 'suggestion', label: 'feedback.suggestion' },
  { id: 'points_rewards', label: 'feedback.pointsRewards' },
  { id: 'account', label: 'feedback.accountTopic' },
  { id: 'other', label: 'feedback.otherTopic' },
];
const MAX_LENGTH = 2000; // same limit as the API
const OPEN_MS = 280;
const CLOSE_MS = 220;

/** "Send feedback" bottom sheet (You → More): pick a category, write, send. */
export function FeedbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { handleAuthError } = useSession();
  const { t, rtl } = useI18n();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /**
   * The backdrop fades in place while only the sheet slides, so the Modal itself doesn't
   * animate (its built-in "slide" would move the dark backdrop up with the sheet). The
   * Modal stays mounted until the closing animation has finished.
   */
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(600);
  const progress = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = open

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
        // Start fresh next time.
        setCategory(null);
        setMessage('');
        setError(null);
        setSent(false);
      });
    }
  }, [visible, progress]);

  const canSend = !!category && message.trim().length > 0 && !busy;

  function close() {
    if (busy) return;
    onClose();
  }

  async function send() {
    if (!category) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendFeedback({ category, message: message.trim() });
      setSent(true);
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('feedback.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={styles.fill} onPress={close} accessibilityLabel={t('feedback.closeA11y')} />
      </Animated.View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, direction: rtl ? 'rtl' : 'ltr' },
            {
              transform: [
                {
                  translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />
          {sent ? (
            <View style={styles.done}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={30} color={theme.onPrimary} />
              </View>
              <Text style={styles.title}>{t('feedback.thanks')}</Text>
              <Text style={styles.subtitle}>{t('feedback.thanksText')}</Text>
              <View style={styles.fullWidth}>
                <PrimaryButton title={t('common.done')} onPress={close} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t('feedback.title')}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  onPress={close}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>
              <Text style={styles.subtitle}>{t('feedback.subtitle')}</Text>

              <Text style={styles.label}>{t('feedback.category')}</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {CATEGORIES.map((c) => {
                  const selected = category === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setCategory(c.id)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(c.label)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>{t('feedback.yours')}</Text>
              <TextInput
                value={message}
                onChangeText={(v) => {
                  setMessage(v);
                  setError(null);
                }}
                placeholder={t('feedback.placeholder')}
                placeholderTextColor={theme.placeholder}
                multiline
                maxLength={MAX_LENGTH}
                textAlignVertical="top"
                style={styles.input}
                accessibilityLabel={t('feedback.yours')}
              />
              <Text style={styles.counter}>
                {message.length}/{MAX_LENGTH}
              </Text>

              <ErrorBox message={error} />
              <PrimaryButton title={t('feedback.send')} onPress={() => void send()} loading={busy} disabled={!canSend} />
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  fill: { flex: 1 },
  sheet: {
    backgroundColor: theme.background,
    borderTopLeftRadius: theme.radius,
    borderTopRightRadius: theme.radius,
    paddingHorizontal: theme.gutter,
    paddingTop: 8,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.placeholder,
    marginBottom: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 15, color: theme.muted, marginTop: -4 },
  // Same size as the round back button in PageHeader; hitSlop makes the tap area ~60 pt.
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15, fontWeight: '600', color: theme.text, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // 44 pt tall: Apple's minimum comfortable tap size.
  chip: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: theme.primary },
  // Same weight in both states, so selecting a pill doesn't widen it and shift the others.
  chipText: { fontSize: 17, fontWeight: '500', color: theme.text },
  chipTextSelected: { color: theme.onPrimary },
  input: {
    minHeight: 130,
    maxHeight: 220,
    borderRadius: 18,
    backgroundColor: theme.surface,
    padding: 14,
    fontSize: 17,
    color: theme.text,
  },
  counter: { fontSize: 13, color: theme.muted, textAlign: 'right', marginTop: -4 },
  done: { alignItems: 'center', gap: 10, paddingTop: 16 },
  doneIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  fullWidth: { alignSelf: 'stretch', marginTop: 14 },
});
