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
        <CardTitle>Needs your attention</CardTitle>
        {items.length ? (
          <StatusFilter
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All ${items.length}` },
              { value: 'now', label: `Today ${now}` },
              { value: 'setup', label: `Setup ${setup}` },
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
              <span className="font-medium">All good.</span> <span className="text-muted-foreground">Nothing needs you right now.</span>
            </span>
          </div>
        ) : !shown.length ? (
          <p className="px-6 pb-4 text-sm text-muted-foreground">Nothing here. {filter === 'now' ? 'Today looks normal.' : 'Your setup is complete.'}</p>
        ) : (
          <ul className="divide-y">
            {shown.map((i) => {
              const tone = TONE[i.tone];
              return (
                <li key={i.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone.className)}>
                    <tone.icon className="size-4" />
                  </span>
                  <div className="min-w-48 flex-1">
                    <div className="font-medium">{i.title}</div>
                    {i.detail ? <div className="text-sm text-muted-foreground">{i.detail}</div> : null}
                  </div>
                  <Button asChild size="sm" variant={i.tone === 'critical' ? 'default' : 'outline'}>
                    <Link to={i.action.to}>
                      {i.action.label} <ArrowRight />
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
