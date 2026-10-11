import { requestWidgetUpdate } from 'react-native-android-widget';
import type { Card } from '../lib/api';
import { PointsWidgetView, QrWidgetView } from './android-widgets';
import { pointsSnapshot, qrSnapshot, savePoints, saveQr } from './data';

/** See index.ts. Android: save the snapshot (read by the widget task) and redraw placed widgets. */
export function refreshWidgets(cards: Card[] | null): void {
  const points = pointsSnapshot(cards);
  const qr = qrSnapshot();
  void savePoints(points);
  void saveQr(qr);
  // Rejects in Expo Go (no native module): the app works the same without widgets.
  requestWidgetUpdate({ widgetName: 'DvotePoints', renderWidget: () => <PointsWidgetView snapshot={points} /> }).catch(() => undefined);
  requestWidgetUpdate({ widgetName: 'DvoteQr', renderWidget: () => <QrWidgetView snapshot={qr} /> }).catch(() => undefined);
}
