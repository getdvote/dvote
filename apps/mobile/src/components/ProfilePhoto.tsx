import Camera01Icon from '@hugeicons/core-free-icons/Camera01Icon';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { api, ApiError } from '../lib/api';
import { useSession } from '../lib/session';
import { theme } from '../lib/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { Avatar, ErrorBox } from './ui';

const SIZE = 104;

/**
 * Profile photo on Profile details: tap to pick a new one from the phone (square crop),
 * or remove it. Saved immediately (PUT / DELETE /api/app/users/me/avatar), separate from
 * the form's "Save changes".
 */
export function ProfilePhoto() {
  const { me, setMe, handleAuthError } = useSession();
  const { t } = useI18n();
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;

  async function run(kind: 'upload' | 'remove', action: () => Promise<Awaited<ReturnType<typeof api.me>>>) {
    setBusy(kind);
    setError(null);
    try {
      setMe(await action());
    } catch (err) {
      if (await handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : t('profile.photoFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function change() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // lets the customer crop it square
      aspect: [1, 1],
      shape: 'oval',
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const photo = result.assets[0];
    await run('upload', () =>
      api.uploadAvatar({ uri: photo.uri, mimeType: photo.mimeType, fileName: photo.fileName, file: photo.file }),
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={me.avatarUrl ? t('profile.photoChangeA11y') : t('profile.photoAddA11y')}
        onPress={() => void change()}
        disabled={busy !== null}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <Avatar name={me.name} url={me.avatarUrl} size={SIZE} />
        {busy === 'upload' ? (
          <View style={styles.busy}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
        <View style={styles.badge}>
          <Icon icon={Camera01Icon} size={17} color={theme.text} />
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => void change()} disabled={busy !== null} hitSlop={8}>
          <Text style={[styles.action, busy && styles.off]}>{me.avatarUrl ? t('profile.photoChange') : t('profile.photoAdd')}</Text>
        </Pressable>
        {me.avatarUrl ? (
          <>
            <Text style={styles.dot}>·</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void run('remove', api.removeAvatar)}
              disabled={busy !== null}
              hitSlop={8}
            >
              <Text style={[styles.action, styles.remove, busy && styles.off]}>
                {busy === 'remove' ? t('profile.photoRemoving') : t('profile.photoRemove')}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <ErrorBox message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, marginBottom: 8 },
  busy: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.surface,
    borderWidth: 3,
    borderColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { fontSize: 16, fontWeight: '600', color: theme.link },
  remove: { color: theme.danger },
  dot: { color: theme.muted },
  off: { opacity: 0.4 },
});
