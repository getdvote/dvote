import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Card } from '../lib/api';
import { t } from '../i18n';
import { cardDesign } from '../lib/theme';

/**
 * What the home-screen widgets show, saved on the phone by the app. Widgets can't call the API
 * (no session there), so the app writes this snapshot whenever it loads the customer's cards
 * (open, resume, live "cards" notices) and clears it on sign-out.
 */
export interface WidgetShop {
  name: string;
  points: number;
  /** The shop's card colours (its loyalty-card design). */
  color: string;
  ink: string;
}

export interface PointsSnapshot {
  signedIn: boolean;
  /** Up to 3 shops, most points first. */
  shops: WidgetShop[];
  /** Texts in the app's language (widgets have no dictionary of their own). */
  labels: { title: string; empty: string; signIn: string; pts: string; updated: string };
}

export interface QrSnapshot {
  labels: { title: string; subtitle: string; badge: string };
}

/** Deep links the widgets open (Expo Router routes; scheme from app.json). */
export const LINKS = {
  cards: 'dvote://cards',
  /** Opens the QR screen, which makes a fresh master collect QR at once. */
  collectQr: 'dvote://qr',
} as const;

const KEY = 'dvote.widget.points';

export function pointsSnapshot(cards: Card[] | null): PointsSnapshot {
  const shops = (cards ?? [])
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3)
    .map((c) => {
      const d = cardDesign(c.vendor.id, c.vendor.cardDesign);
      return { name: c.vendor.name, points: c.balance, color: d.colors[0], ink: d.ink };
    });
  return {
    signedIn: cards !== null,
    shops,
    labels: {
      title: t('widgets.pointsTitle'),
      empty: t('widgets.pointsEmpty'),
      signIn: t('widgets.signIn'),
      pts: t('widgets.pts'),
      updated: t('widgets.updated', { time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }),
    },
  };
}

export const qrSnapshot = (): QrSnapshot => ({
  labels: { title: t('widgets.qrTitle'), subtitle: t('widgets.qrSubtitle'), badge: t('widgets.qrBadge') },
});

export async function savePoints(s: PointsSnapshot) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => undefined);
}

/** The last snapshot, or (never saved) the signed-out one. Read by the Android widget task. */
export async function loadPoints(): Promise<PointsSnapshot> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (raw) {
    try {
      return JSON.parse(raw) as PointsSnapshot;
    } catch {
      // fall through
    }
  }
  return pointsSnapshot(null);
}

const QR_KEY = 'dvote.widget.qr';

export async function saveQr(s: QrSnapshot) {
  await AsyncStorage.setItem(QR_KEY, JSON.stringify(s)).catch(() => undefined);
}

/** The QR widget's texts in the language the app last used (English before the first save). */
export async function loadQr(): Promise<QrSnapshot> {
  const raw = await AsyncStorage.getItem(QR_KEY).catch(() => null);
  try {
    const saved = raw ? (JSON.parse(raw) as QrSnapshot) : null;
    return saved?.labels?.badge ? saved : qrSnapshot(); // saved before the redesign: fresh texts
  } catch {
    return qrSnapshot();
  }
}
