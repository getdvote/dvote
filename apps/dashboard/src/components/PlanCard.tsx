import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, errorMessage, type PlanName, type Vendor } from '../lib/api';

const PLAN_LABEL: Record<PlanName, string> = { starter: 'Starter (1 branch)', growth: 'Growth (2 branches)', chain: 'Chain (3+ branches)' };
const fmt = (iso: string | null | undefined) => (iso ? dayjs(iso).format('D MMM YYYY, HH:mm') : '—');

/**
 * Admin: the shop's plan. A self sign-up is on a 7-day free trial (locked after it, deleted for
 * good on its deletion date); until Paymob is built the admin activates a paid plan here after
 * the merchant pays, or extends the trial.
 */
export function PlanCard({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<PlanName>(vendor.plan ?? 'starter');
  const trial = vendor.planStatus === 'trial';
  const ended = trial && !!vendor.trialEndsAt && Date.parse(vendor.trialEndsAt) <= Date.now();
  const change = useMutation({
    mutationFn: (body: Parameters<typeof api.vendorPlan>[1]) => api.vendorPlan(vendor.id, body),
    onSuccess: (_r, body) => {
      toast.success(body.action === 'activate' ? `Plan activated: ${PLAN_LABEL[body.plan]}` : `Trial extended by ${body.days} days`);
      void qc.invalidateQueries({ queryKey: ['vendor', vendor.id] });
      void qc.invalidateQueries({ queryKey: ['vendors'] });
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
              <Badge>{vendor.plan ? PLAN_LABEL[vendor.plan] : 'Active'}</Badge>
            )}
            {vendor.selfSignup ? <span className="text-xs text-muted-foreground">Signed up by itself</span> : null}
          </div>
          {trial ? (
            <p className="text-sm text-muted-foreground">
              Trial {ended ? 'ended' : 'ends'} {fmt(vendor.trialEndsAt)} · deleted for good {fmt(vendor.deleteAt)} unless activated
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Paid / managed by dvote: never deleted automatically.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={plan} onValueChange={(v) => setPlan(v as PlanName)}>
            <SelectTrigger className="w-48">
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
          <Button disabled={change.isPending} onClick={() => change.mutate({ action: 'activate', plan })}>
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
