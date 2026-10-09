import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Ban, CircleCheck, Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmAction } from '../components/ConfirmAction';
import { ErrorAlert } from '../components/ErrorAlert';
import { Pager, SearchInput, StatusFilter } from '../components/ListControls';
import { initial, num, PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { TableState } from '../components/TableState';
import { api, errorMessage, type UserStatus } from '../lib/api';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

/** Every customer: search, filter, open one to see cards and history, block / unblock. */
export function Customers() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  // search after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', search, status, page],
    queryFn: () => api.users({ search: search || undefined, status: status === 'all' ? undefined : status, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeader title="Customers" subtitle={data ? `${num(data.total)} customers` : 'Everyone using the dvote app'} />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap gap-3 p-4">
          <SearchInput value={input} onChange={setInput} placeholder="Search name, email or phone" />
          <StatusFilter
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Blocked', value: 'blocked' },
            ]}
          />
        </div>
        <ErrorAlert error={error} className="mx-4 mb-4 w-auto" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cards</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead className="pr-4">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.items.length} colSpan={6} emptyText="No customers found" />
            {data?.items.map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setOpenId(u.id)}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={u.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-brand-soft font-semibold text-accent-foreground">{initial(u.name ?? u.email)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{u.name ?? 'No name'}</div>
                      <div className="text-xs text-muted-foreground">{u.email ?? u.phone ?? '—'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusTag status={u.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{u.cardsCount}</TableCell>
                <TableCell className="text-right tabular-nums">{num(u.pointsBalance)}</TableCell>
                <TableCell>{u.lastActivityAt ? dayjs(u.lastActivityAt).format('D MMM YYYY') : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="pr-4">{dayjs(u.createdAt).format('D MMM YYYY')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
      </Card>
      <CustomerSheet id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

const EVENT: Record<string, { label: string; variant: 'success' | 'warning' | 'brand' }> = {
  earn: { label: 'Earned', variant: 'success' },
  redeem: { label: 'Redeemed', variant: 'warning' },
  adjust: { label: 'Correction', variant: 'brand' },
};

function CustomerSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: u, isLoading } = useQuery({ queryKey: ['user', id], queryFn: () => api.user(id!), enabled: !!id });

  const setStatus = useMutation({
    mutationFn: (status: UserStatus) => api.setUserStatus(id!, status),
    onSuccess: (user) => {
      qc.setQueryData(['user', id], user);
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(user.status === 'blocked' ? 'Customer blocked' : 'Customer unblocked');
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Customer</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          {isLoading || !u ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="size-16 rounded-full" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
              <Skeleton className="h-32" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={u.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-brand-soft text-2xl font-semibold text-accent-foreground">{initial(u.name ?? u.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{u.name ?? 'No name'}</h2>
                    <StatusTag status={u.status} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{u.email ?? 'No email'}</p>
                </div>
                {u.status === 'active' ? (
                  <ConfirmAction
                    title="Block this customer?"
                    description="They can no longer use the app or collect points. Their points are kept; you can unblock them any time."
                    actionLabel="Block"
                    onConfirm={() => setStatus.mutateAsync('blocked')}
                    trigger={
                      <Button variant="destructive">
                        <Ban /> Block
                      </Button>
                    }
                  />
                ) : (
                  <Button variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
                    {setStatus.isPending ? <Loader2 className="animate-spin" /> : <CircleCheck />} Unblock
                  </Button>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm">
                <Detail label="Phone">{u.phone ?? '—'}</Detail>
                <Detail label="Gender">{u.gender ? u.gender[0].toUpperCase() + u.gender.slice(1) : '—'}</Detail>
                <Detail label="Birthday">{u.birthDate ? dayjs(u.birthDate).format('D MMM YYYY') : '—'}</Detail>
                <Detail label="Joined">{dayjs(u.createdAt).format('D MMM YYYY')}</Detail>
                <Detail label="Points held">{num(u.pointsBalance)}</Detail>
                <Detail label="Cards">{u.cardsCount}</Detail>
              </dl>

              <section>
                <h3 className="mb-2 font-semibold">Cards</h3>
                {u.cards.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No cards yet</p>
                ) : (
                  <ul className="divide-y">
                    {u.cards.map((c) => (
                      <li key={c.vendorName} className="flex items-center gap-3 py-3">
                        <Avatar className="size-9">
                          <AvatarImage src={c.vendorLogoUrl ?? undefined} alt="" />
                          <AvatarFallback>{initial(c.vendorName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{c.vendorName}</div>
                          <div className="text-xs text-muted-foreground">
                            {num(c.lifetimePoints)} earned in total · last visit {dayjs(c.lastActivityAt).format('D MMM')}
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums">{num(c.balance)} pts</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 font-semibold">Recent activity</h3>
                {u.events.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No activity yet</p>
                ) : (
                  <ul className="divide-y">
                    {u.events.map((e, i) => {
                      const t = EVENT[e.type] ?? EVENT.adjust;
                      return (
                        <li key={i} className="flex items-center gap-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant={t.variant}>{t.label}</Badge>
                              <span>
                                {e.vendorName}
                                {e.branchName ? ` · ${e.branchName}` : ''}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {[e.purchaseAmount ? `Bill ${e.purchaseAmount}` : null, e.rewardName, e.reason, dayjs(e.createdAt).format('D MMM YYYY, HH:mm')]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                          <span className={cn('font-semibold tabular-nums', e.delta > 0 && 'text-success')}>
                            {e.delta > 0 ? '+' : ''}
                            {num(e.delta)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
