import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DvoteLogo } from '../../components/DvoteLogo';
import { Avatar, ErrorBox, Group, Row, Screen, SectionTitle } from '../../components/ui';
import { confirmDeleteAccount, confirmLogout } from '../../lib/account';
import { useSession } from '../../lib/session';
import { TAB_BAR_SPACE, theme } from '../../lib/theme';

/** "You": profile header + Account / More menus (side-menu design), ⋮ menu (three-dots). */
export default function You() {
  const { me, meError, session, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const name = me?.name ?? 'dvote member';
  const email = me?.email ?? session?.user.email ?? null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>You</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            onPress={() => setMenuOpen(true)}
            style={styles.dots}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.profile}>
          <Avatar name={me?.name ?? null} url={me?.avatarUrl ?? null} size={84} />
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>
        <ErrorBox message={meError} />

        <SectionTitle title="Account" />
        <Group>
          <Row icon="card-outline" label="All cards" onPress={() => router.navigate('/(tabs)/cards')} />
          <Row icon="person-circle-outline" label="Profile details" onPress={() => router.push('/profile-details')} />
          <Row icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </Group>

        <SectionTitle title="More" />
        <Group>
          <Row icon="chatbubble-ellipses-outline" label="Send feedback" onPress={() => router.push('/info/feedback')} />
          <Row icon="help-buoy-outline" label="Get help" onPress={() => router.push('/info/help')} />
          <Row icon="document-text-outline" label="Terms and conditions" onPress={() => router.push('/info/terms')} />
          <Row icon="information-circle-outline" label="About Dvote" onPress={() => router.push('/about')} />
          <Row icon="storefront-outline" label="Join as a vendor" onPress={() => router.push('/info/join')} />
        </Group>

        <View style={styles.footer}>
          <DvoteLogo height={34} color="#C7C7CC" />
        </View>
      </ScrollView>

      {/* three-dots design: a small card with Logout / Delete account */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
          <View style={[styles.menu, { top: insets.top + 6 }]}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
              onPress={() => {
                setMenuOpen(false);
                confirmLogout(signOut);
              }}
            >
              <Text style={styles.menuText}>Logout</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.7 }]}
              onPress={() => {
                setMenuOpen(false);
                confirmDeleteAccount();
              }}
            >
              <Text style={styles.menuText}>Delete account</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: theme.gutter, paddingBottom: TAB_BAR_SPACE },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  title: { fontSize: 34, fontWeight: '700', color: theme.text },
  dots: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profile: { alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 8 },
  name: { fontSize: 26, fontWeight: '700', color: theme.text, marginTop: 10 },
  email: { fontSize: 16, color: theme.muted },
  footer: { alignItems: 'center', marginTop: 40 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  menu: {
    position: 'absolute',
    right: theme.gutter,
    width: 290,
    backgroundColor: theme.surface,
    borderRadius: 26,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { fontSize: 17, fontWeight: '500', color: theme.danger },
});
