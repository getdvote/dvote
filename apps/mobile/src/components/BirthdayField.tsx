import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import CancelCircleIcon from '@hugeicons/core-free-icons/CancelCircleIcon';
import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t('birthday.label')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? t('birthday.changeA11y', { date: showYmd(value) }) : t('birthday.chooseA11y')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
      >
        <Icon icon={Calendar03Icon} size={17} color={value ? theme.text : theme.link} />
        <Text style={value ? styles.value : styles.add}>{value ? showYmd(value) : t('birthday.choose')}</Text>
      </Pressable>
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('birthday.removeA11y')} onPress={() => onChange(null)} hitSlop={8}>
          <Icon icon={CancelCircleIcon} size={20} color={theme.placeholder} />
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
