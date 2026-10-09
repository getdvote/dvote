import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** How often a visible screen re-reads its data (shop edits from the dashboards show up within this). */
export const LIVE_REFRESH_MS = 20_000;

/**
 * Keeps a screen's data fresh while it is on screen: loads when the screen is shown, again every
 * LIVE_REFRESH_MS while it stays visible and the app is in the foreground, and right away when
 * the app comes back to the foreground. So a new logo, reward, photo, branch or rule saved in the
 * vendor or admin dashboard appears without pulling to refresh. Stops when the screen is left.
 */
export function useLiveRefresh(refresh: () => unknown, everyMs = LIVE_REFRESH_MS) {
  // Always call the newest refresh without restarting the timer when it changes.
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      const run = () => void latest.current();
      run();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') run();
      }, everyMs);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') run();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [everyMs]),
  );
}
