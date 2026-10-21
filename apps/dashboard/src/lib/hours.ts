import dayjs from 'dayjs';
import type { Branch, HoursSlot } from './api';
import { t } from '../i18n';

/**
 * Opening hours and "temporarily closed" are hidden for now (decided 2026-10-17): no hours
 * editor, no open-now pill or status, no badge on Scan. The API hides them from customers too
 * (OPENING_HOURS_ENABLED). Set true to bring them back.
 */
export const OPENING_HOURS = false;

/** Egypt's week starts on Saturday: rows are shown in this order (0 = Sunday). */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
/** Day name in the dashboard language (0 = Sunday). */
export const dayName = (day: number) => t(`days.d${day}` as `days.d0`);
export const MAX_SLOTS_PER_DAY = 3;

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
/** "09:00–23:00", kept left-to-right inside Arabic text (Unicode left-to-right isolate). */
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);
const span = (s: HoursSlot) => `${LRI}${s.opensAt}–${s.closesAt}${PDI}`;

/** One line for a table cell: "Every day 09:00–23:00", or today's slots when days differ. */
export function hoursSummary(hours: HoursSlot[] | null, now = dayjs()): string | null {
  if (!hours?.length) return null;
  const byDay = WEEK_ORDER.map((d) => hours.filter((s) => s.day === d).map(span).join(', '));
  if (byDay.every((d) => d && d === byDay[0])) return t('hours.everyDay', { hours: byDay[0] });
  const today = hours.filter((s) => s.day === now.day());
  return today.length ? t('hours.today', { hours: today.map(span).join(', ') }) : t('hours.closedToday');
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

export const stateLabel = (state: BranchState) => t(`hours.state.${state}`);
