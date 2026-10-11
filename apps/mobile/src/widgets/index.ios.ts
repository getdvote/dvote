import type { Card } from '../lib/api';
import { LINKS, pointsSnapshot, qrSnapshot, savePoints } from './data';
import { PointsWidget, QrWidget } from './ios-widgets';

/** See index.ts. iOS: show the new snapshot in the WidgetKit widgets at once. */
export function refreshWidgets(cards: Card[] | null): void {
  const points = pointsSnapshot(cards);
  void savePoints(points);
  try {
    PointsWidget.updateSnapshot({ ...points, link: LINKS.cards });
    QrWidget.updateSnapshot({ ...qrSnapshot(), link: LINKS.collectQr });
  } catch {
    // widgets unavailable (e.g. Expo Go): the app works the same without them
  }
}
