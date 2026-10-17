import dayjs from 'dayjs';
import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '../i18n';

const DAY = 'YYYY-MM-DD';

export type Period = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';
const PERIODS: Period[] = ['today', '7d', '30d', 'month', 'lastMonth', 'custom'];

/** First and last day (inclusive, YYYY-MM-DD) for the API. */
export interface DayRange {
  from?: string;
  to?: string;
}

function range(period: Period, custom: { from: string; to: string }): DayRange {
  const today = dayjs(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  switch (period) {
    case 'today':
      return { from: today.format(DAY), to: today.format(DAY) };
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

/** Preset select, date fields for custom, and the exact dates in words. `onChange` runs on any change (e.g. back to page 1). */
export function PeriodPicker({ state, onChange, children }: { state: ReturnType<typeof usePeriod>; onChange?: () => void; children?: ReactNode }) {
  const { period, setPeriod, custom, setCustom, dates } = state;
  const setDay = (k: 'from' | 'to', v: string) => {
    setCustom({ ...custom, [k]: v });
    onChange?.();
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Select
        value={period}
        onValueChange={(v) => {
          setPeriod(v as Period);
          onChange?.();
        }}
      >
        <SelectTrigger className="h-9 w-40" aria-label={t('period.label')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {t(`period.${p}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === 'custom' ? (
        <div className="flex items-center gap-2">
          <Input type="date" className="h-9 w-40" aria-label={t('period.fromLabel')} value={custom.from} max={custom.to || undefined} onChange={(e) => setDay('from', e.target.value)} />
          <span className="text-muted-foreground">{t('hours.to')}</span>
          <Input type="date" className="h-9 w-40" aria-label={t('period.toLabel')} value={custom.to} min={custom.from || undefined} onChange={(e) => setDay('to', e.target.value)} />
        </div>
      ) : null}
      {children}
      <span className="text-sm text-muted-foreground">{rangeText(dates)}</span>
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
