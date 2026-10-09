import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * App haptics, one function per kind of tap so the feel stays consistent.
 *
 * iOS uses Apple's feedback generators. Android uses the system's own haptic constants
 * (View.performHapticFeedback): they follow the user's "touch feedback" setting and feel
 * native. Newer Android constants don't exist on older versions, so each has a fallback that
 * works everywhere. Haptics never block or break a tap: failures are ignored.
 */
export const haptics = {
  /**
   * Switching tabs in the tab bar: the light "selection" tick iOS uses for pickers and
   * segmented controls. Android: segment tick (Android 14+), clock tick before that.
   */
  tab() {
    if (Platform.OS === 'ios') return ignore(Haptics.selectionAsync());
    return android(Haptics.AndroidHaptics.Segment_Tick, Haptics.AndroidHaptics.Clock_Tick);
  },

  /**
   * The QR button: a firmer, distinct tap for the app's main action (opening the code to
   * show at the counter). iOS: medium impact. Android: confirm (Android 11+), context click
   * before that.
   */
  qr() {
    if (Platform.OS === 'ios') return ignore(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    return android(Haptics.AndroidHaptics.Confirm, Haptics.AndroidHaptics.Context_Click);
  },
};

function android(type: Haptics.AndroidHaptics, fallback: Haptics.AndroidHaptics) {
  if (Platform.OS !== 'android') return;
  Haptics.performAndroidHapticsAsync(type)
    .catch(() => Haptics.performAndroidHapticsAsync(fallback))
    .catch(() => {});
}

function ignore(p: Promise<void>) {
  p.catch(() => {});
}
