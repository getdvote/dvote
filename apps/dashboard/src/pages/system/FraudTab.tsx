import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Ban, Check, Loader2, Play, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ErrorAlert } from '../../components/ErrorAlert';
import { num } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { api, errorMessage, type FraudFlag, type FraudStatus, type FraudType } from '../../lib/api';

const TYPE: Record<FraudType, { label: string; hint: string }> = {
  too_many_collects: { label: 'Too many collects', hint: 'One customer collected more than 3 times in a day at one shop' },
  large_purchase: { label: 'Large purchase', hint: 'A bill more than 5× the branch’s usual bill' },
  branch_spike: { label: 'Branch spike', hint: 'A branch gave more than 3× its usual daily points' },
  staff_spike: { label: 'Staff spike', hint: 'A staff member gave more than 3× their usual daily points' },
};
const TYPES = Object.keys(TYPE) as FraudType[];
const STATUS_TONE: Record<FraudStatus, string> = {
  open: 'bg-warning/15 text-warning',
  confirmed: 'bg-destructive/15 text-destructive',
  dismissed: 'bg-muted text-muted-foreground',
};

/** One sentence about what the check found, from the flag's details. */
function finding(f: FraudFlag): string {
  const d = f.details as Record<string, string | number | undefined>;
  const day = d.day ? dayjs(String(d.day)).format('D MMM YYYY') : '';
  switch (f.type) {
    case 'too_many_collects':
      return `${d.collects} collects (${num(Number(d.points))} points) on ${day}, limit ${d.limit} a day`;
    case 'large_purchase':
      return `Bill of ${Number(d.amount).toLocaleString('en-US')} (${num(Number(d.points))} points) on ${day}; usual bill ≈ ${Number(d.average).toLocaleString('en-US')} over ${d.bills30d} bills`;
    default:
      return `${num(Number(d.points))} points on ${day}; usual ≈ ${d.dailyAverage} a day`;
  }
}

/**
 * System → Fraud & risk: what the fraud check (every 15 minutes) found, for a platform admin to
 * review. A flag never blocks anyone; confirming one is a note, and blocking a customer is a
 * separate, deliberate action here.
 */
