import { CopyIcon as Copy, AddIcon as Plus, CloseIcon as X } from '@solar-icons/react/linear';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HoursSlot } from '../lib/api';
import { dayName, MAX_SLOTS_PER_DAY, WEEK_ORDER } from '../lib/hours';
import { t } from '../i18n';

const DEFAULT = { opensAt: '09:00', closesAt: '23:00' };
const SECOND = { opensAt: '17:00', closesAt: '23:00' };

/**
 * Opening hours per weekday (Saturday first): a day is open or closed, and open days have up to
 * three times (split shifts, e.g. 09:00–15:00 and 17:00–01:00). A closing time earlier than the
 * opening time means open past midnight. Empty week = hours not set.
 */
export function WeeklyHoursEditor({ value, onChange }: { value: HoursSlot[]; onChange: (v: HoursSlot[]) => void }) {
  const slotsOf = (day: number) => value.filter((s) => s.day === day);
  const replaceDay = (day: number, slots: Omit<HoursSlot, 'day'>[]) =>
    onChange([...value.filter((s) => s.day !== day), ...slots.map((s) => ({ ...s, day }))]);
  const firstOpen = WEEK_ORDER.find((d) => slotsOf(d).length);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {t('hours.title')} <span className="font-normal text-muted-foreground">({t('common.optional')})</span>
        </span>
        <div className="flex gap-1">
          {firstOpen !== undefined ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const model = slotsOf(firstOpen);
                onChange(WEEK_ORDER.flatMap((day) => model.map((s) => ({ ...s, day }))));
              }}
            >
              <Copy /> {t('hours.copyDay', { day: dayName(firstOpen) })}
            </Button>
          ) : null}
          {value.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
              <X /> {t('hours.clear')}
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(WEEK_ORDER.map((day) => ({ ...DEFAULT, day })))}>
              <Plus /> {t('hours.set')}
            </Button>
          )}
        </div>
      </div>

      {value.length ? (
        <div className="divide-y rounded-lg border">
          {WEEK_ORDER.map((day) => {
            const slots = slotsOf(day);
            const open = slots.length > 0;
            return (
              <div key={day} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 py-2.5">
                <label className="flex w-36 shrink-0 items-center gap-2.5 pt-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={open}
                    onChange={(e) => replaceDay(day, e.target.checked ? [DEFAULT] : [])}
                  />
                  <span className="font-medium">{dayName(day)}</span>
                </label>
                {open ? (
                  <div className="grid flex-1 gap-2">
                    {slots.map((s, i) => {
                      const set = (k: 'opensAt' | 'closesAt', v: string) => replaceDay(day, slots.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            type="time"
                            required
                            className="h-8 w-32"
                            aria-label={t('hours.opens', { day: dayName(day) })}
                            value={s.opensAt}
                            onChange={(e) => set('opensAt', e.target.value)}
                          />
                          <span className="text-muted-foreground">{t('hours.to')}</span>
                          <Input
                            type="time"
                            required
                            className="h-8 w-32"
                            aria-label={t('hours.closes', { day: dayName(day) })}
                            value={s.closesAt}
                            onChange={(e) => set('closesAt', e.target.value)}
                          />
                          {slots.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('hours.removeTime')}
                              onClick={() => replaceDay(day, slots.filter((_, j) => j !== i))}
                            >
                              <X />
                            </Button>
                          ) : null}
                          {i === slots.length - 1 && slots.length < MAX_SLOTS_PER_DAY ? (
                            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => replaceDay(day, [...slots, SECOND])}>
                              <Plus /> {t('hours.addTime')}
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="pt-1.5 text-sm text-muted-foreground">{t('hours.closed')}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {value.length
          ? t('hours.hintSet')
          : t('hours.hintEmpty')}
      </p>
    </div>
  );
}
