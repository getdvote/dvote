import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api, errorMessage, type BillingCycle, type PlanName, type Vendor } from '../lib/api';

export const PLAN_LABEL: Record<PlanName, string> = { regular: 'Regular', loyal: 'Loyal', chain: 'Chain' };
const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: 'Monthly', annual: 'Annual' };
const fmt = (iso: string | null | undefined) => (iso ? dayjs(iso).format('D MMM YYYY, HH:mm') : '—');

/**
 * Admin: the shop's plan. A self sign-up is on a 14-day free trial (locked after it, deleted for
 * good on its deletion date); until Paymob is built the admin activates a paid plan here after
 * the merchant pays, or extends the trial. A trial shop shows the plan picked on dvote.co/pricing.
 */
export function PlanCard({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<PlanName>(vendor.plan ?? 'regular');
  const [cycle, setCycle] = useState<BillingCycle>(vendor.billingCycle ?? 'monthly');
  const [founding, setFounding] = useState(vendor.founding ?? false);
  const spots = useQuery({ queryKey: ['founding'], queryFn: api.founding });
  const trial = vendor.planStatus === 'trial';
  const ended = trial && !!vendor.trialEndsAt && Date.parse(vendor.trialEndsAt) <= Date.now();
  const noSpot = founding && !vendor.founding && (spots.data?.left ?? 0) <= 0;
  const change = useMutation({
    mutationFn: (body: Parameters<typeof api.vendorPlan>[1]) => api.vendorPlan(vendor.id, body),
    onSuccess: (_r, body) => {
      toast.success(body.action === 'activate' ? `Plan activated: ${PLAN_LABEL[body.plan]}, ${CYCLE_LABEL[body.billingCycle].toLowerCase()}` : `Trial extended by ${body.days} days`);
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
            {vendor.founding ? <Badge variant="outline">Founding</Badge> : null}
            {vendor.selfSignup ? <span className="text-xs text-muted-foreground">Signed up by itself</span> : null}
          </div>
          {trial ? (
            <p className="text-sm text-muted-foreground">
              Trial {ended ? 'ended' : 'ends'} {fmt(vendor.trialEndsAt)} · deleted for good {fmt(vendor.deleteAt)} unless activated
              {vendor.plan ? ` · picked ${PLAN_LABEL[vendor.plan]} (${CYCLE_LABEL[vendor.billingCycle ?? 'monthly'].toLowerCase()})` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Paid / managed by dvote: never deleted automatically.</p>
          )}
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
          <div className="flex items-center gap-2 px-1">
            <Switch id={`founding-${vendor.id}`} checked={founding} onCheckedChange={setFounding} />
            <Label htmlFor={`founding-${vendor.id}`} className="text-sm font-normal">
              Founding{spots.data && !vendor.founding ? ` (${spots.data.left} left)` : ''}
            </Label>
          </div>
          <Button
            disabled={change.isPending || noSpot}
            onClick={() => change.mutate({ action: 'activate', plan, billingCycle: cycle, founding })}
          >
            {change.isPending ? <Loader2 className="animate-spin" /> : null}
            {trial ? 'Activate plan' : 'Change plan'}
          </Button>
          {trial ? (
            <Button variant="outline" disabled={change.isPending} onClick={() => change.mutate({ action: 'extend', days: 7 })}>
              Extend trial 7 days
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
