import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmAction } from '../components/ConfirmAction';
import { ErrorAlert } from '../components/ErrorAlert';
import { Pager, StatusFilter } from '../components/ListControls';
import { num, PageHeader } from '../components/PageHeader';
import { PLAN_LABEL } from '../components/PlanCard';
import { api, errorMessage, type AdminPlanRequest, type BillingCycle, type PlanName } from '../lib/api';

const PAGE_SIZE = 20;
type Status = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all';

const KIND: Record<AdminPlanRequest['kind'], { label: string; text: string }> = {
  upgrade: { label: 'Upgrade', text: 'Starts as soon as you approve.' },
  downgrade: { label: 'Downgrade', text: 'Starts at the end of the paid period; the shop is forced down to it then.' },
  change: { label: 'Billing switch', text: 'Starts at the end of the paid period.' },
};
const STATUS: Record<Exclude<Status, 'all'>, { label: string; variant: 'warning' | 'success' | 'destructive' | 'muted' }> = {
  pending: { label: 'Waiting', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  cancelled: { label: 'Cancelled by merchant', variant: 'muted' },
};
const egp = (n: number) => `EGP ${n.toLocaleString('en-US')}`;
const plan = (p: PlanName | null, c: BillingCycle | null, branches: number | null) =>
  p ? `${PLAN_LABEL[p]} · ${c === 'annual' ? 'annual' : 'monthly'}${branches ? ` · ${branches} ${branches === 1 ? 'branch' : 'branches'}` : ''}` : 'No plan';

/**
 * Admin: merchants' plan change requests (decided 2026-11-07, until Paymob). Take the money first
 * (Visa, InstaPay, cash), then approve: an upgrade starts at once; a downgrade or billing switch at
 * the end of the shop's paid period. Rejecting changes nothing; the note is shown to the merchant.
 */
export function PlanRequests() {
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['plan-requests', status, page],
    queryFn: () => api.planRequests({ status, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeader title="Plan requests" subtitle="Merchants asking to change plan or branches. Approve after they pay." />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <StatusFilter
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { label: data ? `Waiting · ${num(data.pending)}` : 'Waiting', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' },
              { label: 'Cancelled', value: 'cancelled' },
              { label: 'All', value: 'all' },
            ]}
          />
        </div>
        <ErrorAlert error={error} className="mx-4 mb-4 w-auto" />
        <div className="divide-y border-t">
          {isLoading ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-20 w-full" />
              </div>
            ))
          ) : !data?.items.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">{status === 'pending' ? 'No requests waiting' : 'No requests'}</p>
          ) : (
            data.items.map((r) => <RequestRow key={r.id} request={r} />)
          )}
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
      </Card>
    </>
  );
}

function RequestRow({ request: r }: { request: AdminPlanRequest }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const done = (verb: string) => {
    toast.success(`${verb}: ${r.vendor.name}`);
    void qc.invalidateQueries({ queryKey: ['plan-requests'] });
    void qc.invalidateQueries({ queryKey: ['vendor', r.vendor.id] });
    void qc.invalidateQueries({ queryKey: ['vendors'] });
  };
  const approve = useMutation({ mutationFn: () => api.approvePlanRequest(r.id, note.trim() || undefined), onSuccess: () => done('Approved') });
  const reject = useMutation({ mutationFn: () => api.rejectPlanRequest(r.id, note.trim() || undefined), onSuccess: () => done('Rejected') });
  const run = async (m: typeof approve) => {
    try {
      await m.mutateAsync();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };
  const s = STATUS[r.status];
  const noteField = (placeholder: string) => (
    <span className="mt-4 grid w-full gap-1.5">
      <span className="text-sm font-medium text-foreground">Note for the merchant (optional)</span>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="w-full" placeholder={placeholder} />
    </span>
  );

  return (
    <article className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={`/merchants/${r.vendor.id}`} className="inline-flex min-h-6 max-w-full items-center font-semibold break-words hover:underline">
            {r.vendor.name}
          </Link>
          <Badge variant={s.variant}>{s.label}</Badge>
          <Badge variant="outline">{KIND[r.kind].label}</Badge>
          <time className="text-xs text-muted-foreground" dateTime={r.createdAt}>
            {dayjs(r.createdAt).format('D MMM YYYY, HH:mm')}
          </time>
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">{plan(r.from.plan, r.from.billingCycle, r.from.branches)}</span>
          <span className="px-1.5" aria-hidden>
            →
          </span>
          <span className="font-medium">{plan(r.plan, r.billingCycle, r.branches)}</span>
        </p>
        <p className="text-sm">
          {r.kind === 'upgrade' ? <span className="font-semibold tabular-nums">Collect {egp(r.amountDue)} now · </span> : null}
          <span className="text-muted-foreground">
            Then {egp(r.periodPrice)} per {r.billingCycle === 'annual' ? 'year' : 'month'}. {KIND[r.kind].text}
            {r.vendor.paidUntil ? ` Paid until ${dayjs(r.vendor.paidUntil).format('D MMM YYYY')}.` : ''}
          </span>
        </p>
        {r.keepBranches || r.keepRewards ? (
          <p className="text-xs text-muted-foreground">
            Keeps {r.keepBranches ? `${r.keepBranches} chosen branches` : ''}
            {r.keepBranches && r.keepRewards ? ' and ' : ''}
            {r.keepRewards ? `${r.keepRewards} chosen rewards` : ''}; the rest close / are archived when it starts.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {r.requestedBy ? `${r.requestedBy.name}${r.requestedBy.email ? ` · ${r.requestedBy.email}` : ''}` : ''}
          {r.vendor.phone ? ` · ${r.vendor.phone}` : ''}
          {r.reviewedBy ? ` · ${STATUS[r.status].label.toLowerCase()} by ${r.reviewedBy}` : ''}
          {r.reviewNote ? ` · “${r.reviewNote}”` : ''}
        </p>
      </div>
      {r.status === 'pending' ? (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <ConfirmAction
            trigger={<Button variant="outline">Reject</Button>}
            title={`Reject ${r.vendor.name}'s request?`}
            description={
              <span className="block w-full">
                Nothing changes for the shop. The merchant sees your note on their Billing page.
                {noteField('e.g. We didn’t receive the payment yet')}
              </span>
            }
            actionLabel="Reject"
            onConfirm={() => run(reject)}
          />
          <ConfirmAction
            trigger={<Button>Approve</Button>}
            variant="default"
            title={`Approve ${plan(r.plan, r.billingCycle, r.branches)}?`}
            description={
              <span className="block w-full">
                {r.kind === 'upgrade' ? `Approve only after ${egp(r.amountDue)} is paid. ` : ''}
                {KIND[r.kind].text}
                {noteField('e.g. Paid by InstaPay, ref 1234')}
              </span>
            }
            actionLabel="Approve"
            onConfirm={() => run(approve)}
          />
        </div>
      ) : null}
    </article>
  );
}
