import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { api } from './api';

/** ready = the server has my current position; denied = location not allowed; unavailable = no fix / offline. */
export type LocationStatus = 'ready' | 'denied' | 'unavailable';

/** A position sent this recently is still good (re-sent when the app comes back after longer). */
const FRESH_MS = 10 * 60 * 1000;

let lastSent = 0;
let inflight: Promise<LocationStatus> | null = null;

/**
 * Sends the phone's current position to the API (PUT /users/me/location), for the shops near
 * me. Called when a customer's session starts and when the app comes back to the foreground.
 * `ask`: show the permission prompt if it wasn't answered yet (never re-asks after "Don't
 * allow": the phone doesn't let us; `openLocationSettings` does). Only the foreground position
 * is used; nothing runs in the background.
 */
export function refreshMyLocation({ ask = false, force = false }: { ask?: boolean; force?: boolean } = {}): Promise<LocationStatus> {
  if (inflight) return inflight;
  if (!force && Date.now() - lastSent < FRESH_MS) return Promise.resolve('ready');
  inflight = (async (): Promise<LocationStatus> => {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return 'denied';
    // A quick last-known fix first (instant), else a fresh one (city-block accuracy is plenty).
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: FRESH_MS }).catch(() => null)) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    await api.setLocation(pos.coords.latitude, pos.coords.longitude);
    lastSent = Date.now();
    return 'ready';
  })()
    .catch((): LocationStatus => 'unavailable')
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** "Turn on location": ask again if the phone still allows it, otherwise open the app's settings. */
export async function turnOnLocation(): Promise<LocationStatus> {
  const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (perm && !perm.granted && !perm.canAskAgain) {
    await Linking.openSettings().catch(() => undefined);
    return 'denied';
  }
  return refreshMyLocation({ ask: true, force: true });
}

/** Forget the last send (sign-out), so the next customer's position is sent fresh. */
export function resetLocation() {
  lastSent = 0;
}
