import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DvoteLogo } from '../components/DvoteLogo';
import { ErrorAlert } from '../components/ErrorAlert';
import { Field } from '../components/Field';
import { LanguageToggle } from '../components/LanguageToggle';
import { supabase } from '../lib/supabase';
import { t } from '../i18n';

/** Read when the page opens (not when the app loads: "Forgot password?" is an in-app link). */
function readLink() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return {
    invalidLink: hash.has('error'),
    /** Opened from a "Reset password" email (vs. an invitation). */
    fromReset: hash.get('type') === 'recovery',
    /** Opened from "Forgot password?" on the sign-in page. */
    forgot: new URLSearchParams(window.location.search).has('forgot'),
  };
}

/**
 * /set-password: choose a password from an invitation or a reset email (Supabase consumes the
 * link's fragment; credentials never go to our API), or, with no valid link (or ?forgot=1 from the
 * sign-in page), ask for a reset email. Supabase answers the same whether or not the email exists.
 */
export function SetPassword() {
  const [{ invalidLink, fromReset, forgot }] = useState(readLink);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(t('passwordSetup.expired'));
      setEmail(invalidLink ? null : data.session?.user.email ?? null);
      setLoading(false);
      // Remove tokens/error details from the visible address after the SDK has processed them.
      window.history.replaceState(null, '', window.location.pathname);
    }).catch(() => { if (active) { setError(t('passwordSetup.expired')); setLoading(false); } });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    if (password !== confirm) { setError(t('passwordSetup.mismatch')); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Reload the auth provider with this invited account and resolve its merchant access.
      window.location.replace('/');
    } catch (error) { setError(error instanceof Error ? error.message : t('passwordSetup.failed')); setBusy(false); }
  };
  const recover = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setBusy(true);
    try {
      // back to this page on this dashboard (allowed under Supabase → Authentication → URL Configuration)
      const redirectTo = `${window.location.origin}/set-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : t('passwordSetup.failed')); }
    finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-muted p-5">
    <section className="grid w-full max-w-md gap-5 rounded-2xl border bg-card p-7 shadow-sm">
      <div className="flex items-center justify-between"><DvoteLogo height={26} markColor="var(--brand)" /><LanguageToggle /></div>
      <h1 className="text-2xl font-semibold">
        {email ? t(fromReset ? 'passwordSetup.newTitle' : 'passwordSetup.title') : forgot ? t('passwordSetup.forgotTitle') : t('passwordSetup.title')}
      </h1>
      {loading ? <p>{t('passwordSetup.loading')}</p> : email ? <>
        <p className="text-sm text-muted-foreground">{t('passwordSetup.forEmail')} <bdi>{email}</bdi></p>
        <form onSubmit={e => void submit(e)} className="grid gap-4">
          <Field htmlFor="setup-password" label={t('passwordSetup.password')} hint={t('passwordSetup.hint')}><Input id="setup-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></Field>
          <Field htmlFor="setup-confirm" label={t('passwordSetup.confirm')}><Input id="setup-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
          <Button disabled={busy}>{t('passwordSetup.save')}</Button>
        </form>
      </> : <>
        <p className="text-sm text-muted-foreground">{forgot ? t('passwordSetup.forgotText') : t('passwordSetup.expired')}</p>
        {sent ? <p role="status">{t('passwordSetup.sent')}</p> : <form onSubmit={e => void recover(e)} className="grid gap-4">
          <Field htmlFor="setup-email" label={forgot ? t('passwordSetup.forgotEmail') : t('passwordSetup.email')}><Input id="setup-email" type="email" autoComplete="email" required value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} /></Field>
          <Button disabled={busy}>{forgot ? t('passwordSetup.forgotRequest') : t('passwordSetup.request')}</Button>
        </form>}
      </>}
      <ErrorAlert error={error} />
      <Link to="/" className="text-sm text-muted-foreground underline">{t('passwordSetup.back')}</Link>
    </section>
  </main>;
}
