import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

/**
 * A yes/no question. React Native's Alert has no buttons on the web (it does nothing there),
 * so the browser preview uses the browser's own confirm box.
 */
function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function notice(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/**
 * Asks before signing out, then closes every open screen (Settings sits on top of the tabs)
 * and shows the welcome screen.
 */
export function confirmLogout(signOut: () => Promise<void>) {
  confirm('Log out?', 'You can log back in any time with the same account.', 'Log out', () => {
    void (async () => {
      await signOut();
      if (router.canDismiss()) router.dismissAll();
      router.replace('/welcome');
    })();
  });
}

/**
 * Account deletion. The backend endpoint (DELETE /api/app/users/me) doesn't exist yet,
 * so after the warning we say so instead of pretending.
 */
export function confirmDeleteAccount() {
  confirm(
    'Delete your account?',
    'This permanently removes your dvote account and all your points at every shop. It cannot be undone.',
    'Delete',
    () =>
      notice(
        'Not available yet',
        'Deleting accounts from the app is coming soon. Your account has not been changed.',
      ),
  );
}
