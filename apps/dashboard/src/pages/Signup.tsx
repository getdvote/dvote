import { LetterIcon as Mail, LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { useCallback, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorAlert } from '../components/ErrorAlert';
import { Field } from '../components/Field';
import { t } from '../i18n';
import { config } from '../lib/config';
import { toEgyptianMobile } from '../lib/phone';
import { api, errorMessage, type BillingCycle, type PlanName } from '../lib/api';
import { Turnstile } from '../components/Turnstile';
import { AuthShell, StepHeader } from './Login';

/**
 * merchant.dvote.co/signup ("Get started" on dvote.co): a new merchant creates an email +
 * password account. Supabase emails a confirmation link; opening it signs them in on this
 * dashboard, which then opens their shop from the details below (auth.tsx openSignupShop) on a
 * 14-day free trial with every merchant-admin feature. `?plan=regular|loyal|chain&cycle=monthly|annual`
 * (from dvote.co/pricing) is passed along and kept on the trial shop.
 */
const PLANS: readonly PlanName[] = ['regular', 'loyal', 'chain'];
const CYCLES: readonly BillingCycle[] = ['monthly', 'annual'];

export function Signup() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const onToken = useCallback((token: string | null) => setCaptcha(token), []);
  const [params] = useSearchParams();
  const plan = PLANS.find((p) => p === params.get('plan'));
  const billingCycle = CYCLES.find((c) => c === params.get('cycle'));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ownerName = String(f.get('ownerName')).trim();
    const shopName = String(f.get('shopName')).trim();
    const email = String(f.get('email')).trim().toLowerCase();
    const password = String(f.get('password'));
    const phone = toEgyptianMobile(String(f.get('phone')));
    if (!phone) return setError(t('signup.badPhone'));
    if (config.turnstileSiteKey && !captcha) return setError(t('signup.captcha'));
    setBusy(true);
    setError(null);
    try {
      // through the API (captcha checked there): it creates the account, marked as a dvote
      // sign-up, and Supabase emails the confirmation link back to this dashboard
      await api.merchantSignup({
        ownerName,
        shopName,
        email,
        password,
        phone,
        captchaToken: captcha ?? undefined,
        redirectTo: `${window.location.origin}/`,
        plan,
        billingCycle: plan ? billingCycle : undefined,
      });
      setSentTo(email);
    } catch (err) {
      setError(errorMessage(err));
      setCaptchaReset((n) => n + 1); // a captcha token works once
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell>
        <span className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Mail className="size-6" />
        </span>
        <StepHeader title={t('signup.checkTitle')} description={t('signup.checkText', { email: sentTo })} />
        <p className="text-sm text-muted-foreground">{t('signup.checkSpam')}</p>
        <p className="text-sm text-muted-foreground">{t('signup.checkAgain')}</p>
        <Link to="/" className="inline-flex min-h-8 items-center text-sm text-muted-foreground underline underline-offset-4">
          {t('signup.haveAccount')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <StepHeader title={t('signup.title')} description={t('signup.description')} />
      <form onSubmit={(e) => void submit(e)} className="grid gap-4">
        <Field label={t('signup.ownerName')} htmlFor="ownerName">
          <Input id="ownerName" name="ownerName" required minLength={2} maxLength={120} autoComplete="name" className="h-10" />
        </Field>
        <Field label={t('signup.shopName')} htmlFor="shopName">
          <Input id="shopName" name="shopName" required minLength={2} maxLength={120} autoComplete="organization" className="h-10" />
        </Field>
        <Field label={t('signup.email')} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" dir="ltr" />
        </Field>
        <Field label={t('signup.phone')} htmlFor="phone" hint={t('signup.phoneHint')}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" required maxLength={20} autoComplete="tel" placeholder="010 1234 5678" className="h-10" dir="ltr" />
        </Field>
        <Field label={t('signup.password')} htmlFor="password" hint={t('signup.passwordHint')}>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="h-10" />
        </Field>
        {config.turnstileSiteKey ? <Turnstile siteKey={config.turnstileSiteKey} onToken={onToken} resetKey={captchaReset} /> : null}
        <ErrorAlert error={error} />
        <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {t('signup.submit')}
        </Button>
        <div className="grid gap-1 text-xs text-muted-foreground">
          <p>{t('signup.agree')}</p>
          <div className="flex flex-wrap gap-x-4">
            <a href={`${config.webUrl}/terms`} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center underline underline-offset-4">
              {t('signup.terms')}
            </a>
            <a href={`${config.webUrl}/privacy`} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center underline underline-offset-4">
              {t('signup.privacy')}
            </a>
          </div>
        </div>
      </form>
      <Link to="/" className="inline-flex min-h-8 items-center text-sm text-muted-foreground underline underline-offset-4">
        {t('signup.haveAccount')}
      </Link>
    </AuthShell>
  );
}
