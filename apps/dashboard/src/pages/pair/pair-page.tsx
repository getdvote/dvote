import { useQuery } from '@tanstack/react-query';
import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DvoteLogo } from '../../components/DvoteLogo';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { LanguageToggle } from '../../components/LanguageToggle';
import { t } from '../../i18n';
import { ApiError, claimPairing, createVendorApi, errorMessage } from '../../lib/api';
import { deviceLabel, normalizeCode, pairSecret, scannerSession } from '../../lib/scanner-session';
import { VendorWorkspaceProvider } from '../../lib/vendor-workspace';
import { MyTill } from '../my/MyTill';

const PAUSE_CODES = ['vendor_suspended', 'trial_ended', 'subscription_expired', 'branch_closed'] as const;
type PauseCode = (typeof PAUSE_CODES)[number];
const END_REASONS = ['disconnected', 'expired', 'ended_by_phone', 'staff_disabled', 'role_changed', 'branch_changed'] as const;
type EndReason = (typeof END_REASONS)[number];

/** How soon the phone notices a Disconnect or a lock clearing, with nobody touching it. */
const CHECK_SESSION_MS = 5_000;

/** A short reason from the API, or `unknown` for one this build doesn't know. */
const endReason = (value: unknown): EndReason | 'unknown' =>
  END_REASONS.includes(value as EndReason) ? (value as EndReason) : 'unknown';

function Frame({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <DvoteLogo height={24} />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {action}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

function Message({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-sm gap-3 py-10 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <div className="grid gap-2 text-sm text-muted-foreground">{children}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * /pair, a phone paired from the Scan page. No sign-in: a QR's secret plus the 6 digits buy a session
 * that can only scan. Reuses the dashboard's Scan page on a client that sends that session.
 */
export function PairPage() {
  const [secret, setSecret] = useState<string | null>(() => pairSecret.take());
  const [token, setToken] = useState<string | null>(() => scannerSession.get());
  const [ended, setEnded] = useState<EndReason | 'unknown' | null>(null);

  const finish = (reason: EndReason | 'unknown') => {
    scannerSession.clear();
    setToken(null);
    setEnded(reason);
  };

  if (secret) {
    return (
      <Frame>
        <CodeEntry
          secret={secret}
          onBack={
            token
              ? () => {
                  pairSecret.clear();
                  setSecret(null);
                }
              : undefined
          }
          onPaired={(next) => {
            // a QR scanned on a phone that was already paired replaces that session
            const previous = scannerSession.get();
            if (previous && previous !== next) void createVendorApi('/api/vendor', { token: () => previous }).endScannerSession().catch(() => undefined);
            scannerSession.set(next);
            pairSecret.clear();
            setEnded(null);
            setToken(next);
            setSecret(null);
          }}
        />
      </Frame>
    );
  }
  if (token) return <PhoneScanner key={token} token={token} onEnded={finish} />;
  if (ended) {
    return (
      <Frame>
        <Message title={t('pair.sessionEnded')}>
          <p>{t(`pair.ended.${ended}`)}</p>
          <p>{t('pair.pairAgain')}</p>
        </Message>
      </Frame>
    );
  }
  return (
    <Frame>
      <Message title={t('pair.needQrTitle')}>
        <p>{t('pair.needQr')}</p>
      </Message>
    </Frame>
  );
}

function CodeEntry({ secret, onPaired, onBack }: { secret: string; onPaired: (token: string) => void; onBack?: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  const send = async (code: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const { sessionToken } = await claimPairing({ secret, code, deviceLabel: deviceLabel(navigator.userAgent) });
      onPaired(sessionToken);
    } catch (err) {
      setError(errorMessage(err));
      // a wrong code needs typing again; after a lost connection, Connect retries the same one
      if (err instanceof ApiError && err.code === 'pairing_invalid') setValue('');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const change = (text: string) => {
    setValue(text);
    const code = normalizeCode(text);
    if (code.length === 6) void send(code);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeCode(value);
    if (code.length !== 6) return setError(t('pair.badCode'));
    void send(code);
  };

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-sm gap-4 py-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t('pair.enterTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pair.enterHint')}</p>
      </div>
      <Field label={t('pair.codeLabel')} htmlFor="pair-code-input">
        <Input
          id="pair-code-input"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={value}
          maxLength={16}
          onChange={(e) => change(e.target.value)}
          className="h-12 text-center text-2xl tracking-widest tabular-nums"
        />
      </Field>
      <ErrorAlert error={error} />
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {t('pair.connect')}
      </Button>
      {/* a phone that's already paired, opened from an old QR: its session is still good */}
      {onBack ? (
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={onBack}>
          {t('pair.backToScanner')}
        </Button>
      ) : null}
    </form>
  );
}

function PhoneScanner({ token, onEnded }: { token: string; onEnded: (reason: EndReason | 'unknown') => void }) {
  const [paused, setPaused] = useState<PauseCode | null>(null);

  const client = useMemo(
    () =>
      createVendorApi('/api/vendor', {
        token: () => token,
        onError: (err: ApiError) => {
          if (err.code === 'scanner_session_ended') onEnded(endReason(err.details.reason));
          else if (PAUSE_CODES.includes(err.code as PauseCode)) setPaused(err.code as PauseCode);
        },
      }),
    // onEnded only touches this page's state, and the client must stay the same for a token
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  const me = useQuery({
    queryKey: ['scanner', 'me', token],
    queryFn: client.scannerMe,
    retry: false,
    refetchInterval: CHECK_SESSION_MS,
  });

  const { isSuccess, dataUpdatedAt } = me;
  useEffect(() => {
    if (isSuccess) setPaused(null);
  }, [isSuccess, dataUpdatedAt]);

  const endSession = async () => {
    await client.endScannerSession().catch(() => undefined);
    onEnded('ended_by_phone');
  };
  const end = (
    <Button variant="outline" size="sm" onClick={() => void endSession()}>
      {t('pair.endSession')}
    </Button>
  );
  const retry = (
    <Button variant="brand" disabled={me.isFetching} onClick={() => void me.refetch()}>
      {t('pair.tryAgain')}
    </Button>
  );

  if (paused) {
    return (
      <Frame action={end}>
        <Message title={t('pair.pausedTitle')} action={retry}>
          <p>{t(`pair.pausedReason.${paused}`)}</p>
          <p>{t('pair.pausedHint')}</p>
        </Message>
      </Frame>
    );
  }
  if (me.data) {
    return (
      <Frame action={end}>
        <VendorWorkspaceProvider client={client} me={me.data}>
          <MyTill phone />
        </VendorWorkspaceProvider>
      </Frame>
    );
  }
  if (me.isError) {
    return (
      <Frame action={end}>
        <Message title={t('pair.offlineTitle')} action={retry}>
          <ErrorAlert error={me.error} />
          <p>{t('pair.offlineHint')}</p>
        </Message>
      </Frame>
    );
  }
  return (
    <Frame>
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    </Frame>
  );
}
