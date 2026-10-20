import {
  AddIcon,
  CopyIcon,
  LinkIcon,
  MenuDotsIcon,
  PaletteIcon,
  PauseCircleIcon,
  PlayIcon,
  QrCodeIcon,
  RestartIcon,
  SettingsIcon,
  TrashBinTrashIcon,
} from '@solar-icons/react/linear';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmAction } from '../../../components/ConfirmAction';
import { ErrorAlert } from '../../../components/ErrorAlert';
import { num, PageHeader } from '../../../components/PageHeader';
import { TableState } from '../../../components/TableState';
import { t, useI18n } from '../../../i18n';
import { useMe, useMyScope, useMyVendor } from '../../../layouts/VendorLayout';
import type { LoyaltyCardInfo, LoyaltyCardStatus } from '../../../lib/api';
import { useVendorApi, WorkspaceLink } from '../../../lib/vendor-workspace';
import { QrPosterDialog } from '../qr-poster-dialog';
import { storefrontUrl } from '../storefront-editor';
import { CardFace } from './card-face';
import { CardSettingsDialog } from './card-dialogs';
import { CreateCardDialog, startColor } from './create-card-dialog';
import { defaultDesign, ltr } from '../../../lib/card-look';

const STATUS_VARIANT = {
  active: 'success',
  paused: 'warning',
  cancelled: 'muted',
} as const satisfies Record<LoyaltyCardStatus, string>;

