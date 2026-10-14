import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, PartyPopper } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { vendorApi, type GoLive, type GoLiveStep } from '../../lib/api';
import { cn } from '@/lib/utils';
import { t } from '../../i18n';

const OPEN_KEY = 'dvote-go-live-open';

/** The steps in four phases, so a new merchant sees where they are in the journey. */
const PHASES: { key: 'brand' | 'program' | 'shop' | 'test'; steps: GoLiveStep[] }[] = [
  { key: 'brand', steps: ['logo', 'banner'] },
  { key: 'program', steps: ['rule', 'reward'] },
  { key: 'shop', steps: ['branch_hours', 'staff'] },
  { key: 'test', steps: ['test_scan'] },
];

/** The go-live checklist is showing (merchant admin, not live yet): the home hides duplicate setup tips. */
export function useGoLivePending(enabled: boolean) {
  const { data } = useQuery({ queryKey: ['go-live', 'me'], queryFn: vendorApi.goLive, refetchInterval: 60_000, enabled });
  return enabled && !!data && !data.live;
}

/**
 * Top of the merchant home while a new shop is still setting up: a stepper through the go-live
 * steps (brand, loyalty program, shop, test), the next step opened with its one action, and any
 * step can be picked to read what it is. Merchant admin only; gone once every step is done.
 */
export function GoLiveChecklist({ className }: { className?: string }) {
  const { data, error } = useQuery({ queryKey: ['go-live', 'me'], queryFn: vendorApi.goLive, refetchInterval: 60_000 });
  const [picked, setPicked] = useState<GoLiveStep | null>(null);
  // folded or unfolded, remembered in this browser
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        // private mode: just not remembered
      }
      return !o;
    });
  if (error || !data || data.live) return null; // nothing to show, or the rest of the home still works

  const byKey = new Map(data.steps.map((s, i) => [s.key, { ...s, n: i + 1 }]));
  const next = data.steps.find((s) => !s.done);
  const current = byKey.get(picked ?? next?.key ?? data.steps[0].key)!;
  const pct = Math.round((data.done / data.total) * 100);

  return (
    <Card className={cn('gap-0 overflow-hidden py-0', className)}>
      {/* Header: progress ring + where I am */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="go-live-steps"
        className={cn(
          'flex w-full flex-wrap items-center gap-4 bg-gradient-to-br from-brand-soft/70 to-transparent px-6 py-5 text-start transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          open && 'border-b',
        )}
      >
        <ProgressRing value={data.done} total={data.total} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{t('goLive.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('goLive.subtitle', { done: data.done, total: data.total })}</p>
        </div>
        <Badge variant="brand" className="tabular-nums">
          {pct}%
        </Badge>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          {open ? t('goLive.hide') : t('goLive.show')}
          <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
        </span>
      </button>

      <CardContent id="go-live-steps" hidden={!open} className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        {/* The steps, by phase, joined by a line */}
        <ol className="grid gap-4" aria-label={t('goLive.progress')}>
          {PHASES.map((phase) => {
            const steps = phase.steps.map((k) => byKey.get(k)).filter((s) => !!s);
            if (!steps.length) return null;
            const phaseDone = steps.every((s) => s.done);
            return (
              <li key={phase.key}>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t(`goLive.phases.${phase.key}`)}
                  {phaseDone ? <Check className="size-3.5 text-success" aria-label={t('goLive.doneLabel')} /> : null}
                </div>
                <ol className="relative">
                  {steps.map((s, i) => {
                    const isCurrent = s.key === current.key;
                    const isNext = s.key === next?.key;
                    return (
                      <li key={s.key} className="relative">
                        {/* connector to the next step in this phase */}
                        {i < steps.length - 1 ? (
                          <span aria-hidden className={cn('absolute start-[19px] top-9 h-[calc(100%-1.5rem)] w-0.5', s.done ? 'bg-primary' : 'bg-border')} />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setPicked(s.key)}
                          aria-current={isCurrent ? 'step' : undefined}
                          className={cn(
                            'relative flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            isCurrent && 'bg-muted',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums',
                              s.done
                                ? 'border-primary bg-primary text-primary-foreground'
                                : isNext
                                  ? 'border-primary bg-background text-primary ring-4 ring-primary/15'
                                  : 'border-border bg-background text-muted-foreground',
                            )}
                          >
                            {s.done ? <Check className="size-4" aria-label={t('goLive.doneLabel')} /> : s.n}
                          </span>
                          <span className={cn('min-w-0 flex-1 truncate text-sm', s.done ? 'text-muted-foreground' : 'font-medium')}>
                            {t(`goLive.steps.${s.key}.title`)}
                          </span>
                          {isNext ? (
                            <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
                              {t('goLive.nextBadge')}
                            </Badge>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>

        {/* The picked (or next) step: what it is and the one action that does it */}
        <div className="flex flex-col rounded-xl border bg-muted/30 p-5" aria-live="polite">
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t('goLive.stepOf', { n: current.n, total: data.total })}
          </div>
          <h3 className="mt-1.5 text-base font-semibold">{t(`goLive.steps.${current.key}.title`)}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{hint(current.key, data)}</p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            {current.done ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <Check className="size-4" /> {t('goLive.stepDone')}
                </span>
                {next ? (
                  <Button size="sm" variant="ghost" onClick={() => setPicked(next.key)}>
                    {t('goLive.goToNext')}
                    <ArrowRight className="rtl:rotate-180" />
                  </Button>
                ) : null}
              </>
            ) : (
              <Button asChild>
                <Link to={current.to}>
                  {t(`goLive.steps.${current.key}.action`)}
                  <ArrowRight className="rtl:rotate-180" />
                </Link>
              </Button>
            )}
          </div>
          {data.done === data.total - 1 && !current.done ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <PartyPopper className="size-3.5" /> {t('goLive.lastOne')}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** A small ring that fills as steps are done, with "3/7" in the middle. */
function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={t('goLive.progress')}>
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / total)}
        />
      </svg>
      <span dir="ltr" className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {value}/{total}
      </span>
    </div>
  );
}

/** The step's hint; the reward step says what is missing when rewards exist. */
function hint(key: GoLiveStep, data: GoLive) {
  const r = data.rewards;
  if (key !== 'reward' || !r.active) return t(`goLive.steps.${key}.hint`);
  return t('goLive.reward.missing', { count: r.active, photo: r.withPhoto, arabic: r.withArabic });
}
