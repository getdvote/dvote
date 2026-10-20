import { useVendorApi, WorkspaceLink } from '../../lib/vendor-workspace';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ErrorAlert } from '../../components/ErrorAlert';
import { num } from '../../components/PageHeader';
import { rangeText } from '../../components/PeriodFilter';
import { type RewardPerformance as Performance } from '../../lib/api';
import { t } from '../../i18n';
import { Thumb } from './MyRedemptions';

/**
 * Insights section: each reward's redemptions in the period, how many customers can afford it or
 * are close to it now, and what the points customers hold are worth at the active rule.
 * Balances are merchant-wide, so a branch manager sees redemptions only (the API sends nulls).
 */
export function RewardPerformance({ query, money }: { query: { from?: string; to?: string; branchId?: string }; money: (s: string) => string }) {
  const vendorApi = useVendorApi();
  const { from, to, branchId } = query;
  const q = { from: from!, to: to!, branchId };
  const { data, isLoading, error } = useQuery({
    queryKey: ['reward-performance', 'me', q],
    queryFn: () => vendorApi.rewardPerformance(q),
    enabled: !!from && !!to,
    placeholderData: (prev) => prev,
  });
  const held = data?.held;
  const balances = !data || held !== null;

  return (
    <Card className="mb-5 gap-0 py-0">
      <CardHeader className="py-4">
        <CardTitle>{t('insights.rewards.title')}</CardTitle>
        <CardDescription>
          {data ? t(held ? 'insights.rewards.description' : 'insights.rewards.descriptionBranch', { range: rangeText(data.range) }) : ''}
        </CardDescription>
      </CardHeader>
      <ErrorAlert error={error} className="mx-6 mb-4" />

      {balances ? (
        <div className="grid border-t @md:grid-cols-2 @4xl:grid-cols-4 [&>*]:border-b @md:[&>*:nth-child(odd)]:border-e @4xl:[&>*]:border-e @4xl:[&>*:last-child]:border-e-0">
          <Stat label={t('insights.rewards.pointsHeld')} help={t('insights.rewards.help.pointsHeld')} loading={isLoading || !held}>
            {held ? (
              <>
                {num(held.points)}
                <Sub>{t('insights.rewards.holders', { count: held.customers })}</Sub>
              </>
            ) : null}
          </Stat>
          <Stat label={t('insights.rewards.worth')} help={t('insights.rewards.help.worth')} loading={isLoading || !held}>
            {held ? (
              held.worth === null || !held.rate ? (
                <Sub>{t('insights.rewards.noRule')}</Sub>
              ) : (
                <>
                  {money(held.worth)}
                  <Sub>
                    {t('insights.rewards.worthRate', {
                      spend: money(held.rate.spendAmount),
                      points: num(held.rate.pointsPerSpend),
                    })}
                  </Sub>
                </>
              )
            ) : null}
          </Stat>
          <Stat label={t('insights.rewards.ready')} help={t('insights.rewards.help.ready')} loading={isLoading || !held}>
            {held ? num(held.readyToRedeem) : null}
          </Stat>
          <Stat label={t('insights.rewards.close')} help={t('insights.rewards.help.close')} loading={isLoading || !held}>
            {held ? num(held.closeToReward) : null}
          </Stat>
        </div>
      ) : null}

      <RewardsTable data={data} balances={balances} />
    </Card>
  );
}

function RewardsTable({ data, balances }: { data: Performance | undefined; balances: boolean }) {
  if (!data) return <Skeleton className="m-6 h-32" />;
  if (!data.rewards.length)
    return (
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
        {t('insights.rewards.empty')}
        <Button variant="outline" size="sm" asChild>
          <WorkspaceLink to="/rewards">{t('emptyStates.seeRewards')}</WorkspaceLink>
        </Button>
      </CardContent>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="ps-6">{t('insights.rewards.reward')}</TableHead>
          <Head help={t('insights.rewards.help.given')}>{t('insights.rewards.given')}</Head>
          <Head help={t('insights.rewards.help.customers')} last={!balances}>
            {t('insights.rewards.customers')}
          </Head>
          {balances ? (
            <>
              <Head help={t('insights.rewards.help.canAfford')}>{t('insights.rewards.canAfford')}</Head>
              <Head help={t('insights.rewards.help.closeReward')} last>
                {t('insights.rewards.closeShort')}
              </Head>
            </>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rewards.map((r) => {
          const archived = r.status === 'archived';
          return (
            <TableRow key={r.rewardId}>
              <TableCell className="ps-6">
                <div className="flex items-center gap-3">
                  <Thumb src={r.imageUrl} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{r.name}</span>
                      {archived ? <Badge variant="secondary">{t('status.archived')}</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('insights.rewards.cost', {
                        points: num(r.pointsCost),
                      })}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-end tabular-nums">{num(r.redemptions)}</TableCell>
              <TableCell className={balances ? 'text-end tabular-nums' : 'pe-6 text-end tabular-nums'}>{num(r.customers)}</TableCell>
              {balances ? (
                <>
                  <TableCell className="text-end tabular-nums">{archived || r.canAfford === null ? '—' : num(r.canAfford)}</TableCell>
                  <TableCell className="pe-6 text-end tabular-nums">{archived || r.close === null ? '—' : num(r.close)}</TableCell>
                </>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** A number tile with its definition on hover of the dotted label (same as the Insights KPI cards). */
function Stat({ label, help, loading, children }: { label: string; help: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4">
      <Hint help={help}>{label}</Hint>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{children}</div>}
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs font-normal tracking-normal text-muted-foreground">{children}</div>;
}

function Head({ help, last, children }: { help: string; last?: boolean; children: React.ReactNode }) {
  return (
    <TableHead className={last ? 'pe-6 text-end' : 'text-end'}>
      <Hint help={help}>{children}</Hint>
    </TableHead>
  );
}

function Hint({ help, children }: { help: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help text-sm text-muted-foreground underline decoration-dotted underline-offset-4 outline-none focus-visible:text-foreground"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{help}</TooltipContent>
    </Tooltip>
  );
}
