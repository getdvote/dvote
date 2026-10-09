import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { config } from './config';
import { supabase } from './supabase';

/**
 * Live updates. The app keeps one WebSocket to the API (/api/app/live) while signed in. When a
 * vendor or admin saves something in the dashboards (logo, banner, card design, rule, rewards,
 * branches, menu…) the API sends {type:"vendor", vendorId}; when staff add points it sends
 * {type:"cards"} to that customer only. Notices carry no data: screens simply re-read what
 * they show through the normal API, at once, without the customer pulling to refresh.
 */
export type LiveEvent = { type: 'vendor'; vendorId: string | null } | { type: 'cards' };

/** Backup refresh while a screen is visible, in case the live connection is down. */
export const LIVE_REFRESH_MS = 60_000;

const listeners = new Set<(e: LiveEvent) => void>();

/**
 * Opens the live connection and keeps it open (reconnects after errors, network changes and
 * when the app comes back to the foreground) until the returned stop function is called.
 * Started by SessionProvider while a customer is signed in.
 */
export function startLive(): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  const url = `${config.apiUrl.replace(/^http/, 'ws')}/api/app/live`;

  const scheduleReconnect = () => {
    if (stopped) return;
    clearTimeout(retry);
    const delay = Math.min(30_000, 1000 * 2 ** attempt); // 1 s, 2 s, 4 s … 30 s
    attempt += 1;
    retry = setTimeout(() => void open(), delay);
  };

  const open = async () => {
    if (stopped || (socket && socket.readyState <= WebSocket.OPEN)) return;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token || stopped) return;
    const ws = new WebSocket(url);
    socket = ws;
    // The token goes in the first message, never in the URL.
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (msg) => {
      let event: { type?: string };
      try {
        event = JSON.parse(String(msg.data)) as { type?: string };
      } catch {
        return;
      }
      if (event.type === 'ready') attempt = 0;
      else if (event.type === 'vendor' || event.type === 'cards') for (const l of listeners) l(event as LiveEvent);
    };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  };

  // Phones drop sockets in the background: reconnect as soon as the app is back.
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      attempt = 0;
      void open();
    }
  });
  void open();

  return () => {
    stopped = true;
    clearTimeout(retry);
    sub.remove();
    socket?.close();
    socket = null;
  };
}

/**
 * Keeps a screen's data fresh while it is on screen: loads when shown, reloads at once when a
 * live notice concerns it, again every LIVE_REFRESH_MS as a backup, and when the app comes back
 * to the foreground. Pass `vendorId` on a single shop's screens so changes to other shops are
 * ignored. Stops when the screen is left.
 */
export function useLiveRefresh(refresh: () => unknown, options: { vendorId?: string | null; everyMs?: number } = {}) {
  const { vendorId = null, everyMs = LIVE_REFRESH_MS } = options;
  // Always call the newest refresh without restarting the subscriptions when it changes.
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      const run = () => void latest.current();
      run();

      // A burst of saves (or many phones at once) shouldn't hammer the API: wait a moment,
      // with a little random spread, then refresh once.
      let pending: ReturnType<typeof setTimeout> | undefined;
      const soon = () => {
        clearTimeout(pending);
        pending = setTimeout(run, 250 + Math.random() * 500);
      };
      const onLive = (e: LiveEvent) => {
        if (e.type === 'vendor' && vendorId && e.vendorId && e.vendorId !== vendorId) return; // another shop
        soon();
      };
      listeners.add(onLive);

      const timer = setInterval(() => {
        if (AppState.currentState === 'active') run();
      }, everyMs);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') run();
      });
      return () => {
        listeners.delete(onLive);
        clearTimeout(pending);
        clearInterval(timer);
        sub.remove();
      };
    }, [everyMs, vendorId]),
  );
}
