import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { vendorApi, type GoLive } from '../../lib/api';
import { cn } from '@/lib/utils';
import { t } from '../../i18n';

/**
 * Top of the merchant home while a new shop is still setting up: logo, banner, rule, a first
 * reward with photo and Arabic name, a branch with hours, staff, a test scan. Each open step
 * links to the page that does it. Merchant admin only; gone once every step is done.
 */
export function GoLiveChecklist({ className }: { className?: string }) {
  const { data, error } = useQuery({ queryKey: ['go-live', 'me'], queryFn: vendorApi.goLive, refetchInterval: 60_000 });
  if (error || !data || data.live) return null; // nothing to show, or the rest of the home still works
  const next = data.steps.find((s) => !s.done)?.key;

  return (
    <Card className={cn('gap-0 pb-2', className)}>
      <CardHeader className="pb-3">
        <CardTitle>{t('goLive.title')}</CardTitle>
        <CardDescription>{t('goLive.subtitle', { done: data.done, total: data.total })}</CardDescription>
        <div
          role="progressbar"
          aria-label={t('goLive.progress')}
          aria-valuemin={0}
          aria-valuemax={data.total}
          aria-valuenow={data.done}
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(data.done / data.total) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <ol>
          {data.steps.map((s, i) => (
            <li key={s.key} className={cn('flex items-center gap-3 rounded-lg px-4 py-3', s.key === next && 'bg-muted/60')}>
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                  s.done ? 'border-transparent bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {s.done ? <Check className="size-4" aria-label={t('goLive.doneLabel')} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn('font-medium', s.done && 'text-muted-foreground line-through decoration-muted-foreground/50')}>
                  {t(`goLive.steps.${s.key}.title`)}
                </div>
                {s.done ? null : <div className="text-sm text-muted-foreground">{hint(s.key, data)}</div>}
              </div>
              {s.done ? null : (
                <Button asChild size="sm" variant={s.key === next ? 'default' : 'ghost'}>
                  <Link to={s.to}>
                    {t('goLive.open')}
                    <ArrowRight className="rtl:rotate-180" />
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/** The step's hint; the reward step says what is missing when rewards exist. */
function hint(key: GoLive['steps'][number]['key'], data: GoLive) {
  const r = data.rewards;
  if (key !== 'reward' || !r.active) return t(`goLive.steps.${key}.hint`);
  return t('goLive.reward.missing', { count: r.active, photo: r.withPhoto, arabic: r.withArabic });
}
