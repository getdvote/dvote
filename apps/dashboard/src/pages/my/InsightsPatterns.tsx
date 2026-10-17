import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { DownloadIcon as Download } from '@solar-icons/react/linear';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '../../components/ErrorAlert';
import { num } from '../../components/PageHeader';
import { vendorApi, type VendorPatterns } from '../../lib/api';
import { WEEK_ORDER } from '../../lib/hours';
import { t } from '../../i18n';

/** Saves rows as a .csv file (UTF-8 with BOM, so Excel shows Arabic names). */
function downloadCsv(name: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${dayjs().format('YYYY-MM-DD')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const shortDay = (d: number) => dayjs().day(d).format('ddd');
const clock = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Section({ title, hint, onCsv, children }: { title: string; hint: string; onCsv?: () => void; children: ReactNode }) {
  return (
    <Card className="mb-5">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </div>
        {onCsv ? (
          <Button variant="outline" size="sm" onClick={onCsv}>
            <Download /> {t('insights.patterns.csv')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Empty = ({ text }: { text: string }) => <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;

/**
 * The Insights page's pattern sections: top members, busiest hours and who comes back. Fixed
 * windows (last year / 12 weeks / 6 months), so they don't follow the page's period, only its branch.
 */
export function InsightsPattern({ which, branchId, money }: { which: 'top' | 'hours' | 'back'; branchId?: string; money: (s: string) => string }) {
  // one request for the three sections: the same query key, cached
  const { data, isLoading, error } = useQuery({
    queryKey: ['insights', 'patterns', branchId ?? 'all'],
    queryFn: () => vendorApi.patterns({ branchId }),
    placeholderData: (prev) => prev,
  });
  if (error) return <ErrorAlert error={error} className="mb-5" />;
  if (isLoading || !data) return <Skeleton className="mb-5 h-64 rounded-xl" />;
  if (which === 'top') return <TopMembers data={data} money={money} />;
  if (which === 'hours') return <BusiestHours data={data} />;
  return <WhoComesBack data={data} />;
}

function TopMembers({ data, money }: { data: VendorPatterns; money: (s: string) => string }) {
  const rows = data.topMembers;
  const name = (m: VendorPatterns['topMembers'][number]) => m.name ?? `#${m.customerRef}`;
  return (
    <Section
      title={t('insights.patterns.topTitle')}
      hint={t('insights.patterns.topHint')}
      onCsv={
        rows.length
          ? () =>
              downloadCsv('top-members', [
                [
                  t('insights.patterns.member'),
                  t('insights.patterns.visits'),
                  t('insights.patterns.points'),
                  t('insights.patterns.rewards'),
                  t('insights.patterns.spent'),
                  t('insights.patterns.lastSeen'),
                ],
                ...rows.map((m) => [name(m), m.visits, m.points, m.rewards, m.spent, dayjs(m.lastSeen).format('YYYY-MM-DD')]),
              ])
          : undefined
      }
    >
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t('insights.patterns.member')}</TableHead>
                <TableHead className="text-end">{t('insights.patterns.visits')}</TableHead>
                <TableHead className="text-end">{t('insights.patterns.points')}</TableHead>
                <TableHead className="text-end">{t('insights.patterns.rewards')}</TableHead>
                <TableHead className="text-end">{t('insights.patterns.spent')}</TableHead>
                <TableHead className="pe-4 text-end">{t('insights.patterns.lastSeen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.customerRef}>
                  <TableCell className="ps-4 font-medium">{name(m)}</TableCell>
                  <TableCell className="text-end tabular-nums">{num(m.visits)}</TableCell>
                  <TableCell className="text-end tabular-nums">{num(m.points)}</TableCell>
                  <TableCell className="text-end tabular-nums">{num(m.rewards)}</TableCell>
                  <TableCell className="text-end tabular-nums">{money(m.spent)}</TableCell>
                  <TableCell className="pe-4 text-end">{dayjs(m.lastSeen).format('D MMM')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty text={t('insights.patterns.topEmpty')} />
      )}
    </Section>
  );
}

/** 0 = nothing, 1-4 = quarters of the busiest hour. */
const LEVELS = ['bg-muted', 'bg-primary/15', 'bg-primary/35', 'bg-primary/60', 'bg-primary'];
const level = (count: number, max: number) => (count ? Math.max(1, Math.ceil((count / max) * 4)) : 0);

function BusiestHours({ data }: { data: VendorPatterns }) {
  const at = (day: number, hour: number) => data.busiestHours.find((c) => c.day === day && c.hour === hour)?.count ?? 0;
  const max = Math.max(0, ...data.busiestHours.map((c) => c.count));
  const peak = data.busiestHours.reduce<VendorPatterns['busiestHours'][number] | null>((p, c) => (!p || c.count > p.count ? c : p), null);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hint =
    t('insights.patterns.hoursHint') +
    (peak ? ` ${t('insights.patterns.hoursPeak', { day: shortDay(peak.day), from: clock(peak.hour), to: clock(peak.hour + 1), count: num(peak.count) })}` : '');

  return (
    <Section
      title={t('insights.patterns.hoursTitle')}
      hint={hint}
      onCsv={
        max
          ? () =>
              downloadCsv('busiest-hours', [
                [t('insights.patterns.day'), ...hours.map(clock)],
                ...WEEK_ORDER.map((d) => [shortDay(d), ...hours.map((h) => at(d, h))]),
              ])
          : undefined
      }
    >
      {max ? (
        <Tabs defaultValue="chart">
          <TabsList className="mb-4">
            <TabsTrigger value="chart">{t('insights.patterns.viewChart')}</TabsTrigger>
            <TabsTrigger value="table">{t('insights.patterns.viewTable')}</TabsTrigger>
          </TabsList>
          <TabsContent value="chart">
            <div className="overflow-x-auto" dir="ltr">
              <div className="grid min-w-[640px] grid-cols-[3rem_repeat(24,minmax(0,1fr))] gap-1">
                <span />
                {hours.map((h) => (
                  <span key={h} className="text-center text-[11px] text-muted-foreground tabular-nums">
                    {h % 3 === 0 ? h : ''}
                  </span>
                ))}
                {WEEK_ORDER.map((d) => (
                  <div key={d} className="contents">
                    <span className="flex items-center text-xs text-muted-foreground">{shortDay(d)}</span>
                    {hours.map((h) => {
                      const c = at(d, h);
                      return (
                        <span
                          key={h}
                          title={`${shortDay(d)} ${clock(h)}–${clock(h + 1)}: ${num(c)}`}
                          className={cn('aspect-square rounded-[4px]', LEVELS[level(c, max)])}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              {t('insights.patterns.quiet')}
              {LEVELS.slice(1).map((l) => (
                <span key={l} className={cn('size-3.5 rounded-[3px]', l)} />
              ))}
              {t('insights.patterns.busiest')}
            </div>
          </TabsContent>
          <TabsContent value="table">
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('insights.patterns.day')}</TableHead>
                    <TableHead>{t('insights.patterns.hour')}</TableHead>
                    <TableHead className="text-end">{t('insights.patterns.count')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.busiestHours]
                    .sort((a, b) => b.count - a.count)
                    .map((c) => (
                      <TableRow key={`${c.day}-${c.hour}`}>
                        <TableCell>{shortDay(c.day)}</TableCell>
                        <TableCell dir="ltr" className="text-start tabular-nums">
                          {clock(c.hour)}–{clock(c.hour + 1)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{num(c.count)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <Empty text={t('insights.patterns.hoursEmpty')} />
      )}
    </Section>
  );
}

function WhoComesBack({ data }: { data: VendorPatterns }) {
  const any = data.cohorts.some((c) => c.size > 0);
  const months = (m: string) => dayjs(`${m}-01`).format('MMM YYYY');
  const after = Array.from({ length: 6 }, (_, i) => i + 1);
  return (
    <Section
      title={t('insights.patterns.backTitle')}
      hint={t('insights.patterns.backHint')}
      onCsv={
        any
          ? () =>
              downloadCsv('who-comes-back', [
                [t('insights.patterns.month'), t('insights.patterns.people'), ...after.map((n) => t('insights.patterns.after', { n }))],
                ...data.cohorts.map((c) => [months(c.month), c.size, ...c.returned.map((r) => (r === null ? '' : pct(r)))]),
              ])
          : undefined
      }
    >
      {any ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t('insights.patterns.month')}</TableHead>
                <TableHead className="text-end">{t('insights.patterns.people')}</TableHead>
                {after.map((n) => (
                  <TableHead key={n} className="text-center">
                    {t('insights.patterns.after', { n })}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cohorts.map((c) => (
                <TableRow key={c.month}>
                  <TableCell className="ps-4 font-medium">{months(c.month)}</TableCell>
                  <TableCell className="text-end tabular-nums">{num(c.size)}</TableCell>
                  {c.returned.map((r, i) => (
                    <TableCell key={i} className="p-1 text-center">
                      {r === null || !c.size ? null : (
                        <span className={cn('block rounded-md py-1.5 text-xs tabular-nums', LEVELS[level(r, 1)], r >= 0.5 && 'text-primary-foreground')}>
                          {pct(r)}
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty text={t('insights.patterns.backEmpty')} />
      )}
    </Section>
  );
}
