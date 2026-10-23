import { LockKeyholeMinimalisticIcon as LockIcon } from '@solar-icons/react/linear';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMe } from '../layouts/VendorLayout';
import { t } from '../i18n';
import { FEATURE_PLAN, useEntitlements, type Feature } from '../lib/entitlements';

const planName = (p: string) => t(`billing.plans.${p}.name` as never);

/** "See plans" for the merchant admin; others are told to ask them. */
function UpgradeAction({ size = 'default' }: { size?: 'sm' | 'default' }) {
  const me = useMe();
  if (me.role !== 'vendor_admin') return <p className="text-sm text-muted-foreground">{t('planLock.askAdmin')}</p>;
  return (
    <Button asChild size={size} variant="brand">
      <Link to="/settings?tab=billing">{t('planLock.seePlans')}</Link>
    </Button>
  );
}

/**
 * Shown instead of a feature the plan doesn't include: what it does, which plan has it, and the
 * way to Billing. Nothing is hidden or deleted; it works again after an upgrade.
 */
export function PlanLock({ feature, className }: { feature: Feature; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center', className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <LockIcon className="size-5" />
      </span>
      <div className="grid max-w-md gap-1">
        <p className="font-semibold">{t('planLock.title', { plan: planName(FEATURE_PLAN[feature]) })}</p>
        <p className="text-sm text-muted-foreground">{t(`planLock.features.${feature}` as never)}</p>
      </div>
      <UpgradeAction />
    </div>
  );
}

/** A one-line notice for a feature inside a page (a button or a section that is locked). */
export function PlanNotice({ feature, className }: { feature: Feature; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-sm', className)}>
      <p className="flex items-center gap-2">
        <LockIcon className="size-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="font-medium">{t('planLock.title', { plan: planName(FEATURE_PLAN[feature]) })}</span>{' '}
          <span className="text-muted-foreground">{t(`planLock.features.${feature}` as never)}</span>
        </span>
      </p>
      <UpgradeAction size="sm" />
    </div>
  );
}

/** A small "Loyal" chip with a lock, next to a locked button or menu item. */
export function PlanChip({ feature }: { feature: Feature }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <LockIcon className="size-3" />
      {planName(FEATURE_PLAN[feature])}
    </span>
  );
}

/**
 * "4 of 5 active rewards on Regular": shown when the plan has a limit. At or over it, adding is
 * blocked (the API answers plan_limit) and the note says how to get more.
 */
export function LimitNote({
  limit,
  used,
  branches = 1,
  className,
}: {
  limit: 'activeRewards' | 'staffPerBranch' | 'menuImages';
  used: number;
  /** Open branches: the team limit is per branch. */
  branches?: number;
  className?: string;
}) {
  const e = useEntitlements();
  const perUnit = e?.limits[limit];
  if (!e || perUnit === null || perUnit === undefined) return null;
  const max = limit === 'staffPerBranch' ? perUnit * Math.max(1, branches) : perUnit;
  const full = used >= max;
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm', full ? 'border border-dashed' : 'bg-muted/50', className)}>
      <p className={full ? 'font-medium' : 'text-muted-foreground'}>
        {t(`planLock.limits.${limit}` as never, { used, max, plan: planName(e.tier) })}
        {full ? ` ${t('planLock.limitReached')}` : ''}
      </p>
      {full ? <UpgradeAction size="sm" /> : null}
    </div>
  );
}
