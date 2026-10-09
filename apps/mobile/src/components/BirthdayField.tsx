import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import CancelCircleIcon from '@hugeicons/core-free-icons/CancelCircleIcon';
import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useI18n } from '../i18n';
import { showYmd } from '../lib/dates';
import { squircle, theme } from '../lib/theme';
import { BirthdayPicker } from './BirthdayPicker';

/**
 * Birthday field: "Birthday" label above a white pill (same look as the text fields) showing the
 * date or "Choose date"; it opens the app's calendar sheet. The ✕ inside clears the date.
 */
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
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('birthday.label')}</Text>
      <View style={styles.pill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? t('birthday.changeA11y', { date: showYmd(value) }) : t('birthday.chooseA11y')}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.open, pressed && { opacity: 0.6 }]}
        >
          <Icon icon={Calendar03Icon} size={20} color={value ? theme.text : theme.placeholder} />
          <Text style={value ? styles.value : styles.placeholder}>{value ? showYmd(value) : t('birthday.choose')}</Text>
        </Pressable>
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('birthday.removeA11y')} onPress={() => onChange(null)} hitSlop={10}>
            <Icon icon={CancelCircleIcon} size={20} color={theme.placeholder} />
          </Pressable>
        ) : null}
      </View>
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

// Matches Field in components/ui (label, then a 52 pt white pill).
const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: theme.text },
  pill: {
    ...squircle,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  open: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { fontSize: 17, color: theme.text },
  placeholder: { fontSize: 17, color: theme.placeholder },
});
