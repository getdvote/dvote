import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import CustomerService02Icon from '@hugeicons/core-free-icons/CustomerService02Icon';
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon';
import { Icon, type AppIcon } from '../../components/Icon';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { PageHeader, Screen } from '../../components/ui';
import { theme } from '../../lib/theme';


/**
 * "More" menu pages that still need content or a backend (help centre, terms text,
 * vendor sign-up). One placeholder screen so the menu is complete. Send feedback is a
 * bottom sheet (components/FeedbackSheet).
 */
const TOPICS: Record<string, { title: string; icon: AppIcon; heading: string; text: string }> = {
  help: {
    title: 'Get help',
    icon: CustomerService02Icon,
    heading: 'Help is on the way',
    text: 'Answers to common questions and a way to reach our team are coming soon. For points that did not appear, ask the shop staff to check their scan.',
  },
  terms: {
    title: 'Terms and conditions',
    icon: File01Icon,
    heading: 'Terms and conditions',
    text: 'The full terms and privacy policy will be published here before launch.',
  },
  join: {
    title: 'Join as a vendor',
    icon: Store01Icon,
    heading: 'Bring dvote to your coffee shop',
    text: 'Reward your regulars with points and free treats. Vendor sign-up is coming soon to the app.',
  },
};

export default function InfoTopic() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const info = TOPICS[topic ?? ''] ?? TOPICS.help;
  return (
    <Screen>
      <PageHeader title={info.title} />
      <View style={styles.middle}>
        <View style={styles.icon}>
          <Icon icon={info.icon} size={34} color={theme.text} />
        </View>
        <Text style={styles.heading}>{info.heading}</Text>
        <Text style={styles.text}>{info.text}</Text>
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
