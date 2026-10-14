import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '../../components/ErrorAlert';
import type { VendorScope } from '../../lib/scope';
import { t } from '../../i18n';

/** Current reward economics, independent of historical Insights filters. */
export function GiveBackRates({ scope }: { scope: VendorScope }) {
  const rewards = useQuery({ queryKey: ['rewards', scope.key], queryFn: () => scope.rewards() });
  const rules = useQuery({ queryKey: ['rules', scope.key], queryFn: () => scope.pointRules() });
  const rule = rules.data?.find((r) => r.isActive);
  const active = rewards.data?.filter((r) => r.status === 'active') ?? [];
  const loading = rewards.isLoading || rules.isLoading;
  const error = rewards.error ?? rules.error;

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>{t('rewards.giveBack')}</CardTitle>
        <CardDescription>{t('rewards.giveBackScope')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ErrorAlert error={error} />
        {loading ? <Skeleton className="h-24 w-full" /> : error ? null : !active.length ? (
          <p className="text-sm text-muted-foreground">{t('rewards.empty')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((reward) => {
              const spend = rule ? reward.pointsCost * Number(rule.spendAmount) / rule.pointsPerSpend : null;
              const rate = reward.retailValue && spend ? Number(reward.retailValue) / spend * 100 : null;
              return (
                <div key={reward.id} className="rounded-lg border p-4">
                  <p className="font-semibold">{reward.name}</p>
                  {rate === null ? (
                    <p className="mt-2 text-sm text-muted-foreground">{t(reward.retailValue ? 'rewards.needsRule' : 'rewards.addRetail')}</p>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-bold tabular-nums">{t('rewards.percentBack', { rate: rate.toFixed(1) })}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{t('rewards.spendForReward', {
                        points: reward.pointsCost,
                        amount: spend!.toLocaleString('en-US', { maximumFractionDigits: 2 }),
                        currency: scope.currency,
                      })}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t('rewards.giveBackHint')}</p>
      </CardContent>
    </Card>
  );
}
