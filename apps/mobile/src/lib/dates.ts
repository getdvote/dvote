/**
 * Birthday helpers. A birthday is a plain calendar day "YYYY-MM-DD" (no time zone), the same
 * format the API stores. Pickers work with a local Date at noon, so no daylight-saving edge
 * can move it to another day.
 */

import { calendarNames, t } from '../i18n';

export const OLDEST_BIRTHDAY = '1900-01-01';

export const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const todayYmd = () => toYmd(new Date());

/** "12 Apr 1995" / "12 أبريل 1995" */
export const showYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${calendarNames().monthsShort[m - 1]} ${y}`;
};

/** A moment as a day, e.g. "8 Oct 2026" / "8 أكتوبر 2026" (the phone's time zone). */
export const showDate = (date: Date) =>
  `${date.getDate()} ${calendarNames().monthsShort[date.getMonth()]} ${date.getFullYear()}`;

/** Same rules as the API. Returns what's wrong, or null when the birthday is fine. */
export function birthdayProblem(s: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || toYmd(fromYmd(s)) !== s) return t('birthday.realDate');
  if (s > todayYmd()) return t('birthday.future');
  if (s < OLDEST_BIRTHDAY) return t('birthday.tooOld');
  return null;
}
