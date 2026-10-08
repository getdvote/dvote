import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../components/Text';
import { Group, PageHeader, PillButton, Row, Screen } from '../components/ui';
import { LANGUAGES, useI18n } from '../i18n';
import { confirmDeleteAccount, confirmLogout } from '../lib/account';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/**
 * Settings: app language (English / العربية, saved on this phone; English by default),
 * notifications (needs push notifications, so off for now), logout, delete account.
 */
export default function Settings() {
  const { signOut } = useSession();
  const { t, language, setLanguage } = useI18n();
  return (
    <Screen>
      <PageHeader title={t('settings.title')} />
      <View style={styles.content}>
        <Group>
          <View style={styles.languageRow}>
            <Text style={styles.label}>{t('settings.language')}</Text>
            <View style={styles.segments} accessibilityRole="radiogroup">
              {LANGUAGES.map((l) => {
                const on = language === l.code;
                return (
                  <Pressable
                    key={l.code}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLanguage={l.code}
                    onPress={() => void setLanguage(l.code)}
                    style={[styles.segment, on && styles.segmentOn]}
                  >
                    {/* each language's name in its own font, whatever the app language */}
                    <Text
                      style={[
                        styles.segmentText,
                        on && styles.segmentTextOn,
                        { fontFamily: l.code === 'ar' ? 'IBMPlexSansArabic_600SemiBold' : 'Inter_600SemiBold' },
                      ]}
                    >
                      {l.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Row label={t('settings.notifications')} disabled right={<Switch value={false} disabled />} />
        </Group>
        <Text style={styles.note}>{t('settings.note')}</Text>
        <View style={styles.actions}>
          <PillButton title={t('settings.logout')} color={theme.danger} onPress={() => confirmLogout(signOut)} />
          <PillButton title={t('settings.deleteAccount')} color={theme.danger} onPress={confirmDeleteAccount} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, gap: 10 },
  languageRow: { minHeight: theme.rowHeight, flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1, fontSize: 17, color: theme.text },
  segments: { flexDirection: 'row', backgroundColor: theme.fill, borderRadius: 18, padding: 3 },
  segment: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center' },
  segmentOn: { backgroundColor: theme.surface },
  segmentText: { fontSize: 15, color: theme.muted },
  segmentTextOn: { color: theme.text },
  note: { fontSize: 13, color: theme.muted, marginStart: 4 },
  actions: { gap: 12, marginTop: 20 },
});
