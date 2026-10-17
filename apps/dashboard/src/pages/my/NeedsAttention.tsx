import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon as ArrowRight, DangerCircleIcon as CircleAlert, CheckCircleIcon as CircleCheck, InfoCircleIcon as Info, DangerTriangleIcon as TriangleAlert } from '@solar-icons/react/linear';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { vendorApi, type AttentionItem } from '../../lib/api';
import { cn } from '@/lib/utils';
import { getLanguage, t, type TKey } from '../../i18n';
import { useMe } from '../../layouts/VendorLayout';

const TONE = {
  critical: { icon: CircleAlert, chip: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' },
  warning: { icon: TriangleAlert, chip: 'bg-warning-soft text-warning', bar: 'bg-warning' },
  info: { icon: Info, chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/30' },
} as const;

/**
 * The top of the dashboard home, in two sections: Today (customers affected now, unusual
 * activity) and Finish your setup, most urgent first. Each item shows its urgency, what is wrong
 * and the one action that fixes it. While the go-live steps are on the home (`hideSetup`), setup
 * items are left to them instead of being listed twice. Re-read every minute.
 */
export function NeedsAttention({ hideSetup = false }: { hideSetup?: boolean }) {
  const admin = useMe().role === 'vendor_admin';
  const { data, isLoading, error } = useQuery({ queryKey: ['attention', 'me'], queryFn: vendorApi.attention, refetchInterval: 60_000 });
  if (error) return null; // the rest of the home still works

  const all = data?.items ?? [];
  const now = all.filter((i) => i.group === 'now');
  const setup = hideSetup ? [] : all.filter((i) => i.group === 'setup');
  const urgent = now.filter((i) => i.tone === 'critical').length;

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='flex flex-row flex-wrap items-center gap-3 border-b py-4'>
        <CardTitle className='flex-1'>{t('attention.title')}</CardTitle>
        {urgent ? (
          <Badge variant='destructive' className='tabular-nums'>
            {t('attention.tones.critical')} · {urgent}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className='px-0'>
        {isLoading ? (
          <div className='grid gap-2 p-6'>
            <Skeleton className='h-14 w-full' />
            <Skeleton className='h-14 w-full' />
          </div>
        ) : !now.length && !setup.length ? (
          <div className='flex items-center gap-3 px-6 py-5 text-sm'>
            <span className='flex size-9 items-center justify-center rounded-full bg-success/10'>
              <CircleCheck className='size-5 text-success' />
            </span>
            <span>
              <span className='font-medium'>{t('attention.allGood')}</span>{' '}
              <span className='text-muted-foreground'>{hideSetup ? t('attention.setupInChecklist') : t('attention.nothingNow')}</span>
            </span>
          </div>
        ) : (
          <>
            <Section title={t('attention.groups.now')} items={now} admin={admin} empty={t('attention.todayNormal')} />
            {setup.length ? <Section title={t('attention.groups.setup')} items={setup} admin={admin} /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** One section: a small heading with its count, then the items as rows with a coloured edge. */
function Section({ title, items, admin, empty }: { title: string; items: AttentionItem[]; admin: boolean; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <section className='border-b last:border-b-0'>
      <div className='flex items-center gap-2 px-6 pt-4 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
        {title}
        <span className='rounded-full bg-muted px-1.5 py-px text-[11px] tabular-nums'>{items.length}</span>
      </div>
      {!items.length ? (
        <p className='flex items-center gap-2 px-6 pb-4 text-sm text-muted-foreground'>
          <CircleCheck className='size-4 text-success' /> {empty}
        </p>
      ) : (
        <ul className='grid gap-2 px-4 pb-4'>
          {items.map((i) => {
            const tone = TONE[i.tone];
            const text = wording(i, admin);
            return (
              <li key={i.key} className='relative flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-lg border bg-card py-3 ps-5 pe-3'>
                <span aria-hidden className={cn('absolute inset-y-0 start-0 w-1', tone.bar)} />
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', tone.chip)}>
                  <tone.icon className='size-4' />
                </span>
                <div className='min-w-48 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-medium'>{text.title}</span>
                    <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold', tone.chip)}>{t(`attention.tones.${i.tone}`)}</span>
                  </div>
                  {text.detail ? <div className='mt-0.5 text-sm text-muted-foreground'>{text.detail}</div> : null}
                </div>
                <Button asChild size='sm' variant={i.tone === 'critical' ? 'default' : 'outline'}>
                  <Link to={i.action.to}>
                    {text.action} <ArrowRight className='rtl:rotate-180' />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The item in the dashboard language: the API sends English text plus its values (params);
 * known kinds are worded from the dictionary, anything new falls back to the API's English.
 */
function wording(i: AttentionItem, admin: boolean): { title: string; detail: string | null; action: string } {
  const kind = i.key.split(':')[0];
  const p = i.params ?? {};
  if (getLanguage() === 'en' || !(kind in KINDS)) return { title: i.title, detail: i.detail, action: i.action.label };
  const k = `attention.kinds.${kind}` as const;
  const one = Number(p.count) === 1;
  const params = { ...p, count: Number(p.count ?? 0), missing: p.missing ? t(`attention.missing.${p.missing}` as TKey) : '' };
  return {
    title: t(`${k}.${one && KINDS[kind].oneTitle ? 'titleOne' : 'title'}` as TKey, params),
    detail: t(`${k}.detail` as TKey, params),
    action: t(`${k}.${KINDS[kind].adminAction && !admin ? 'actionView' : 'action'}` as TKey, params),
  };
}

/** Kinds worded in the dictionary: whether they have a singular title / a view-only action. */
const KINDS: Record<string, { oneTitle?: boolean; adminAction?: boolean }> = {
  no_active_rule: { adminAction: true },
  no_active_rewards: { adminAction: true },
  branch_paused: {},
  sold_out: {},
  rewards_no_photo: {},
  rewards_no_arabic: {},
  branches_no_hours: { oneTitle: true },
  branches_no_location: { oneTitle: true },
  profile_branding: {},
  no_staff: {},
  staff_spike: {},
  card_spike: {},
  large_bill: {},
};
