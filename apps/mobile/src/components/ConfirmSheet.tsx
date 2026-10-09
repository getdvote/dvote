import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { theme } from '../lib/theme';
import { BottomSheet } from './BottomSheet';
import { Icon, type AppIcon } from './Icon';
import { Text } from './Text';
import { PillButton } from './ui';

/**
 * A yes/no question in the app's own bottom sheet (instead of the system alert): an icon in a
 * soft red circle, a title, a short explanation, the action button(s) and Cancel. `children`
 * is the action, e.g. a red PrimaryButton, or a disabled button with a Soon tag.
 */
export function ConfirmSheet({
  visible,
  onClose,
  icon,
  title,
  text,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  icon: AppIcon;
  title: string;
  text: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Icon icon={icon} size={28} color={theme.danger} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.buttons}>
          {children}
          <PillButton title={t('common.cancel')} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: theme.gutter, alignItems: 'center', gap: 10 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center' },
  text: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  buttons: { alignSelf: 'stretch', gap: 12, marginTop: 14 },
});
