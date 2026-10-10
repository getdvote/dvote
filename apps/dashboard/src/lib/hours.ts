import dayjs from 'dayjs';
import type { Branch, HoursSlot } from './api';

/** Egypt's week starts on Saturday: rows are shown in this order (0 = Sunday). */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MAX_SLOTS_PER_DAY = 3;

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
const span = (s: HoursSlot) => `${s.opensAt}–${s.closesAt}`;

/** One line for a table cell: "Every day 09:00–23:00", or today's slots when days differ. */
export function hoursSummary(hours: HoursSlot[] | null, now = dayjs()): string | null {
  if (!hours?.length) return null;
  const byDay = WEEK_ORDER.map((d) => hours.filter((s) => s.day === d).map(span).join(', '));
  if (byDay.every((d) => d && d === byDay[0])) return `Every day ${byDay[0]}`;
  const today = hours.filter((s) => s.day === now.day());
  return today.length ? `Today ${today.map(span).join(', ')}` : 'Closed today';
}

export type BranchState = 'open' | 'closed' | 'paused' | 'unknown';

/**
 * Right now (browser time; merchants are in Egypt like their branches): temporarily closed,
 * open, closed, or unknown when no hours are set. Yesterday's slot past midnight counts.
 */
export function branchState(b: Pick<Branch, 'hours' | 'pausedUntil'>, now = dayjs()): BranchState {
  if (b.pausedUntil && dayjs(b.pausedUntil).isAfter(now)) return 'paused';
  if (!b.hours?.length) return 'unknown';
  const t = now.hour() * 60 + now.minute();
  const today = now.day();
  const yesterday = (today + 6) % 7;
  const open = b.hours.some((s) => {
    const o = minutes(s.opensAt);
    const c = minutes(s.closesAt);
    if (s.day === today) return c > o ? t >= o && t < c : t >= o;
    return s.day === yesterday && c < o && t < c;
  });
  return open ? 'open' : 'closed';
}

export const STATE_LABEL: Record<BranchState, string> = {
  open: 'Open now',
  closed: 'Closed now',
  paused: 'Temporarily closed',
  unknown: 'No hours set',
};
