import { requestWidgetUpdate } from 'react-native-android-widget';
import type { Card } from '../lib/api';
import { renderPoints, renderQr } from './android-widgets';
import { pointsSnapshot, qrSnapshot, savePoints, saveQr } from './data';

/**
 * See index.ts. Android: save the snapshot (read by the widget task) and redraw placed widgets.
 * Keep this file `.ts`: Metro tries every platform variant of one extension before the next,
 * so an `index.android.tsx` would lose to `index.ts` (the web no-op) and never run.
 */
export function refreshWidgets(cards: Card[] | null): void {
  const points = pointsSnapshot(cards);
  const qr = qrSnapshot();
  void savePoints(points);
  void saveQr(qr);
  // Rejects in Expo Go (no native module): the app works the same without widgets.
  requestWidgetUpdate({ widgetName: 'DvotePoints', renderWidget: () => renderPoints(points) }).catch(() => undefined);
  requestWidgetUpdate({ widgetName: 'DvoteQr', renderWidget: () => renderQr(qr) }).catch(() => undefined);
}
