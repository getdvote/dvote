import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusFilter } from '../../components/ListControls';
import { vendorApi, type AttentionItem } from '../../lib/api';
import { cn } from '@/lib/utils';
import { getLanguage, t, type TKey } from '../../i18n';
import { useMe } from '../../layouts/VendorLayout';

type Filter = 'all' | AttentionItem['group'];

const TONE = {
  critical: { icon: CircleAlert, className: 'bg-destructive/10 text-destructive' },
  warning: { icon: TriangleAlert, className: 'bg-warning-soft text-warning' },
  info: { icon: Info, className: 'bg-muted text-muted-foreground' },
} as const;

/**
 * The top of the dashboard home: what needs me now (customers affected today, unusual activity)
 * and setup still missing, most urgent first, each with the one action that fixes it.
 * Re-read every minute, like the rest of the home.
 */
export function NeedsAttention() {
  const admin = useMe().role === 'vendor_admin';
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading, error } = useQuery({ queryKey: ['attention', 'me'], queryFn: vendorApi.attention, refetchInterval: 60_000 });
  if (error) return null; // the rest of the home still works

  const items = data?.items ?? [];
  const now = items.filter((i) => i.group === 'now').length;
  const setup = items.length - now;
  const shown = filter === 'all' ? items : items.filter((i) => i.group === filter);

  return (
    <Card className="gap-0 pb-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <CardTitle>{t('attention.title')}</CardTitle>
        {items.length ? (
          <StatusFilter
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('attention.all', { n: items.length }) },
              { value: 'now', label: t('attention.today', { n: now }) },
              { value: 'setup', label: t('attention.setup', { n: setup }) },
            ]}
          />
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="grid gap-2 px-6 pb-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !items.length ? (
          <div className="flex items-center gap-3 px-6 pb-4 text-sm">
            <CircleCheck className="size-5 text-success" />
            <span>
              <span className="font-medium">{t('attention.allGood')}</span> <span className="text-muted-foreground">{t('attention.nothingNow')}</span>
            </span>
          </div>
        ) : !shown.length ? (
          <p className="px-6 pb-4 text-sm text-muted-foreground">{t('attention.nothingHere')} {filter === 'now' ? t('attention.todayNormal') : t('attention.setupDone')}</p>
        ) : (
          <ul className="divide-y">
            {shown.map((i) => {
              const tone = TONE[i.tone];
              const text = wording(i, admin);
              return (
                <li key={i.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone.className)}>
                    <tone.icon className="size-4" />
                  </span>
                  <div className="min-w-48 flex-1">
                    <div className="font-medium">{text.title}</div>
                    {text.detail ? <div className="text-sm text-muted-foreground">{text.detail}</div> : null}
                  </div>
                  <Button asChild size="sm" variant={i.tone === 'critical' ? 'default' : 'outline'}>
                    <Link to={i.action.to}>
                      {text.action} <ArrowRight className="rtl:rotate-180" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
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
