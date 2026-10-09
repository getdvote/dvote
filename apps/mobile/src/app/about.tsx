import GiftIcon from '@hugeicons/core-free-icons/GiftIcon';
import LockIcon from '@hugeicons/core-free-icons/LockIcon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import SecurityCheckIcon from '@hugeicons/core-free-icons/SecurityCheckIcon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import Wallet01Icon from '@hugeicons/core-free-icons/Wallet01Icon';
import { Icon, type AppIcon } from '../components/Icon';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { DvoteLogo } from '../components/DvoteLogo';
import { Group, PageHeader, Row, Screen } from '../components/ui';
import { useI18n, type TKey } from '../i18n';
import { theme, squircle } from '../lib/theme';


const STEPS: { icon: AppIcon; title: TKey; text: TKey }[] = [
  { icon: QrCodeIcon, title: 'about.step1Title', text: 'about.step1Text' },
  { icon: SparklesIcon, title: 'about.step2Title', text: 'about.step2Text' },
  { icon: GiftIcon, title: 'about.step3Title', text: 'about.step3Text' },
];

const PROMISES: { icon: AppIcon; text: TKey }[] = [
  { icon: Wallet01Icon, text: 'about.promise1' },
  { icon: LockIcon, text: 'about.promise2' },
  { icon: SecurityCheckIcon, text: 'about.promise3' },
];

/** About Dvote: brand, how it works, what we promise, version. */
export default function About() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const { t } = useI18n();
  return (
    <Screen>
      <PageHeader title={t('about.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <DvoteLogo height={64} color={theme.brand} />
          <Text style={styles.tagline}>{t('about.tagline')}</Text>
          <Text style={styles.lead}>{t('about.lead')}</Text>
        </View>

        <Text style={styles.section}>{t('about.how')}</Text>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <View style={styles.stepIcon}>
                <Icon icon={s.icon} size={22} color={theme.brand} />
                <Text style={styles.stepNumber}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{t(s.title)}</Text>
                <Text style={styles.stepText}>{t(s.text)}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.section}>{t('about.promise')}</Text>
        <Group style={styles.promises}>
          {PROMISES.map((p) => (
            <View key={p.text} style={styles.promise}>
              <Icon icon={p.icon} size={20} color={theme.brand} />
              <Text style={styles.promiseText}>{t(p.text)}</Text>
            </View>
          ))}
        </Group>

        <Group style={{ marginTop: 24 }}>
          <Row label={t('about.terms')} onPress={() => router.push('/terms')} />
          <Row label={t('about.join')} onPress={() => router.push('/info/join')} />
        </Group>

        <Text style={styles.footer}>
          {t('about.version', { version })}
          {'\n'}
          {t('about.madeWith')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 8 },
  tagline: { fontSize: 24, fontWeight: '700', color: theme.text, marginTop: 8 },
  lead: { fontSize: 16, color: theme.secondary, textAlign: 'center', lineHeight: 23 },
  section: { fontSize: 15, fontWeight: '600', color: theme.muted, marginTop: 28, marginBottom: 10, marginLeft: 2 },
  steps: { gap: 10 },
  step: {
    ...squircle,
    flexDirection: 'row',
    gap: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 16,
    alignItems: 'center',
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFEDFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: theme.brand,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepTitle: { fontSize: 17, fontWeight: '600', color: theme.text },
  stepText: { fontSize: 14, color: theme.secondary, marginTop: 2, lineHeight: 20 },
  promises: { paddingVertical: 6 },
  promise: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10 },
  promiseText: { flex: 1, fontSize: 15, color: theme.text, lineHeight: 21 },
  footer: { textAlign: 'center', color: theme.muted, fontSize: 13, marginTop: 28, lineHeight: 19 },
});
