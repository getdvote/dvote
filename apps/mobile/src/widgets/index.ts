import type { Card } from '../lib/api';

/**
 * Home-screen widgets: "My points" (top 3 shops) and "Collect points" (opens a fresh master QR).
 * Platform files do the work (index.ios.ts: WidgetKit, index.android.tsx: Android widgets);
 * this one is the web build, which has no widgets.
 *
 * Call with the customer's cards whenever they load, and with null on sign-out.
 */
export function refreshWidgets(_cards: Card[] | null): void {}
