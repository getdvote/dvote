import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, SmartphoneIcon } from '@solar-icons/react/linear';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorAlert } from '../../components/ErrorAlert';
import { t, useI18n } from '../../i18n';
import type { PairingCreated, ScannerPairing } from '../../lib/api';
import { config } from '../../lib/config';
import { useVendorApi, useWorkspace } from '../../lib/vendor-workspace';

const QUERY_KEY = ['scanner-pairings'];
const POLL_OPEN_MS = 3_000;
const POLL_IDLE_MS = 30_000;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Pair a phone + the Paired phones list, on the Scan page. Not offered in the dvote team's workspace. */
export function PairPhone({ branchId }: { branchId: string | null }) {
  const workspace = useWorkspace();
  const vendorApi = useVendorApi();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: vendorApi.scannerPairings,
    enabled: !workspace,
    refetchInterval: open ? POLL_OPEN_MS : POLL_IDLE_MS,
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => vendorApi.disconnectPairing(id),
    onSuccess: () => {
      toast.success(t('pair.disconnected'));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  if (workspace) return null;
  const phones = (rows ?? []).filter((r) => r.state !== 'pending');

  return (
    <div className="mt-4 grid gap-4">
      <Button variant="outline" size="lg" className="w-full" disabled={!branchId} data-testid="pair-open" onClick={() => setOpen(true)}>
        <SmartphoneIcon /> {t('pair.open')}
      </Button>

      {phones.length ? (
        <section data-testid="paired-phones" className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-medium">{t('pair.phones')}</h2>
          <ErrorAlert className="m-3" error={disconnect.error} />
          <ul className="divide-y">
            {phones.map((p) => (
              <PhoneRow key={p.id} phone={p} busy={disconnect.isPending} onDisconnect={() => disconnect.mutate(p.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      {open && branchId ? <PairDialog branchId={branchId} rows={rows ?? []} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function PhoneRow({ phone, busy, onDisconnect }: { phone: ScannerPairing; busy: boolean; onDisconnect: () => void }) {
  const { language } = useI18n();
  const name = phone.deviceLabel ?? t('pair.phone');
  const time = phone.sessionExpiresAt
    ? new Date(phone.sessionExpiresAt).toLocaleTimeString(language === 'ar' ? 'ar-u-nu-latn' : 'en', { hour: 'numeric', minute: '2-digit' })
    : '';
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {name}
          <Badge variant={phone.state === 'paused' ? 'warning' : 'success'}>{t(phone.state === 'paused' ? 'pair.paused' : 'pair.active')}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{t('pair.activeUntil', { name: phone.staffName, branch: phone.branchName, time })}</div>
        {phone.pauseReason ? <div className="text-sm text-muted-foreground">{t(`pair.pausedReason.${phone.pauseReason}`)}</div> : null}
      </div>
      <Button variant="outline" size="sm" disabled={busy} aria-label={t('pair.disconnect')} title={t('pair.disconnectLabel', { name })} onClick={onDisconnect}>
        {t('pair.disconnect')}
      </Button>
    </li>
  );
}

function PairDialog({ branchId, rows, onClose }: { branchId: string; rows: ScannerPairing[]; onClose: () => void }) {
  const vendorApi = useVendorApi();
  const qc = useQueryClient();
  const [pairing, setPairing] = useState<PairingCreated | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [seenId, setSeenId] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => vendorApi.createPairing(branchId),
    onSuccess: (p) => {
      setPairing(p);
      setSecondsLeft(p.expiresInSeconds);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const { mutate } = create;
  useEffect(() => mutate(), [mutate]);

  useEffect(() => {
    if (!pairing) return;
    const endsAt = Date.now() + pairing.expiresInSeconds * 1000;
    const timer = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  const row = rows.find((r) => r.id === pairing?.id);
  const connected = !!row && row.state !== 'pending';
  useEffect(() => {
    if (row) setSeenId(row.id);
  }, [row]);
  // a pending code that left the list was cancelled by 5 wrong tries, or ran out
  const cancelled = !!pairing && seenId === pairing.id && !row;
  const expired = !!pairing && !connected && (secondsLeft === 0 || cancelled);

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pair.title')}</DialogTitle>
          <DialogDescription>{t('pair.description')}</DialogDescription>
        </DialogHeader>

        <ErrorAlert error={create.error} />

        {connected && pairing ? (
          <div className="grid justify-items-center gap-2 py-6 text-center">
            <CheckCircleIcon className="size-10 text-success" aria-hidden />
            <p className="text-lg font-medium">{t('pair.connected')}</p>
            <p className="text-sm text-muted-foreground">{t('pair.connectedHint', { branch: pairing.branchName })}</p>
          </div>
        ) : expired ? (
          <div className="grid justify-items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t('pair.expired')}</p>
            <Button variant="brand" disabled={create.isPending} onClick={() => create.mutate()}>
              {t('pair.newCode')}
            </Button>
          </div>
        ) : pairing ? (
          <div className="grid gap-5">
            <div className="grid justify-items-center gap-3">
              <p className="text-sm font-medium">{t('pair.stepScan')}</p>
              <QrImage secret={pairing.secret} />
            </div>
            <div className="grid justify-items-center gap-1 text-center">
              <p className="text-sm font-medium">{t('pair.stepCode')}</p>
              <p dir="ltr" data-testid="pair-code" className="text-3xl font-semibold tracking-widest tabular-nums">
                {spaced(pairing.code)}
              </p>
              <p data-testid="pair-countdown" className="text-sm text-muted-foreground">
                {t('pair.expiresIn', { time: clock(secondsLeft) })}
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">{t('pair.branch', { branch: pairing.branchName })}</p>
          </div>
        ) : null}

        {connected ? (
          <DialogFooter>
            <Button variant="brand" onClick={onClose}>
              {t('pair.done')}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function QrImage({ secret }: { secret: string }) {
  const value = `${config.merchantUrl || window.location.origin}/pair#${secret}`;
  return (
    <div data-testid="pair-qr" data-value={value} className="rounded-xl bg-white p-3">
      <QRCodeSVG value={value} size={176} level="M" marginSize={0} />
    </div>
  );
}
