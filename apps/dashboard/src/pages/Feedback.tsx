import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { EmojiFunnyCircleIcon as Love, SadCircleIcon as Unhappy, SmileCircleIcon as Okay } from '@solar-icons/react/linear';
import { useState, type ComponentType } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '../components/ErrorAlert';
import { Pager, StatusFilter } from '../components/ListControls';
import { initial, num, PageHeader } from '../components/PageHeader';
import { api, type MerchantMood } from '../lib/api';

const PAGE_SIZE = 20;
const ALL = 'all';

const MOODS: Record<MerchantMood, { label: string; icon: ComponentType<{ className?: string }>; variant: 'success' | 'muted' | 'warning' }> = {
  love: { label: 'Love it', icon: Love, variant: 'success' },
  okay: { label: "It's okay", icon: Okay, variant: 'muted' },
  unhappy: { label: 'Not happy', icon: Unhappy, variant: 'warning' },
};

const ROLES: Record<string, string> = {
  vendor_admin: 'Merchant admin',
  branch_manager: 'Branch manager',
  staff: 'Staff',
  viewer: 'Viewer',
};

/** Quick feedback merchant teams send from Get help in their dashboard, newest first. */
export function Feedback() {
  const [mood, setMood] = useState<MerchantMood | typeof ALL>(ALL);
  const [vendorId, setVendorId] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const vendors = useQuery({ queryKey: ['vendors', 'all'], queryFn: () => api.vendors() });
  const { data, isLoading, error } = useQuery({
    queryKey: ['merchant-feedback', mood, vendorId, page],
    queryFn: () =>
      api.merchantFeedback({
        mood: mood === ALL ? undefined : mood,
        vendorId: vendorId === ALL ? undefined : vendorId,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const counts = data?.moods;
  const allCount = counts ? counts.love + counts.okay + counts.unhappy + counts.none : undefined;
  const label = (text: string, n?: number) => (n === undefined ? text : `${text} · ${num(n)}`);

  return (
    <>
      <PageHeader title="Feedback" subtitle="What merchant teams tell us from Get help in their dashboard" />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <StatusFilter
            value={mood}
            onChange={(v) => {
              setMood(v);
              setPage(1);
            }}
            options={[
              { label: label('All', allCount), value: ALL },
              ...(Object.keys(MOODS) as MerchantMood[]).map((m) => ({ label: label(MOODS[m].label, counts?.[m]), value: m })),
            ]}
          />
          <Select
            value={vendorId}
            onValueChange={(v) => {
              setVendorId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-56" aria-label="Merchant">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All merchants</SelectItem>
              {vendors.data?.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ErrorAlert error={error} className="mx-4 mb-4 w-auto" />

        <div className="divide-y border-t">
          {isLoading ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            ))
          ) : !data?.items.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No feedback yet</p>
          ) : (
            data.items.map((f) => {
              const m = f.mood ? MOODS[f.mood] : null;
              return (
                <article key={f.id} className="flex gap-3 p-4">
                  <Avatar className="size-9 rounded-lg">
                    <AvatarImage src={f.vendor.logoUrl ?? undefined} alt="" />
                    <AvatarFallback className="rounded-lg bg-secondary font-semibold text-accent-foreground">{initial(f.vendor.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{f.vendor.name}</span>
                      {m ? (
                        <Badge variant={m.variant}>
                          <m.icon className="size-3.5" /> {m.label}
                        </Badge>
                      ) : null}
                      <time className="ms-auto text-xs text-muted-foreground" dateTime={f.createdAt} title={dayjs(f.createdAt).format('D MMM YYYY, HH:mm')}>
                        {dayjs(f.createdAt).format('D MMM YYYY, HH:mm')}
                      </time>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {f.staff.name} · {ROLES[f.staff.role] ?? f.staff.role} ·{' '}
                      <a href={`mailto:${f.staff.email}`} className="hover:text-foreground hover:underline">
                        {f.staff.email}
                      </a>
                    </div>
                    <p className="mt-2 text-sm break-words whitespace-pre-wrap">{f.message}</p>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
      </Card>
    </>
  );
}
