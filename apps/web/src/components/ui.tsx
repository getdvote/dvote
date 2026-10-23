import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { t, useI18n } from '../i18n';
import { DvoteLogo } from './dvote-logo';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** The page frame: one white rounded card on the soft canvas, "Powered by dvote" and the language switch. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { language, setLanguage } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-4 pb-8 sm:pt-10">
      <main className={cx('w-full rounded-[28px] bg-white px-5 py-7 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:px-8', wide ? 'max-w-xl' : 'max-w-md')}>
        {children}
      </main>
      <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 whitespace-nowrap text-sm text-muted">
        <Link to="/" className="flex items-center gap-1.5 py-2 hover:text-ink">
          {t('common.poweredBy')} <DvoteMark />
        </Link>
        <span aria-hidden className="text-line">|</span>
        <button type="button" className="py-2 hover:text-ink" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>
          {t('common.switchLanguage')}
        </button>
        <span aria-hidden className="text-line">|</span>
        <Link to="/privacy" className="py-2 hover:text-ink">
          {t('common.privacy')}
        </Link>
        <Link to="/terms" className="py-2 hover:text-ink">
          {t('common.terms')}
        </Link>
      </footer>
    </div>
  );
}

export function DvoteMark() {
  return <DvoteLogo height={20} markColor="var(--color-brand)" className="shrink-0 text-ink" />;
}

export function Button({
  busy,
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; variant?: 'primary' | 'outline' | 'ghost' | 'dark' }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={cx(
        'inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-semibold transition-[background,opacity,transform] active:scale-[0.99] disabled:opacity-50',
        variant === 'primary' && 'bg-brand text-ink hover:bg-brand-hover',
        variant === 'dark' && 'bg-ink text-white hover:bg-ink/90',
        variant === 'outline' && 'border border-line bg-white text-ink hover:bg-canvas',
        variant === 'ghost' && 'h-auto py-2 text-[15px] font-medium text-brand-text underline-offset-4 hover:underline',
        className,
      )}
    >
      {busy ? <Loader2 className="size-5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, optional, children }: { label: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-[15px] font-medium">
        {label}
        {optional ? (
          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{t('common.optional')}</span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="text-[13px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'h-13 w-full rounded-2xl border border-transparent bg-canvas px-4 text-[17px] outline-none placeholder:text-muted/70 focus:border-brand focus:bg-white',
        props.className,
      )}
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-2xl bg-danger/8 px-4 py-3 text-[15px] text-danger">{children}</p>;
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16 text-muted" aria-label={t('common.loading')}>
      <Loader2 className="size-7 animate-spin" />
    </div>
  );
}

/** Logo (or the first letter in the card colours) + the merchant name, like the tappi header. */
export function MerchantHeader({ name, logoUrl, color, ink = '#FFFFFF', title, subtitle }: { name: string; logoUrl: string | null; color: string; ink?: string; title?: string; subtitle?: string }) {
  return (
    <header className="flex flex-col items-center text-center">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-20 rounded-[22px] object-cover shadow-sm" />
      ) : (
        <span className="flex size-20 items-center justify-center rounded-[22px] text-3xl font-bold" style={{ background: color, color: ink }}>
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <p className="mt-4 text-[13px] font-semibold tracking-[0.18em] text-muted uppercase">{name}</p>
      {title ? <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">{title}</h1> : null}
      {subtitle ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p> : null}
    </header>
  );
}

export { cx };
