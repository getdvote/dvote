import dayjs, { type Dayjs } from 'dayjs';
import { AltArrowDownIcon, AltArrowLeftIcon, AltArrowRightIcon, CalendarIcon } from '@solar-icons/react/linear';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getLanguage, localeOf, t } from '../i18n';

const DAY = 'YYYY-MM-DD';

export type Period = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';
const PRESETS: Exclude<Period, 'custom'>[] = ['today', 'yesterday', '7d', '30d', 'month', 'lastMonth'];

/** First and last day (inclusive, YYYY-MM-DD) for the API. */
export interface DayRange {
  from?: string;
  to?: string;
}

/** Today in Cairo (reports count Cairo days). */
const cairoToday = () =>
  dayjs(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));

function range(period: Period, custom: { from: string; to: string }): DayRange {
  const today = cairoToday();
  switch (period) {
    case 'today':
      return { from: today.format(DAY), to: today.format(DAY) };
    case 'yesterday': {
      const y = today.subtract(1, 'day').format(DAY);
      return { from: y, to: y };
    }
    case '7d':
      return { from: today.subtract(6, 'day').format(DAY), to: today.format(DAY) };
    case '30d':
      return { from: today.subtract(29, 'day').format(DAY), to: today.format(DAY) };
    case 'month':
      return { from: today.startOf('month').format(DAY), to: today.format(DAY) };
    case 'lastMonth': {
      const last = today.subtract(1, 'month');
      return { from: last.startOf('month').format(DAY), to: last.endOf('month').format(DAY) };
    }
    case 'custom':
      return { from: custom.from || undefined, to: custom.to || undefined };
  }
}

export function rangeText({ from, to }: DayRange) {
  if (!from && !to) return t('period.allTime');
  if (from === to) return dayjs(from).format('D MMM YYYY');
  if (!from) return t('period.until', { date: dayjs(to).format('D MMM YYYY') });
  if (!to) return t('period.from', { date: dayjs(from).format('D MMM YYYY') });
  return `${dayjs(from).format('D MMM')} – ${dayjs(to).format('D MMM YYYY')}`;
}

/** The period state for a page: a preset (default last 7 days) or two custom dates. */
export function usePeriod(initial: Period = '7d') {
  const [period, setPeriod] = useState<Period>(initial);
  const [custom, setCustom] = useState({ from: '', to: '' });
  return { period, setPeriod, custom, setCustom, dates: range(period, custom) };
}

interface Draft {
  preset: Period;
  from: string | null;
  to: string | null;
}

/**
 * The period button: opens presets beside a two-month calendar (one month on phones). Picking a
 * preset or two days only changes the draft; Apply sets it. `onChange` runs on apply (e.g. back to page 1).
 */
export function PeriodPicker({ state, onChange, children }: { state: ReturnType<typeof usePeriod>; onChange?: () => void; children?: ReactNode }) {
  const { period, setPeriod, setCustom, dates } = state;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ preset: period, from: null, to: null });
  const [month, setMonth] = useState(() => cairoToday().startOf('month'));
  const [hover, setHover] = useState<string | null>(null);
  const today = cairoToday();

  const openPicker = (next: boolean) => {
    if (next) {
      setDraft({ preset: period, from: dates.from ?? null, to: dates.to ?? null });
      setMonth(dayjs(dates.to ?? today).startOf('month'));
      setHover(null);
    }
    setOpen(next);
  };
  const pickPreset = (p: Exclude<Period, 'custom'>) => {
    const r = range(p, { from: '', to: '' });
    setDraft({ preset: p, from: r.from!, to: r.to! });
    setMonth(dayjs(r.to).startOf('month'));
  };
  const pickDay = (day: string) => {
    setDraft((d) =>
      !d.from || d.to
        ? { preset: 'custom', from: day, to: null }
        : day < d.from
          ? { preset: 'custom', from: day, to: d.from }
          : { preset: 'custom', from: d.from, to: day },
    );
  };
  const apply = () => {
    if (!draft.from) return;
    if (draft.preset === 'custom') {
      setCustom({ from: draft.from, to: draft.to ?? draft.from });
      setPeriod('custom');
    } else setPeriod(draft.preset);
    onChange?.();
    setOpen(false);
  };

  // while choosing the second day, show the range up to the day under the pointer
  const shown = draft.from && !draft.to && hover ? (hover < draft.from ? { from: hover, to: draft.from } : { from: draft.from, to: hover }) : draft;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Popover open={open} onOpenChange={openPicker}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 min-w-40 justify-between gap-2 font-normal" aria-label={t('period.label')}>
            <span className="flex items-center gap-2">
              <CalendarIcon className="text-muted-foreground" />
              {t(`period.${period}`)}
            </span>
            <AltArrowDownIcon className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-(--radix-popover-content-available-height) w-[calc(100vw-1.5rem)] max-w-max gap-0 overflow-x-hidden overflow-y-auto p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex gap-1 overflow-x-auto border-b p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-e sm:border-b-0">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => pickPreset(p)}
                  className={cn(
                    'shrink-0 rounded-md px-3 py-1.5 text-start text-sm whitespace-nowrap transition duration-100 ease-linear hover:bg-muted',
                    draft.preset === p && 'bg-muted font-medium',
                  )}
                >
                  {t(`period.${p}`)}
                </button>
              ))}
            </div>
            <div className="min-w-0">
              <div className="relative flex gap-6 p-3 sm:px-4" onPointerLeave={() => setHover(null)}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute start-3 top-3"
                  aria-label={t('period.prevMonth')}
                  onClick={() => setMonth(month.subtract(1, 'month'))}
                >
                  <AltArrowLeftIcon className="rtl:rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute end-3 top-3"
                  aria-label={t('period.nextMonth')}
                  disabled={!month.isBefore(today, 'month')}
                  onClick={() => setMonth(month.add(1, 'month'))}
                >
                  <AltArrowRightIcon className="rtl:rotate-180" />
                </Button>
                <Month month={month.subtract(1, 'month')} className="hidden sm:block" today={today} range={shown} onPick={pickDay} onHover={setHover} />
                <Month month={month} today={today} range={shown} onPick={pickDay} onHover={setHover} />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t p-3 sm:px-4">
                <DayBox value={draft.from} placeholder={t('period.fromLabel')} />
                <span className="text-muted-foreground">–</span>
                <DayBox value={draft.to} placeholder={t('period.toLabel')} />
                <div className="ms-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" disabled={!draft.from} onClick={apply}>
                    {t('period.apply')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {children}
      <span className="text-sm text-muted-foreground">{rangeText(dates)}</span>
    </div>
  );
}

