import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError, type FeedbackCategory } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';
import { ErrorBox, PrimaryButton } from './ui';

const CATEGORIES: { id: FeedbackCategory; label: string }[] = [
  { id: 'bug', label: 'Bug' },
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'points_rewards', label: 'Points & rewards' },
  { id: 'account', label: 'Account' },
  { id: 'other', label: 'Other' },
];
const MAX_LENGTH = 2000; // same limit as the API

/** "Send feedback" bottom sheet (You → More): pick a category, write, send. */
export function FeedbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { handleAuthError } = useSession();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = !!category && message.trim().length > 0 && !busy;

  function close() {
    if (busy) return;
    onClose();
    // Start fresh next time, once the sheet has slid away.
    setTimeout(() => {
      setCategory(null);
      setMessage('');
      setError(null);
      setSent(false);
    }, 300);
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
      setError(err instanceof ApiError ? err.message : 'Could not send your feedback. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close feedback" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          {sent ? (
            <View style={styles.done}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={30} color={theme.onPrimary} />
              </View>
              <Text style={styles.title}>Thanks for your feedback</Text>
              <Text style={styles.subtitle}>We read every message to make dvote better.</Text>
              <View style={styles.fullWidth}>
                <PrimaryButton title="Done" onPress={close} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Send feedback</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={close}
                  hitSlop={10}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={18} color={theme.text} />
                </Pressable>
              </View>
              <Text style={styles.subtitle}>Tell us what's working and what isn't.</Text>

              <Text style={styles.label}>Category</Text>
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
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Your feedback</Text>
              <TextInput
                value={message}
                onChangeText={(v) => {
                  setMessage(v);
                  setError(null);
                }}
                placeholder="What happened, or what would you like to see?"
                placeholderTextColor={theme.placeholder}
                multiline
                maxLength={MAX_LENGTH}
                textAlignVertical="top"
                style={styles.input}
                accessibilityLabel="Your feedback"
              />
              <Text style={styles.counter}>
                {message.length}/{MAX_LENGTH}
              </Text>

              <ErrorBox message={error} />
              <PrimaryButton title="Send" onPress={() => void send()} loading={busy} disabled={!canSend} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
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
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600', color: theme.text, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: theme.primary },
  chipText: { fontSize: 15, color: theme.text },
  chipTextSelected: { color: theme.onPrimary, fontWeight: '600' },
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
