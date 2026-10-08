import { Alert } from 'react-native';

/** Asks before signing out. */
export function confirmLogout(signOut: () => Promise<void>) {
  Alert.alert('Log out?', 'You can log back in any time with the same account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
  ]);
}

/**
 * Account deletion. The backend endpoint (DELETE /api/app/users/me) doesn't exist yet,
 * so after the warning we say so instead of pretending.
 */
export function confirmDeleteAccount() {
  Alert.alert(
    'Delete your account?',
    'This permanently removes your dvote account and all your points at every shop. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Not available yet',
            'Deleting accounts from the app is coming soon. Your account has not been changed.',
          ),
      },
    ],
  );
}
