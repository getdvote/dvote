import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '../components/Text';
import { Group, PageHeader, PillButton, Row, Screen, SoonTag } from '../components/ui';
import { confirmDeleteAccount, confirmLogout } from '../lib/account';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';

/**
 * Settings design. Language and notifications need backend support (where to store the
 * preference, push notifications), so they are shown as "Soon".
 */
export default function Settings() {
  const { signOut } = useSession();
  return (
    <Screen>
      <PageHeader title="Settings" />
      <View style={styles.content}>
        <Group>
          <Row label="Language" value="English" disabled right={<SoonTag />} />
          <Row label="Enable notifications" disabled right={<Switch value={false} disabled />} />
        </Group>
        <Text style={styles.note}>Arabic and point notifications are coming soon.</Text>
        <View style={styles.actions}>
          <PillButton title="Logout" color={theme.danger} onPress={() => confirmLogout(signOut)} />
          <PillButton title="Delete account" color={theme.danger} onPress={confirmDeleteAccount} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, gap: 10 },
  note: { fontSize: 13, color: theme.muted, marginLeft: 4 },
  actions: { gap: 12, marginTop: 20 },
});
