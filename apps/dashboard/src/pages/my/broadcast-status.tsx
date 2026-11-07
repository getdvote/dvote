import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Pager } from '../../components/ListControls';
import { t } from '../../i18n';
import type { BroadcastRecipientGroup } from '../../lib/api';
import { useVendorApi } from '../../lib/vendor-workspace';

const GROUPS: BroadcastRecipientGroup[] = ['sent', 'not_in_wallet', 'skipped', 'failed', 'uncertain', 'waiting'];
const VARIANT: Record<BroadcastRecipientGroup, 'success' | 'muted' | 'warning' | 'destructive' | 'secondary'> = {
  sent: 'success',
  not_in_wallet: 'muted',
  skipped: 'warning',
  failed: 'destructive',
  uncertain: 'warning',
  waiting: 'secondary',
};
const PAGE_SIZE = 50;

/**
 * Who a broadcast reached, per customer (a campaign shows its latest send). Google gives no read
 * receipts, so "sent" means Google accepted the message for the customer's pass; whether they saw
 * it isn't known, and the panel says so.
 */
export function BroadcastStatusSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const api = useVendorApi();
  const [group, setGroup] = useState<BroadcastRecipientGroup | null>(null);
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = useQuery({
    queryKey: ['broadcast-recipients', id, group, page],
    queryFn: () => api.broadcastRecipients(id!, { status: group ?? undefined, page, pageSize: PAGE_SIZE }),
    enabled: !!id,
    placeholderData: (prev) => prev,
    // keep counting while messages are still going out
    refetchInterval: (q) => (q.state.data?.counts.waiting ? 5000 : false),
  });
  const pick = (g: BroadcastRecipientGroup | null) => {
    setGroup(g);
    setPage(1);
  };

  return (
    <Sheet
      open={!!id}
      onOpenChange={(o) => {
        if (!o) {
          pick(null);
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t('broadcast.status.title')}</SheetTitle>
          <SheetDescription>
            {data ? (
              <>
                <span className="block font-medium text-foreground">{data.broadcast.title}</span>
                <span className="block">{data.broadcast.body}</span>
                <span className="mt-1 block text-xs">{t('broadcast.status.sentAt', { date: dayjs(data.broadcast.sentAt).format('D MMMM YYYY, HH:mm') })}</span>
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          <ErrorAlert error={error} />
          {isLoading || !data ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <CountTile label={t('broadcast.status.all')} value={data.recipients} active={group === null} onClick={() => pick(null)} />
                {GROUPS.map((g) =>
                  data.counts[g] || g === 'sent' ? (
                    <CountTile key={g} label={t(`broadcast.status.groups.${g}`)} value={data.counts[g]} active={group === g} onClick={() => pick(g)} />
                  ) : null,
                )}
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t('broadcast.status.seenNote')}</p>
              {group ? <p className="text-xs text-muted-foreground">{t(`broadcast.status.meaning.${group}`)}</p> : null}
              <ul className="divide-y rounded-lg border">
                {data.items.length ? (
                  data.items.map((r) => (
                    <li key={r.cardId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name || t('broadcast.status.noName')}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {r.shortCode ?? r.cardId.slice(0, 6)}
                          {r.at ? ` · ${dayjs(r.at).format('D MMM, HH:mm')}` : ''}
                        </p>
                      </div>
                      <Badge variant={VARIANT[r.group]} className="shrink-0">
                        {r.group === 'skipped' && r.reason ? t(`broadcast.status.reasons.${reasonKey(r.reason)}`) : t(`broadcast.status.groups.${r.group}`)}
                      </Badge>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">{t('broadcast.status.empty')}</li>
                )}
              </ul>
              <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Why a message was skipped, in words. */
function reasonKey(reason: string): 'daily_limit' | 'inactive' | 'google_quota' | 'fallback' {
  return reason === 'daily_limit' || reason === 'inactive' || reason === 'google_quota' ? reason : 'fallback';
}

function CountTile({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'grid min-h-14 gap-0.5 rounded-lg border px-3 py-2 text-start transition-colors hover:bg-muted/60',
        active && 'border-primary bg-primary/5',
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value.toLocaleString('en-US')}</span>
    </button>
  );
}
