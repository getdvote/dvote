import { Check, Copy, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { DvoteLogo } from '../components/DvoteLogo';
import { ErrorAlert } from '../components/ErrorAlert';
import { Field } from '../components/Field';
import { ThemeToggle } from '../components/ThemeToggle';
import { errorMessage } from '../lib/api';
import { useAuth, type Enrollment } from '../lib/auth';

/** Sign-in for platform admins: password, then the authenticator-app code (or its first-time setup). */
export function Login() {
  const { status, notice } = useAuth();
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-[420px] flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-1.5">
          <DvoteLogo height={44} className="text-primary" />
          <span className="text-muted-foreground">Admin dashboard</span>
        </div>
        <Card className="w-full shadow-lg shadow-black/5">
          {notice ? (
            <div className="px-6">
              <ErrorAlert error={notice} />
            </div>
          ) : null}
          {status === 'mfaVerify' ? <CodeStep /> : status === 'mfaEnroll' ? <EnrollStep /> : <PasswordStep />}
        </Card>
        <span className="text-xs text-muted-foreground">Only dvote team accounts can sign in here.</span>
      </div>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <CardHeader>
      <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
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
      <StepHeader title="Sign in" description="Use your dvote admin email and password." />
      <CardContent>
        <form onSubmit={submit} className="grid gap-5">
          <Field label="Email" htmlFor="email">
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" name="email" type="email" required autoComplete="username" autoFocus className="h-10 pl-9" />
            </div>
          </Field>
          <Field label="Password" htmlFor="password">
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
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
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
                aria-label={show ? 'Hide password' : 'Show password'}
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </Field>
          <ErrorAlert error={error} />
          <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Continue
          </Button>
        </form>
      </CardContent>
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
      <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || code.length !== 6}>
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
      <CardContent className="grid gap-4">
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
      </CardContent>
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
      <CardContent className="grid gap-4">
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
      </CardContent>
    </>
  );
}
