import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import { StyleSheet, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';
import { PageHeader, Screen } from '../components/ui';
import { useI18n } from '../i18n';
import { theme } from '../lib/theme';

/**
 * Notifications (bell on My cards). Empty state only: there are no notifications in the API
 * yet (push notifications are planned for later).
 */
export default function Notifications() {
  const { t } = useI18n();
  return (
    <Screen>
      <PageHeader title={t('notifications.title')} />
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Icon icon={Notification01Icon} size={34} color={theme.text} />
        </View>
        <Text style={styles.heading}>{t('notifications.emptyTitle')}</Text>
        <Text style={styles.text}>{t('notifications.emptyText')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, paddingBottom: 80 },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 21, fontWeight: '700', color: theme.text, textAlign: 'center' },
  text: { fontSize: 15, color: theme.secondary, textAlign: 'center', lineHeight: 21 },
});
