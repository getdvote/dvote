import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import Logout03Icon from '@hugeicons/core-free-icons/Logout03Icon';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { Text } from '../components/Text';
import { PageHeader, PillButton, PrimaryButton, Screen, SoonTag } from '../components/ui';
import { LANGUAGES, useI18n } from '../i18n';
import { logOut } from '../lib/account';
import { useSession } from '../lib/session';
import { squircle, theme } from '../lib/theme';

/**
 * Settings, laid out like Profile details (a label above each control): app language
 * (English / العربية, saved on this phone; English by default), notifications (needs push
 * notifications, so off for now), then Logout and Delete account, each confirmed in a sheet.
 * Deleting isn't built yet (no backend), so its confirm button is disabled and marked Soon.
 */
export default function Settings() {
  const { signOut } = useSession();
  const { t, language, setLanguage } = useI18n();
  const [asking, setAsking] = useState<'logout' | 'delete' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const close = () => setAsking(null);

  return (
    <Screen>
      <PageHeader title={t('settings.title')} />
      <View style={styles.content}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('settings.language')}</Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {LANGUAGES.map((l) => {
              const on = language === l.code;
              return (
                <Pressable
                  key={l.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLanguage={l.code}
                  onPress={() => void setLanguage(l.code)}
                  style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && { opacity: 0.8 }]}
                >
                  {/* each language's name in its own font, whatever the app language */}
                  <Text
                    style={[
                      styles.choiceText,
                      on && styles.choiceTextOn,
                      { fontFamily: l.code === 'ar' ? 'IBMPlexSansArabic_500Medium' : 'Inter_500Medium' },
                    ]}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('settings.notificationsTitle')}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t('settings.notifications')}</Text>
            {/* wrapped: Switch measures its own height oddly, so the box does the centring */}
            <View style={styles.switchBox}>
              <Switch value={false} disabled />
            </View>
          </View>
          <Text style={styles.note}>{t('settings.note')}</Text>
        </View>

        <View style={styles.actions}>
          <PillButton title={t('settings.logout')} color={theme.danger} onPress={() => setAsking('logout')} />
          <PillButton title={t('settings.deleteAccount')} color={theme.danger} onPress={() => setAsking('delete')} />
        </View>
      </View>

      <ConfirmSheet
        visible={asking === 'logout'}
        onClose={close}
        icon={Logout03Icon}
        title={t('settings.logoutTitle')}
        text={t('settings.logoutText')}
      >
        <PrimaryButton
          title={t('settings.logoutAction')}
          loading={leaving}
          style={styles.danger}
          onPress={() => {
            setLeaving(true);
            void logOut(signOut);
          }}
        />
      </ConfirmSheet>

      <ConfirmSheet
        visible={asking === 'delete'}
        onClose={close}
        icon={Delete02Icon}
        title={t('settings.deleteTitle')}
        text={t('settings.deleteText')}
      >
        {/* No backend for deleting (and restoring within 90 days) yet. */}
        <PillButton title={t('settings.deleteAction')} color={theme.danger} badge={<SoonTag />} disabled onPress={() => undefined} />
      </ConfirmSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, gap: 18 },
  field: { gap: 8 },
  // same as the field labels on Profile details
  label: { fontSize: 15, fontWeight: '600', color: theme.text },
  // Two equal pills, the chosen one black, like Gender on Profile details.
  choices: { flexDirection: 'row', gap: 10 },
  choice: {
    ...squircle,
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: theme.primary },
  choiceText: { fontSize: 17, color: theme.text },
  choiceTextOn: { color: theme.onPrimary },
  pill: {
    ...squircle,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: 18,
    paddingEnd: 12,
  },
  pillText: { fontSize: 17, color: theme.muted },
  switchBox: { height: '100%', justifyContent: 'center' },
  note: { fontSize: 13, color: theme.muted, marginHorizontal: 4 },
  actions: { gap: 12, marginTop: 8 },
  danger: { backgroundColor: theme.danger },
});
