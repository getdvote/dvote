import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api, errorMessage, type BillingCycle, type PlanName, type Vendor } from '../lib/api';
import { ConfirmAction } from './ConfirmAction';

export const PLAN_LABEL: Record<PlanName, string> = { regular: 'Regular', loyal: 'Loyal', chain: 'Chain' };
const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: 'Monthly', annual: 'Annual' };
/** Same as BILLING.graceDays in the API. */
const GRACE_DAYS = 7;
const fmt = (iso: string | null | undefined) => (iso ? dayjs(iso).format('D MMM YYYY, HH:mm') : '—');

/**
 * Admin: the shop's plan. A self sign-up is on a 14-day free trial, locked after it and kept until
 * the admin activates it or deletes it here by hand (typing the shop's name). Until Paymob the admin
 * activates a paid plan after the merchant pays (paid for one period from now, covering the branches
 * given), renews the paid period when they pay again (a scheduled downgrade starts then), or extends
 * the trial. Merchants on a paid plan ask for changes on Settings → Billing; those arrive on the
 * admin Plan requests page.
 */
export function PlanCard({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<PlanName>(vendor.plan ?? 'regular');
  const [cycle, setCycle] = useState<BillingCycle>(vendor.billingCycle ?? 'monthly');
  const [founding, setFounding] = useState(vendor.founding ?? false);
  const [branches, setBranches] = useState(Math.max(1, vendor.paidBranches ?? vendor.branchCount));
  const navigate = useNavigate();
  const spots = useQuery({ queryKey: ['founding'], queryFn: api.founding });
  const trial = vendor.planStatus === 'trial';
  const ended = trial && !!vendor.trialEndsAt && Date.parse(vendor.trialEndsAt) <= Date.now();
  const noSpot = founding && !vendor.founding && (spots.data?.left ?? 0) <= 0;
  const change = useMutation({
    mutationFn: (body: Parameters<typeof api.vendorPlan>[1]) => api.vendorPlan(vendor.id, body),
    onSuccess: (_r, body) => {
      toast.success(
        body.action === 'activate'
          ? `Plan activated: ${PLAN_LABEL[body.plan]}, ${CYCLE_LABEL[body.billingCycle].toLowerCase()}, ${body.branches ?? 1} branches`
          : body.action === 'renew'
            ? 'Paid period renewed'
            : `Trial extended by ${body.days} days`,
      );
      void qc.invalidateQueries({ queryKey: ['vendor', vendor.id] });
      void qc.invalidateQueries({ queryKey: ['vendors'] });
      void qc.invalidateQueries({ queryKey: ['founding'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Plan</h2>
            {trial ? (
              <Badge variant={ended ? 'destructive' : 'secondary'}>{ended ? 'Trial ended' : 'Free trial'}</Badge>
            ) : (
              <Badge>
                {vendor.plan ? PLAN_LABEL[vendor.plan] : 'Active'}
                {vendor.billingCycle ? ` · ${CYCLE_LABEL[vendor.billingCycle]}` : ''}
              </Badge>
            )}
            {vendor.founding ? <Badge variant="outline">Launch Partner</Badge> : null}
            {vendor.selfSignup ? <span className="text-xs text-muted-foreground">Signed up by itself</span> : null}
          </div>
          {trial ? (
            <p className="text-sm text-muted-foreground">
              Trial {ended ? 'ended' : 'ends'} {fmt(vendor.trialEndsAt)}
              {ended ? ' · locked, kept until you activate or delete it' : ''}
              {vendor.plan ? ` · picked ${PLAN_LABEL[vendor.plan]} (${CYCLE_LABEL[vendor.billingCycle ?? 'monthly'].toLowerCase()})` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {vendor.paidUntil
                ? `${Date.parse(vendor.paidUntil) > Date.now() ? 'Paid until' : 'Overdue since'} ${fmt(vendor.paidUntil)} · locks ${GRACE_DAYS} days after`
                : 'Managed by dvote: no end date.'}
              {vendor.paidBranches ? ` · covers ${vendor.paidBranches} branches (${vendor.branchCount} open)` : ''}
              {vendor.nextPlan
                ? ` · moves to ${PLAN_LABEL[vendor.nextPlan]} (${CYCLE_LABEL[vendor.nextBillingCycle ?? 'monthly'].toLowerCase()}${vendor.nextPaidBranches ? `, ${vendor.nextPaidBranches} branches` : ''}) at renewal`
                : ''}
              {vendor.foundingUntil ? ` · Launch Partner discount until ${fmt(vendor.foundingUntil)}` : ''}
            </p>
          )}
          {vendor.price && vendor.plan ? <AdminPrice price={vendor.price} plan={vendor.plan} cycle={vendor.billingCycle ?? 'monthly'} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={plan} onValueChange={(v) => setPlan(v as PlanName)}>
            <SelectTrigger className="w-32" aria-label="Plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PLAN_LABEL) as PlanName[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PLAN_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
            <SelectTrigger className="w-32" aria-label="Billing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CYCLE_LABEL) as BillingCycle[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CYCLE_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            max={500}
            className="w-24"
            aria-label="Branches covered"
            title="Open branches the paid plan covers"
            value={branches}
            onChange={(e) => setBranches(Math.min(500, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
          />
          <div className="flex items-center gap-2 px-1">
            <Switch id={`founding-${vendor.id}`} checked={founding} onCheckedChange={setFounding} />
            <Label htmlFor={`founding-${vendor.id}`} className="text-sm font-normal">
              Launch Partners{spots.data && !vendor.founding ? ` (${spots.data.left} left)` : ''}
            </Label>
          </div>
          <Button
            disabled={change.isPending || noSpot}
            onClick={() => change.mutate({ action: 'activate', plan, billingCycle: cycle, founding, branches })}
          >
            {change.isPending ? <Loader2 className="animate-spin" /> : null}
            {trial ? 'Activate plan' : 'Change plan'}
          </Button>
          {ended ? <DeleteShop vendor={vendor} onDeleted={() => navigate('/merchants')} /> : null}
          {trial ? (
            <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate({ action: 'extend', days: 7 })}>
              Extend trial 7 days
            </Button>
          ) : (
            <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate({ action: 'renew' })}>
              Paid: renew {vendor.nextBillingCycle === 'annual' || (!vendor.nextPlan && vendor.billingCycle === 'annual') ? '1 year' : '1 month'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Delete an ended trial shop for good: the admin types the shop's name first. */
function DeleteShop({ vendor, onDeleted }: { vendor: Vendor; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  return (
    <ConfirmAction
      trigger={<Button variant="destructive">Delete shop permanently</Button>}
      title={`Delete ${vendor.name} for good?`}
      description={
        <span className="grid gap-3">
          <span>
            Its branches, team, rewards, customers' cards and points, history and images are deleted and can't be recovered.
            Customers with no other card are deleted too.
          </span>
          <span className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Type the shop's name to confirm</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={vendor.name} aria-label="Shop name" autoComplete="off" />
          </span>
        </span>
      }
      actionLabel="Delete permanently"
      onConfirm={async () => {
        if (name.trim() !== vendor.name.trim()) {
          toast.error("The name doesn't match.");
          throw new Error('name_mismatch');
        }
        try {
          await api.deleteVendor(vendor.id, name);
        } catch (err) {
          toast.error(errorMessage(err));
          throw err;
        }
        toast.success(`${vendor.name} was deleted`);
        void qc.invalidateQueries({ queryKey: ['vendors'] });
        onDeleted();
      }}
    />
  );
}

const egp = (n: number) => `EGP ${n.toLocaleString('en-US')}`;

/** What the shop pays and what it is made of (same as the merchant's Billing page). */
function AdminPrice({ price, plan, cycle }: { price: NonNullable<Vendor['price']>; plan: PlanName; cycle: BillingCycle }) {
  const extra = Math.max(0, price.branches - 1);
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground tabular-nums">{egp(price.monthly)} / month</span>
      {' = '}
      {PLAN_LABEL[plan]} {egp(price.base)} (1st branch included)
      {extra ? ` + ${extra} extra ${extra === 1 ? 'branch' : 'branches'} × ${egp(price.extraBranchPrice)} = ${egp(price.extraBranches)}` : ''}
      {price.foundingApplied ? ' · Launch Partner 30% off the plan' : ''}
      {cycle === 'annual' ? ` · billed ${egp(price.perPeriod)} a year` : ''}
      {' · excl. 14% VAT'}
    </p>
  );
}
