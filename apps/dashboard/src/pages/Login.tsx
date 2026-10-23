import { CheckIcon as Check, CopyIcon as Copy, EyeIcon as Eye, EyeClosedIcon as EyeOff, LoaderIcon as Loader2, LockIcon as Lock, LetterIcon as Mail, ShieldCheckIcon as ShieldCheck } from '@solar-icons/react/linear';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { BrandIllustration, BrandPattern } from '../components/BrandArt';
import { DvoteLogo } from '../components/DvoteLogo';
import { ErrorAlert } from '../components/ErrorAlert';
import { Field } from '../components/Field';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { t } from '../i18n';
import { site } from '../lib/config';
import { errorMessage } from '../lib/api';
import { useAuth, type Enrollment } from '../lib/auth';

/**
 * Sign-in for platform admins and vendor accounts: password, then the authenticator-app code (or
 * its first-time setup). Split page: the form on the left, a preview of the dashboard on the right
 * (large screens only).
 */
export function Login() {
  const { status, notice } = useAuth();
  return (
    <AuthShell>
      {notice ? <ErrorAlert error={notice} /> : null}
      {status === 'mfaVerify' ? <CodeStep /> : status === 'mfaEnroll' ? <EnrollStep /> : <PasswordStep />}
    </AuthShell>
  );
}

/** The sign-in / sign-up frame: logo and switches, the form in the middle, the dashboard picture. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-card p-3 lg:grid-cols-2">
      <div className="relative flex flex-col px-4 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <DvoteLogo height={26} markColor="var(--brand)" className="text-foreground" />
          <div className="flex gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10">
          {/* small screens have no brand panel: the welcome scene stands in */}
          <BrandIllustration name="welcome" size="sm" className="mx-auto lg:hidden" />
          {children}
        </div>
        <p className="text-center text-xs text-muted-foreground">{t('login.footer')}</p>
      </div>
      <Showcase />
    </div>
  );
}

