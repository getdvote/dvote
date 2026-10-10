import { BadRequestException } from '@nestjs/common';

/** One opening slot: weekday 0-6 (0 = Sunday), "HH:MM" 24-hour, branch-local. */
export interface HoursSlot {
  day: number;
  opensAt: string;
  closesAt: string;
}

/** At most this many slots per day (split shifts). */
export const MAX_SLOTS_PER_DAY = 3;

const minutes = (clock: string) =>
  Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** Sorted by day, then opening time. */
export const sortSlots = (slots: HoursSlot[]) =>
  [...slots].sort(
    (a, b) => a.day - b.day || minutes(a.opensAt) - minutes(b.opensAt),
  );

/**
 * Checks a week of slots: no slot opens and closes at the same time (hours_invalid), at most
 * MAX_SLOTS_PER_DAY a day (too_many_slots), and a day's slots don't overlap (hours_overlap).
 * Only a day's last slot may run past midnight. Returns them sorted.
 */
export function assertWeek(slots: HoursSlot[]): HoursSlot[] {
  const sorted = sortSlots(slots);
  for (let day = 0; day < 7; day++) {
    const today = sorted.filter((s) => s.day === day);
    if (today.length > MAX_SLOTS_PER_DAY)
      throw new BadRequestException({ code: 'too_many_slots' });
    today.forEach((s, i) => {
      if (s.opensAt === s.closesAt)
        throw new BadRequestException({ code: 'hours_invalid' });
      const next = today[i + 1];
      if (!next) return;
      const pastMidnight = minutes(s.closesAt) < minutes(s.opensAt);
      if (pastMidnight || minutes(s.closesAt) > minutes(next.opensAt))
        throw new BadRequestException({ code: 'hours_overlap' });
    });
  }
  return sorted;
}

/** The legacy single opens/closes pair: set only when all seven days have the same one slot. */
export function legacyPair(slots: HoursSlot[] | null): {
  opensAt: string | null;
  closesAt: string | null;
} {
  if (!slots || slots.length !== 7) return { opensAt: null, closesAt: null };
  const [first] = slots;
  const same = slots.every(
    (s, i) =>
      s.day === i &&
      s.opensAt === first.opensAt &&
      s.closesAt === first.closesAt,
  );
  return same
    ? { opensAt: first.opensAt, closesAt: first.closesAt }
    : { opensAt: null, closesAt: null };
}

/** Old clients send one pair for every day: the same slot on all seven days (null = not set). */
export const everyDay = (opensAt: string, closesAt: string): HoursSlot[] =>
  Array.from({ length: 7 }, (_, day) => ({ day, opensAt, closesAt }));

/** Reads the stored JSON (null when not set). */
export const readWeek = (json: unknown): HoursSlot[] | null =>
  Array.isArray(json) ? (json as HoursSlot[]) : null;

/** The pause only counts while it is ahead. */
export const activePause = (pausedUntil: Date | null): string | null =>
  pausedUntil && pausedUntil.getTime() > Date.now()
    ? pausedUntil.toISOString()
    : null;
