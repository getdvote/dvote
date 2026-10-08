/**
 * Birthday helpers. A birthday is a plain calendar day "YYYY-MM-DD" (no time zone), the same
 * format the API stores. Pickers work with a local Date at noon, so no daylight-saving edge
 * can move it to another day.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const OLDEST_BIRTHDAY = '1900-01-01';

export const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const todayYmd = () => toYmd(new Date());

/** "12 Apr 1995" */
export const showYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** Same rules as the API. Returns what's wrong, or null when the birthday is fine. */
export function birthdayProblem(s: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || toYmd(fromYmd(s)) !== s) return 'Choose a real date.';
  if (s > todayYmd()) return "Your birthday can't be in the future.";
  if (s < OLDEST_BIRTHDAY) return 'Choose a date after 1900.';
  return null;
}