/** The right half: an ink brand panel with a line about dvote and a tilted look at the dashboard. */
function Showcase() {
  const bars = [30, 44, 38, 52, 47, 60, 55, 70, 64, 78, 72, 90, 84, 96];
  return (
    <div className="relative isolate hidden overflow-hidden rounded-3xl bg-ink text-paper lg:block" aria-hidden>
      {/* brand moment: the kit's orbit pattern, faded out under the heading so the text stays crisp */}
      <BrandPattern name="orbit-ink" fade="top" className="-z-10 bg-[position:70%_75%] opacity-70" />
      <div className="max-w-md px-12 pt-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t('login.showcaseTitle')}</h2>
        <p className="mt-2 text-paper/75">{t('login.showcaseText')}</p>
      </div>
      {/* a small, still picture of the merchant dashboard */}
      <div className="absolute start-14 top-60 w-[760px] origin-top-left [transform:perspective(1800px)_rotateY(-12deg)_rotateX(5deg)_rotateZ(-2deg)] rtl:origin-top-right rtl:[transform:perspective(1800px)_rotateY(12deg)_rotateX(5deg)_rotateZ(2deg)]">
        <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl" dir="ltr">
          <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="ms-4 rounded-md bg-muted px-3 py-0.5 text-[10px] text-muted-foreground">merchant.dvote.co</span>
          </div>
          <div className="grid grid-cols-[150px_1fr]">
            <div className="grid content-start gap-1 border-e bg-muted/50 p-3 text-xs">
              <DvoteLogo height={14} className="mb-3 text-foreground" />
              {['Home', 'Scan', 'Rewards', 'Insights', 'Customers'].map((n, i) => (
                <span key={n} className={i === 3 ? 'rounded-md bg-foreground/[0.07] px-2 py-1.5 font-medium' : 'px-2 py-1.5 text-muted-foreground'}>
                  {n}
                </span>
              ))}
            </div>
            <div className="p-5">
              <div className="text-base font-semibold">Insights</div>
              <div className="text-[11px] text-muted-foreground">Sales with dvote · last 30 days</div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {[
                  ['Sales', '48,230 EGP', '+12%'],
                  ['Visits', '1,284', '+8%'],
                  ['Repeat rate', '46%', '+5%'],
                ].map(([k, v, d]) => (
                  <div key={k} className="rounded-xl border p-3">
                    <div className="text-[10px] text-muted-foreground">{k}</div>
                    <div className="mt-0.5 text-sm font-semibold">{v}</div>
                    <div className="text-[10px] text-success">{d}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border p-3">
                <svg viewBox="0 0 400 110" preserveAspectRatio="none" className="h-28 w-full">
                  <path d="M0 90 C40 85 60 70 100 72 S170 50 200 55 S260 30 300 34 S360 18 400 12" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M0 100 C40 98 70 92 110 94 S180 80 220 82 S290 66 330 64 S380 52 400 50" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 4" />
                </svg>
              </div>
              <div className="mt-3 flex h-24 items-end gap-2 rounded-xl border p-3">
                {bars.map((h, i) => (
                  <span key={i} className="flex-1 rounded-t-sm bg-foreground/80" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PasswordStep() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await signIn(String(f.get('email')).trim(), String(f.get('password')));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StepHeader title={t('login.title')} description={site === 'admin' ? t('login.adminDescription') : t('login.description')} />
      <div>
        <form onSubmit={submit} className="grid gap-5">
          <Field label={t('staff.email')} htmlFor="email">
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" name="email" type="email" required autoComplete="username" autoFocus className="h-10 ps-9" dir="ltr" />
            </div>
          </Field>
          <Field label={t('login.password')} htmlFor="password">
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type={show ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="h-10 px-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute end-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={show ? t('login.hide') : t('login.show')}
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </Field>
          <Link to="/set-password?forgot=1" className="-mt-4 inline-flex min-h-8 items-center justify-self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t('login.forgot')}
          </Link>
          <ErrorAlert error={error} />
          <Button type="submit" variant="brand" size="lg" className="h-11 w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t('login.continue')}
          </Button>
        </form>
        {site !== 'admin' ? (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t('login.newHere')}{' '}
            <Link to="/signup" className="font-medium text-foreground underline underline-offset-4">
              {t('login.startTrial')}
            </Link>
          </p>
        ) : null}
      </div>
    </>
  );
}

function CodeInput({ onSubmit, busy }: { onSubmit: (code: string) => void; busy: boolean }) {
  const [code, setCode] = useState('');
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onSubmit(code);
      }}
    >
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode} pattern="^\d*$" autoFocus aria-label="6-digit code">
          <InputOTPGroup className="*:data-[slot=input-otp-slot]:size-11 *:data-[slot=input-otp-slot]:text-lg">
            {Array.from({ length: 6 }, (_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button type="submit" variant="brand" size="lg" className="h-10 w-full" disabled={busy || code.length !== 6}>
        {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        Verify
      </Button>
    </form>
  );
}

function OtherAccount() {
  const { signOut } = useAuth();
  return (
    <Button variant="link" className="mt-2 w-full" onClick={() => void signOut()}>
      Use another account
    </Button>
  );
}

function CodeStep() {
  const { verifyCode } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <StepHeader title="Two-factor code" description="Open your authenticator app and type the 6-digit code for dvote." />
      <div className="grid gap-4">
        <ErrorAlert error={error} />
        <CodeInput
          busy={busy}
          onSubmit={async (code) => {
            setBusy(true);
            setError(null);
            try {
              await verifyCode(code);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        />
        <OtherAccount />
      </div>
    </>
  );
}

function EnrollStep() {
  const { startEnroll, confirmEnroll } = useAuth();
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    startEnroll().then(setEnroll, (err: unknown) => setError(errorMessage(err)));
  }, [startEnroll]);

  return (
    <>
      <StepHeader
        title="Set up two-factor sign-in"
        description="Admin accounts need an authenticator app (Google Authenticator, Microsoft Authenticator…). Scan this QR with it, then type the 6-digit code it shows."
      />
      <div className="grid gap-4">
        <div className="flex justify-center">
          {enroll ? (
            // white tile so the QR stays scannable in dark mode
            <div className="rounded-xl bg-white p-2">
              <img src={enroll.qrCode} alt="Authenticator QR code" width={180} height={180} />
            </div>
          ) : (
            <div className="flex size-[196px] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        {enroll ? (
          <p className="text-center text-xs text-muted-foreground">
            Can't scan? Enter this key:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{enroll.secret}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="ml-1 align-middle"
              aria-label="Copy key"
              onClick={() => {
                void navigator.clipboard.writeText(enroll.secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </p>
        ) : null}
        <ErrorAlert error={error} />
        <CodeInput
          busy={busy}
          onSubmit={async (code) => {
            if (!enroll) return;
            setBusy(true);
            setError(null);
            try {
              await confirmEnroll(enroll.factorId, code);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        />
        <OtherAccount />
      </div>
    </>
  );
}