/** Loyalty → Cards: the merchant's one card, its actions, and the first-card funnel. */
export function CardsPage() {
  const api = useVendorApi();
  const { language } = useI18n();
  const me = useMe();
  const scope = useMyScope();
  const vendor = useMyVendor();
  const isAdmin = me.role === 'vendor_admin';
  const qc = useQueryClient();
  const { data, error, isPending } = useQuery({
    queryKey: ['loyalty-card'],
    queryFn: api.loyaltyCard,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [dialog, setDialog] = useState<null | 'settings' | 'qr' | 'pause' | 'delete'>(null);

  const branches = useQuery({
    queryKey: ['branches', scope.key],
    queryFn: () => scope.branches(),
    enabled: dialog === 'qr',
  });
  const act = useMutation({
    mutationFn: (fn: () => Promise<LoyaltyCardInfo>) => fn(),
    onSuccess: (next) => qc.setQueryData(['loyalty-card'], next),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const run = (fn: () => Promise<LoyaltyCardInfo>, message: string) => act.mutateAsync(fn).then(() => toast.success(message));

  const card = data?.card ?? null;
  const url = storefrontUrl(vendor);
  const copyLink = () => {
    if (!url) return toast.error(t('cards.noLink'));
    navigator.clipboard.writeText(url).then(
      () => toast.success(t('cards.linkCopied')),
      () => toast.error(t('cards.copyFailed')),
    );
  };
  const openQr = () => (url ? setDialog('qr') : toast.error(t('cards.noLink')));
  const amount = data?.rule ? ltr(`${Number(data.rule.spendAmount)} ${vendor.currency}`) : null;

  return (
    <>
      <PageHeader
        title={t('cards.title')}
        subtitle={
          card && data
            ? t('cards.summary', {
                cards: 1,
                status: t(`cards.status.${card.status}`),
                members: t('cards.members', { count: data.counts.members }),
              })
            : t('cards.oneCard')
        }
        extra={
          isAdmin && data?.canCreate && card ? (
            <Button onClick={() => setCreateOpen(true)}>
              <AddIcon /> {t('cards.createNew')}
            </Button>
          ) : null
        }
      />
      <ErrorAlert error={error} />
      {!isAdmin ? <p className="mb-4 text-sm text-muted-foreground">{t('cards.readOnly')}</p> : null}

      {isPending ? (
        <Skeleton className="h-64 w-full max-w-3xl rounded-2xl" />
      ) : data && !card ? (
        <Card className="max-w-3xl items-center gap-5 p-8 text-center sm:flex-row sm:text-start">
          <CardFace
            design={defaultDesign(vendor.name, startColor(vendor))}
            device="iphone"
            lang={language}
            points={0}
            merchant={vendor}
            width={150}
          />
          <div className="grid gap-2">
            <h2 className="text-lg font-semibold">{t('cards.emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('cards.emptyText')}</p>
            {isAdmin ? (
              <div>
                <Button className="mt-2" onClick={() => setCreateOpen(true)}>
                  <AddIcon /> {t('cards.emptyCta')}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      ) : card && data ? (
        <div className="grid gap-5">
          <Card className="gap-0 overflow-hidden p-0">
            {card.status !== 'active' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/60 px-5 py-3 text-sm">
                <span>
                  {card.status === 'paused'
                    ? t('cards.pausedNote')
                    : data.canCreate
                      ? t('cards.cancelledExpired', {
                          date: dayjs(card.cancelledAt).format('D MMM YYYY'),
                        })
                      : t('cards.cancelledNote', {
                          date: dayjs(card.cancelledAt).format('D MMM YYYY'),
                          until: dayjs(card.restorableUntil).format('D MMM YYYY'),
                        })}
                </span>
                {isAdmin && card.status === 'paused' ? (
                  <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => run(api.resumeLoyaltyCard, t('cards.resumed'))}>
                    <PlayIcon /> {t('cards.menu.resume')}
                  </Button>
                ) : null}
                {isAdmin && card.status === 'cancelled' && !data.canCreate ? (
                  <Button size="sm" disabled={act.isPending} onClick={() => run(api.restoreLoyaltyCard, t('cards.restored'))}>
                    <RestartIcon /> {t('cards.restore')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              {/* the card itself, on a stage lit by its own colour */}
              <div
                className="relative flex items-center justify-center overflow-hidden bg-muted/50 p-8 md:border-e"
                style={data.design ? { backgroundImage: `radial-gradient(60% 55% at 50% 50%, ${data.design.colors.background}33, transparent)` } : undefined}
              >
                {data.design ? (
                  <CardFace
                    design={data.design}
                    device="iphone"
                    lang={language}
                    points={0}
                    merchant={vendor}
                    width={230}
                    className={cn('rounded-2xl shadow-xl', card.status !== 'active' && 'opacity-60 grayscale')}
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-6 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-semibold">{card.name}</h2>
                      <Badge variant={STATUS_VARIANT[card.status]} className="font-semibold">
                        <span className="size-1.5 rounded-full bg-current" aria-hidden /> {t(`cards.status.${card.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{t('cards.typePoints')}</p>
                  </div>
                  {isAdmin && card.status !== 'cancelled' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label={t('cards.more')}>
                          <MenuDotsIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-56">
                        <DropdownMenuItem onSelect={() => setDialog('settings')}>
                          <SettingsIcon /> {t('cards.menu.settings')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={copyLink}>
                          <LinkIcon /> {t('cards.menu.copyLink')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={openQr}>
                          <QrCodeIcon /> {t('cards.menu.qr')}
                        </DropdownMenuItem>
                        {card.status === 'paused' ? (
                          <DropdownMenuItem onSelect={() => run(api.resumeLoyaltyCard, t('cards.resumed'))}>
                            <PlayIcon /> {t('cards.menu.resume')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setDialog('pause')}>
                            <PauseCircleIcon /> {t('cards.menu.pause')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
                          <TrashBinTrashIcon /> {t('cards.menu.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                <dl className="grid gap-3 sm:grid-cols-3">
                  <Stat label={t('cards.hub.members')} value={num(data.counts.members)} />
                  <Stat label={t('cards.hub.active')} value={num(data.counts.active30d)} />
                  <Stat
                    label={t('cards.hub.rule')}
                    value={amount ? t('cards.hub.ruleValue', { amount }) : t('cards.hub.noRule')}
                    small
                    action={
                      isAdmin && card.status !== 'cancelled' ? (
                        <Button variant="link" size="sm" className="h-6 px-0" onClick={() => setDialog('settings')}>
                          {t('cards.hub.change')}
                        </Button>
                      ) : null
                    }
                  />
                </dl>

                {isAdmin && card.status !== 'cancelled' ? (
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button asChild>
                      <WorkspaceLink to="/card/design">
                        <PaletteIcon /> {t('cards.design')}
                      </WorkspaceLink>
                    </Button>
                    <Button variant="outline" onClick={openQr}>
                      <QrCodeIcon /> {t('cards.hub.poster')}
                    </Button>
                    <Button variant="outline" onClick={copyLink}>
                      <LinkIcon /> {t('cards.menu.copyLink')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <RecentMembers onShare={isAdmin && card.status !== 'cancelled' ? openQr : undefined} />
            <Card>
              <CardHeader>
                <CardTitle>{t('cards.hub.shareTitle')}</CardTitle>
                <CardDescription>{t('cards.hub.shareText')}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                {url ? (
                  <div className="flex gap-2">
                    <Input readOnly value={url} dir="ltr" aria-label={t('cards.menu.copyLink')} onFocus={(e) => e.currentTarget.select()} />
                    <Button variant="outline" onClick={copyLink}>
                      <CopyIcon /> {t('cards.hub.copy')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('cards.noLink')}</p>
                )}
                <div>
                  <p className="mb-3 text-sm font-medium">{t('cards.hub.stepsTitle')}</p>
                  <ol className="grid gap-3">
                    {(['scan', 'form', 'wallet'] as const).map((k, i) => (
                      <li key={k} className="flex items-center gap-3 text-sm">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                          {i + 1}
                        </span>
                        {t(`cards.hub.steps.${k}`)}
                      </li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <CreateCardDialog open={createOpen} onOpenChange={setCreateOpen} vendor={vendor} />
      {data && card ? (
        <>
          <CardSettingsDialog open={dialog === 'settings'} onOpenChange={(o) => setDialog(o ? 'settings' : null)} info={data} vendor={vendor} />

          <QrPosterDialog
            open={dialog === 'qr'}
            onOpenChange={(o) => setDialog(o ? 'qr' : null)}
            vendor={vendor}
            branches={(branches.data ?? []).filter((b) => b.status === 'active').map((b) => ({ id: b.id, name: b.name }))}
            urlFor={(id) => storefrontUrl(vendor, id)}
          />
          <ConfirmAction
            open={dialog === 'pause'}
            onOpenChange={(o) => setDialog(o ? 'pause' : null)}
            title={t('cards.pauseTitle')}
            description={t('cards.pauseText')}
            actionLabel={t('cards.menu.pause')}
            onConfirm={() => run(api.pauseLoyaltyCard, t('cards.paused'))}
          />
          <ConfirmAction
            open={dialog === 'delete'}
            onOpenChange={(o) => setDialog(o ? 'delete' : null)}
            title={t('cards.deleteTitle')}
            description={t('cards.deleteText')}
            actionLabel={t('cards.deleteAction')}
            onConfirm={() => run(api.cancelLoyaltyCard, t('cards.deleted'))}
          />
        </>
      ) : null}
    </>
  );
}

function Stat({ label, value, small, action }: { label: string; value: string; small?: boolean; action?: ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-1 font-semibold tabular-nums', small ? 'text-sm' : 'text-2xl')}>{value}</dd>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** The five newest members, with a way to get the first ones when there are none. */
function RecentMembers({ onShare }: { onShare?: () => void }) {
  const api = useVendorApi();
  const { data, isPending, error } = useQuery({
    queryKey: ['loyalty-card', 'members', 'recent'],
    queryFn: () => api.loyaltyCardMembers({ page: 1 }),
  });
  const items = data?.items.slice(0, 5) ?? [];
  const showPoints = items.some((m) => m.points !== null);
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t('cards.hub.recentTitle')}</CardTitle>
        <CardDescription>{t('cards.hub.recentText')}</CardDescription>
      </CardHeader>
      <ErrorAlert error={error} className="mx-6 mb-4 w-auto" />
      {!isPending && !items.length && !error ? (
        <div className="flex flex-col items-center gap-3 border-t px-6 py-10 text-center">
          <p className="font-medium">{t('cards.hub.emptyMembersTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('cards.hub.emptyMembersText')}</p>
          {onShare ? (
            <Button variant="outline" onClick={onShare}>
              <QrCodeIcon /> {t('cards.menu.qr')}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">{t('cards.membersDialog.name')}</TableHead>
                <TableHead>{t('cards.membersDialog.code')}</TableHead>
                <TableHead>{t('cards.membersDialog.joined')}</TableHead>
                {showPoints ? <TableHead className="pe-6 text-end">{t('cards.membersDialog.points')}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState loading={isPending} empty={false} colSpan={showPoints ? 4 : 3} emptyText="" />
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="ps-6 font-medium">{m.name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.code ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{dayjs(m.joinedAt).format('D MMM YYYY')}</TableCell>
                  {showPoints ? <TableCell className="pe-6 text-end tabular-nums">{num(m.points ?? 0)}</TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && data.total > items.length ? (
            <div className="border-t px-6 py-3">
              <Button variant="link" size="sm" className="h-6 px-0" asChild>
                <WorkspaceLink to="/customers">{t('cards.hub.viewAll')}</WorkspaceLink>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
