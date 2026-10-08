import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import GiftCard02Icon from '@hugeicons/core-free-icons/GiftCard02Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon';
import CustomerService02Icon from '@hugeicons/core-free-icons/CustomerService02Icon';
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon';
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon';
import UserCircleIcon from '@hugeicons/core-free-icons/UserCircleIcon';
import { Icon } from '../../components/Icon';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { DvoteLogo } from '../../components/DvoteLogo';
import { FeedbackSheet } from '../../components/FeedbackSheet';
import { Avatar, ErrorBox, Group, Row, Screen, SectionTitle } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useSession } from '../../lib/session';
import { TAB_BAR_SPACE, theme } from '../../lib/theme';

/** "My profile" (route: you): profile header + Account / More menus. Logout and Delete account are in Settings. */
export default function You() {
  const { me, meError, session } = useSession();
  const { t } = useI18n();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const name = me?.name ?? t('you.member');
  const email = me?.email ?? session?.user.email ?? null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('you.title')}</Text>
        </View>

        <View style={styles.profile}>
          <Avatar name={me?.name ?? null} url={me?.avatarUrl ?? null} size={84} />
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>
        <ErrorBox message={meError} />

        <SectionTitle title={t('you.account')} />
        <Group>
          <Row icon={GiftCard02Icon} label={t('you.myCards')} onPress={() => router.push('/my-cards')} />
          <Row icon={UserCircleIcon} label={t('you.profileDetails')} onPress={() => router.push('/profile-details')} />
          <Row icon={Settings01Icon} label={t('you.settings')} onPress={() => router.push('/settings')} />
        </Group>

        <SectionTitle title={t('you.more')} />
        <Group>
          <Row icon={BubbleChatIcon} label={t('you.feedback')} onPress={() => setFeedbackOpen(true)} />
          <Row icon={CustomerService02Icon} label={t('you.help')} onPress={() => router.push('/info/help')} />
          <Row icon={File01Icon} label={t('you.terms')} onPress={() => router.push('/info/terms')} />
          <Row icon={InformationCircleIcon} label={t('you.about')} onPress={() => router.push('/about')} />
          <Row icon={Store01Icon} label={t('you.join')} onPress={() => router.push('/info/join')} />
        </Group>

        <View style={styles.footer}>
          <DvoteLogo height={34} color="#C7C7CC" />
        </View>
      </ScrollView>

      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingBottom: TAB_BAR_SPACE },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  title: { fontSize: 34, fontWeight: '700', color: theme.text },
  profile: { alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 8 },
  name: { fontSize: 26, fontWeight: '700', color: theme.text, marginTop: 10 },
  email: { fontSize: 16, color: theme.muted },
  footer: { alignItems: 'center', marginTop: 40 },
});