/** Single-date version of the Activity calendar, with the same popover and Apply flow. */
export function DatePicker({ id, value, onChange, label, placeholder, minDate }: {
  id: string; value: string; onChange: (date: string) => void; label: string; placeholder: string; minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => dayjs(value || undefined).startOf('month'));
  const today = dayjs().startOf('day');
  return (
    <Popover open={open} onOpenChange={next => {
      if (next) { setDraft(value); setMonth(dayjs(value || undefined).startOf('month')); }
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" aria-label={label} className="h-10 w-full justify-between gap-2 font-normal">
          <span className={cn('flex items-center gap-2', !value && 'text-muted-foreground')}>
            <CalendarIcon className="size-4" />
            {value ? dayjs(value).format('D MMM YYYY') : placeholder}
          </span>
          <AltArrowDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-(--radix-popover-content-available-height) w-auto max-w-[calc(100vw-1.5rem)] overflow-y-auto p-0">
        <div className="relative flex gap-6 p-3 sm:px-4">
          <Button variant="ghost" size="icon-sm" className="absolute start-3 top-3" aria-label={t('period.prevMonth')}
            disabled={!!minDate && !month.isAfter(dayjs(minDate), 'month')}
            onClick={() => setMonth(month.subtract(1, 'month'))}><AltArrowLeftIcon className="rtl:rotate-180" /></Button>
          <Button variant="ghost" size="icon-sm" className="absolute end-3 top-3" aria-label={t('period.nextMonth')}
            onClick={() => setMonth(month.add(1, 'month'))}><AltArrowRightIcon className="rtl:rotate-180" /></Button>
          <Month className="max-w-full" month={month} today={today} range={{ from: draft || null, to: draft || null }} onPick={setDraft} onHover={() => {}} minDate={minDate} allowFuture />
          <Month className="hidden sm:block" month={month.add(1, 'month')} today={today} range={{ from: draft || null, to: draft || null }} onPick={setDraft} onHover={() => {}} minDate={minDate} allowFuture />
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <DayBox value={draft || null} placeholder={placeholder} />
          <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button size="sm" disabled={!draft || (!!minDate && draft < minDate)} onClick={() => { onChange(draft); setOpen(false); }}>{t('period.apply')}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The dashboard popover treatment for time selection; no browser-native picker. */
export function TimePicker({ id, value, onChange, label, hoursLabel, minutesLabel }: {
  id: string; value: string; onChange: (time: string) => void; label: string; hoursLabel: string; minutesLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hour, minute] = draft.split(':');
  return (
    <Popover open={open} onOpenChange={next => { if (next) setDraft(value); setOpen(next); }}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" aria-label={label} className="h-10 w-full justify-between gap-2 font-normal">
          <span dir="ltr" className="tabular-nums">{value}</span>
          <AltArrowDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-1.5rem)] gap-0 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">{label}</div>
        <div className="grid grid-cols-2 gap-3 p-3">
          {[{ label: hoursLabel, count: 24, value: hour, choose: (v: string) => setDraft(`${v}:${minute}`) },
            { label: minutesLabel, count: 60, value: minute, choose: (v: string) => setDraft(`${hour}:${v}`) }].map(column => (
              <div key={column.label} className="min-w-0">
                <p className="mb-2 text-center text-xs text-muted-foreground">{column.label}</p>
                <div role="group" aria-label={column.label} className="max-h-48 space-y-1 overflow-y-auto overscroll-contain p-1">
                  {Array.from({ length: column.count }, (_, n) => String(n).padStart(2, '0')).map(option => (
                    <Button key={option} type="button" size="sm" variant={column.value === option ? 'default' : 'ghost'} aria-pressed={column.value === option}
                      className="w-full tabular-nums" ref={node => { if (node && column.value === option) node.scrollIntoView({ block: 'nearest' }); }} onClick={() => column.choose(option)}>{option}</Button>
                  ))}
                </div>
              </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <span dir="ltr" className="text-sm tabular-nums">{draft}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => { onChange(draft); setOpen(false); }}>{t('period.apply')}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DayBox({ value, placeholder }: { value: string | null; placeholder: string }) {
  return (
    <span className={cn('flex h-8 w-32 items-center rounded-md border px-2.5 text-sm tabular-nums', !value && 'text-muted-foreground')}>
      {value ? dayjs(value).format('D MMM YYYY') : placeholder}
    </span>
  );
}

/** Weeks start on Saturday, as in the rest of the dashboard (opening hours). */
const WEEK_START = 6;

function Month({
  month,
  today,
  range: r,
  onPick,
  onHover,
  className,
  minDate,
  allowFuture = false,
}: {
  month: Dayjs;
  today: Dayjs;
  range: { from: string | null; to: string | null };
  onPick: (day: string) => void;
  onHover: (day: string | null) => void;
  className?: string;
  minDate?: string;
  allowFuture?: boolean;
}) {
  const language = getLanguage();
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(localeOf(language), { weekday: language === 'ar' ? 'narrow' : 'short' });
    // 2026-10-17 is a Saturday
    return Array.from({ length: 7 }, (_, i) => {
      const name = fmt.format(new Date(2026, 9, 17 + i));
      return language === 'ar' ? name : name.slice(0, 2);
    });
  }, [language]);
  const lead = (month.day() - WEEK_START + 7) % 7;
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: month.daysInMonth() }, (_, i) => month.date(i + 1))];
  const end = r.to ?? r.from;

  return (
    <div className={cn('w-[17.5rem]', className)}>
      <div className="flex h-8 items-center justify-center text-sm font-medium">{month.format('MMMM YYYY')}</div>
      <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="py-1.5">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} />;
          const key = d.format(DAY);
          const future = (!allowFuture && d.isAfter(today, 'day')) || (!!minDate && key < minDate);
          const isStart = key === r.from;
          const isEnd = key === end;
          const inside = !!r.from && !!end && key > r.from && key < end;
          const band = (inside || ((isStart || isEnd) && r.from !== end)) && !!end;
          return (
            <div
              key={key}
              className={cn(
                'flex justify-center',
                band && 'bg-muted',
                band && isStart && 'rounded-s-lg',
                band && isEnd && 'rounded-e-lg',
                // the band rounds where it wraps to a new week or month
                band && (d.date() === 1 || i % 7 === 0) && 'rounded-s-lg',
                band && (d.date() === d.daysInMonth() || i % 7 === 6) && 'rounded-e-lg',
              )}
            >
              <button
                type="button"
                disabled={future}
                onClick={() => onPick(key)}
                onPointerEnter={() => onHover(future ? null : key)}
                className={cn(
                  'relative flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition duration-100 ease-linear',
                  'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
                  (isStart || isEnd) && 'bg-primary font-medium text-primary-foreground hover:bg-primary',
                )}
              >
                {d.date()}
                {key === today.format(DAY) && !(isStart || isEnd) ? <span className="absolute bottom-1 size-1 rounded-full bg-primary" /> : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One number in a KPI strip (a Card with `flex-row divide-x`); null shows a skeleton. */
export function Total({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className="min-w-40 flex-1 px-5 py-4" title={hint}>
      <div className="text-sm text-muted-foreground">{label}</div>
      {value === null ? <Skeleton className="mt-1.5 h-7 w-20" /> : <div className="mt-0.5 truncate text-2xl font-bold tracking-tight tabular-nums">{value}</div>}
    </div>
  );
}