export function FraudTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<FraudStatus | 'all'>('open');
  const [type, setType] = useState<FraudType | 'all'>('all');
  const [reviewing, setReviewing] = useState<{ flag: FraudFlag; to: FraudStatus } | null>(null);

  const summary = useQuery({ queryKey: ['fraud', 'summary'], queryFn: api.fraudSummary, staleTime: Infinity, refetchOnWindowFocus: false });
  const flags = useQuery({
    queryKey: ['fraud', 'flags', status, type],
    queryFn: () => api.fraudFlags({ status: status === 'all' ? undefined : status, type: type === 'all' ? undefined : type, pageSize: 100 }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['fraud'] });

  const check = useMutation({
    mutationFn: api.runFraudCheck,
    onSuccess: (r) => {
      toast.success(r.created ? `${r.created} new flag${r.created > 1 ? 's' : ''} found` : 'Check done: nothing new');
      refresh();
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const block = useMutation({
    mutationFn: (userId: string) => api.setUserStatus(userId, 'blocked'),
    onSuccess: (u) => {
      toast.success(`${u.name ?? 'Customer'} is blocked`);
      refresh();
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  const s = summary.data;
  return (
    <div className="grid gap-5">
      <ErrorAlert error={summary.error ?? flags.error} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <Card className={s && s.open > 0 ? 'bg-warning/10' : undefined}>
          <CardContent className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Open flags</div>
              <div className="text-2xl font-bold tabular-nums">{s ? num(s.open) : '—'}</div>
              <div className="text-xs text-muted-foreground">{s ? `${num(s.last7d)} new in 7 days` : ''}</div>
            </div>
          </CardContent>
        </Card>
        {TYPES.map((t) => (
          <Card key={t}>
            <CardContent>
              <div className="text-sm font-medium text-muted-foreground">{TYPE[t].label}</div>
              <div className="text-2xl font-bold tabular-nums">{s ? num(s.openByType[t] ?? 0) : '—'}</div>
              <div className="text-xs text-muted-foreground">{TYPE[t].hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" variant="outline" value={status} onValueChange={(v) => v && setStatus(v as FraudStatus | 'all')} aria-label="Status">
            {(['open', 'confirmed', 'dismissed', 'all'] as const).map((v) => (
              <ToggleGroupItem key={v} value={v} className="px-3 capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {v}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={type} onValueChange={(v) => setType(v as FraudType | 'all')}>
            <SelectTrigger className="w-52" aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {s?.lastCheckAt ? `Last check ${dayjs(s.lastCheckAt).format('D MMM, HH:mm')} · runs every 15 min` : 'Runs every 15 min'}
          </span>
          <Button variant="outline" size="sm" disabled={check.isPending} onClick={() => check.mutate()}>
            {check.isPending ? <Loader2 className="animate-spin" /> : <Play />} Run check now
          </Button>
        </div>
      </div>

      {flags.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !flags.data?.items.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {status === 'open' ? 'No open flags. Nothing needs a look right now.' : 'No flags here.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {flags.data.items.map((f) => (
            <Card key={f.id}>
              <CardContent className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-semibold">
                        {TYPE[f.type].label}
                      </Badge>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[f.status]}`}>{f.status}</span>
                      <span className="text-xs text-muted-foreground">Found {dayjs(f.createdAt).format('D MMM, HH:mm')}</span>
                    </div>
                    <div className="mt-1.5 font-medium">{finding(f)}</div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {f.vendor ? <span>Shop: {f.vendor.name}</span> : null}
                      {f.branch ? <span>Branch: {f.branch.name}</span> : null}
                      {f.staff ? <span>Staff: {f.staff.name}</span> : null}
                      {f.user ? (
                        <span className="inline-flex items-center gap-1.5">
                          Customer: {f.user.name}
                          {f.user.email ? ` (${f.user.email})` : ''}
                          {f.user.status === 'blocked' ? <StatusTag status="blocked" /> : null}
                        </span>
                      ) : null}
                    </div>
                    {f.details.review ? (
                      <div className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                        {f.reviewedBy ? <span className="font-medium">{f.reviewedBy.name}</span> : 'Reviewed'}
                        {` · ${dayjs(f.details.review.at).format('D MMM, HH:mm')}`}
                        {f.details.review.note ? `: ${f.details.review.note}` : ''}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {f.status === 'open' ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => setReviewing({ flag: f, to: 'confirmed' })}>
                          <Check /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setReviewing({ flag: f, to: 'dismissed' })}>
                          <X /> Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setReviewing({ flag: f, to: 'open' })}>
                        <RotateCcw /> Reopen
                      </Button>
                    )}
                    {f.user && f.user.status === 'active' ? (
                      <ConfirmAction
                        title={`Block ${f.user.name}?`}
                        description="They can no longer use the app, collect or redeem points. Their points stay; you can unblock them on the Customers page."
                        actionLabel="Block customer"
                        onConfirm={() => block.mutateAsync(f.user!.id)}
                        trigger={
                          <Button size="sm" variant="outline" className="text-destructive">
                            <Ban /> Block customer
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {flags.data.total > flags.data.items.length ? (
            <p className="text-sm text-muted-foreground">Showing the newest {flags.data.items.length} of {num(flags.data.total)}.</p>
          ) : null}
        </div>
      )}

      <ReviewDialog value={reviewing} onClose={() => setReviewing(null)} onDone={refresh} />
    </div>
  );
}

function ReviewDialog({ value, onClose, onDone }: { value: { flag: FraudFlag; to: FraudStatus } | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => api.reviewFraudFlag(value!.flag.id, { status: value!.to, note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success(value!.to === 'confirmed' ? 'Flag confirmed' : value!.to === 'dismissed' ? 'Flag dismissed' : 'Flag reopened');
      setNote('');
      onClose();
      onDone();
    },
  });
  const title = value?.to === 'confirmed' ? 'Confirm this flag' : value?.to === 'dismissed' ? 'Dismiss this flag' : 'Reopen this flag';
  return (
    <Dialog
      open={value !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          save.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {value?.to === 'confirmed'
              ? 'A real problem. Nothing is blocked automatically: block the customer separately if needed.'
              : value?.to === 'dismissed'
                ? 'A false alarm (e.g. a large office order).'
                : 'It goes back to the open list.'}
          </DialogDescription>
        </DialogHeader>
        {value?.to !== 'open' ? (
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Note (optional): what you checked, who you called…" />
        ) : null}
        <ErrorAlert error={save.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={value?.to === 'confirmed' ? 'destructive' : 'default'} disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {value?.to === 'confirmed' ? 'Confirm' : value?.to === 'dismissed' ? 'Dismiss' : 'Reopen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
