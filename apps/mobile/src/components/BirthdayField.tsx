import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showYmd } from '../lib/dates';
import { theme } from '../lib/theme';
import { BirthdayPicker } from './BirthdayPicker';

/** Birthday row: shows the date (or "Choose date") and opens the app's calendar sheet. */
export function BirthdayField({
  value,
  onChange,
}: {
  /** "YYYY-MM-DD" or null */
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Birthday</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `Birthday ${showYmd(value)}, change` : 'Choose your birthday'}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="calendar-outline" size={17} color={value ? theme.text : theme.link} />
        <Text style={value ? styles.value : styles.add}>{value ? showYmd(value) : 'Choose date'}</Text>
      </Pressable>
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Remove birthday" onPress={() => onChange(null)} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={theme.placeholder} />
        </Pressable>
      ) : null}
      <BirthdayPicker
        visible={open}
        value={value}
        onCancel={() => setOpen(false)}
        onDone={(v) => {
          setOpen(false);
          onChange(v);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: theme.rowHeight, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flex: 1, fontSize: 17, color: theme.text },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 34,
  },
  value: { fontSize: 16, color: theme.text, fontWeight: '500' },
  add: { fontSize: 16, color: theme.link, fontWeight: '500' },
});
