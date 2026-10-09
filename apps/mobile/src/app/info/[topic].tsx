import CustomerService02Icon from '@hugeicons/core-free-icons/CustomerService02Icon';
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon';
import { Icon, type AppIcon } from '../../components/Icon';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { PageHeader, Screen } from '../../components/ui';
import { useI18n, type TKey } from '../../i18n';
import { theme } from '../../lib/theme';


/**
 * "More" menu pages that still need content or a backend (help centre, vendor sign-up).
 * One placeholder screen so the menu is complete. Terms and conditions is its own page
 * (app/terms.tsx, a web page); Send feedback is a bottom sheet (components/FeedbackSheet).
 */
const TOPICS: Record<string, { title: TKey; icon: AppIcon; heading: TKey; text: TKey }> = {
  help: { title: 'info.helpTitle', icon: CustomerService02Icon, heading: 'info.helpHeading', text: 'info.helpText' },
  join: { title: 'info.joinTitle', icon: Store01Icon, heading: 'info.joinHeading', text: 'info.joinText' },
};

export default function InfoTopic() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const info = TOPICS[topic ?? ''] ?? TOPICS.help;
  const { t } = useI18n();
  return (
    <Screen>
      <PageHeader title={t(info.title)} />
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Icon icon={info.icon} size={34} color={theme.text} />
        </View>
        <Text style={styles.heading}>{t(info.heading)}</Text>
        <Text style={styles.text}>{t(info.text)}</Text>
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
