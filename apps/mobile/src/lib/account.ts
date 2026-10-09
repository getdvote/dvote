import { router } from 'expo-router';

/**
 * Signs out, then closes every open screen (Settings sits on top of the tabs) and shows the
 * welcome screen. Settings asks first, in its own confirmation sheet.
 *
 * Deleting an account isn't here: the backend (DELETE /api/app/users/me, with a 90-day restore
 * window) doesn't exist yet, so Settings shows the confirmation with the button marked Soon.
 */
export async function logOut(signOut: () => Promise<void>) {
  await signOut();
  if (router.canDismiss()) router.dismissAll();
  router.replace('/welcome');
}
