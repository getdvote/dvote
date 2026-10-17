import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon as ArrowRight, CheckIcon as Check, AltArrowDownIcon as ChevronDown } from '@solar-icons/react/linear';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { vendorApi } from '../../lib/api';
import { cn } from '@/lib/utils';
import { t } from '../../i18n';

const OPEN_KEY = 'dvote-go-live-open';

/** The go-live checklist is showing (merchant admin, not live yet): the home hides duplicate setup tips. */
export function useGoLivePending(enabled: boolean) {
  const { data } = useQuery({ queryKey: ['go-live', 'me'], queryFn: vendorApi.goLive, refetchInterval: 60_000, enabled });
  return enabled && !!data && !data.live;
}

/**
 * Compact strip at the top of the merchant home while a new shop is still setting up: the title,
 * "6/7" with one bar segment per step, the next step and its one action. "Show steps" unfolds
 * every step as a link (remembered in this browser). Merchant admin only; gone once live.
 */
export function GoLiveChecklist({ className }: { className?: string }) {
  const { data, error } = useQuery({ queryKey: ['go-live', 'me'], queryFn: vendorApi.goLive, refetchInterval: 60_000 });
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
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

  const next = data.steps.find((s) => !s.done);

  return (
    <Card className={cn('gap-0 px-4 py-3', className)}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-48 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">{t('goLive.title')}</h2>
            <span dir="ltr" className="text-xs text-muted-foreground tabular-nums">
              {data.done}/{data.total}
            </span>
          </div>
          <div className="mt-1.5 flex max-w-sm gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={data.done} aria-label={t('goLive.progress')}>
            {data.steps.map((s) => (
              <span key={s.key} className={cn('h-1 flex-1 rounded-full', s.done ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
        </div>
        {next ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-sm">
              <span className="text-muted-foreground">{t('goLive.nextBadge')}: </span>
              <span className="font-medium">{t(`goLive.steps.${next.key}.title`)}</span>
            </div>
            <Button asChild size="sm">
              <Link to={next.to}>
                {t(`goLive.steps.${next.key}.action`)}
                <ArrowRight className="rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        ) : null}
        <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={open} aria-controls="go-live-steps" className="text-muted-foreground">
          {open ? t('goLive.hide') : t('goLive.show')}
          <ChevronDown className={cn('transition-transform duration-200', open && 'rotate-180')} />
        </Button>
      </div>

      <div className="checklist-reveal" data-open={open} inert={!open} aria-hidden={!open}>
        <div className="min-h-0 overflow-hidden">
        <ol id="go-live-steps" className="mt-4 grid gap-1 border-t pt-4">
          {data.steps.map((s, i) => {
            const isNext = !s.done && s.key === next?.key;
            return (
              <li key={s.key} className="relative min-w-0">
                {i < data.steps.length - 1 ? <span aria-hidden className="absolute start-7 top-10 -bottom-2 border-s border-border" /> : null}
                <Link
                  to={s.to}
                  aria-current={isNext ? 'step' : undefined}
                  className={cn(
                    'group/step relative flex min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    isNext && 'border-border bg-muted/50',
                  )}
                >
                  <span className={cn(
                    'relative flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium tabular-nums',
                    s.done ? 'border-success/20 bg-success-soft text-success' : isNext ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
                  )}>
                    {s.done ? <Check className="size-4" aria-label={t('goLive.doneLabel')} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', s.done ? 'text-muted-foreground' : 'font-medium')}>
                      {t(`goLive.steps.${s.key}.title`)}
                    </span>
                    {!s.done ? <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t(`goLive.steps.${s.key}.hint`)}</span> : null}
                  </span>
                  {isNext ? (
                    <span className="flex shrink-0 items-center gap-2 text-xs font-medium">
                      <span className="hidden sm:inline">{t(`goLive.steps.${s.key}.action`)}</span>
                      <ArrowRight className="size-4 rtl:rotate-180" />
                    </span>
                  ) : s.done ? <span className="shrink-0 text-xs text-muted-foreground">{t('goLive.stepDone')}</span> : <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/step:opacity-100 group-focus-visible/step:opacity-100 rtl:rotate-180" />}
                </Link>
              </li>
            );
          })}
        </ol>
        </div>
      </div>
    </Card>
  );
}
