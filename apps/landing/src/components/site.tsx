import { Check, Menu, MessageCircle, Store, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { fill, useI18n } from '../i18n';
import { config, whatsappLink } from '../lib/config';
import { DvoteLogo } from './dvote-logo';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>{children}</div>;
}

/** Primary (brand), secondary (outline) and light (on the brand band) buttons; links or anchors. */
export function ButtonLink({
  to,
  href,
  variant = 'primary',
  children,
  className,
}: {
  to?: string;
  href?: string;
  variant?: 'primary' | 'secondary' | 'light' | 'onInk';
  children: ReactNode;
  className?: string;
}) {
  const cls = cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-colors',
    variant === 'primary' && 'bg-brand text-ink hover:bg-brand-hover active:bg-brand-pressed',
    variant === 'secondary' && 'border border-ink/15 bg-white text-ink hover:border-ink/40',
    variant === 'light' && 'bg-brand text-ink hover:bg-brand-hover active:bg-brand-pressed',
    variant === 'onInk' && 'border border-canvas/40 bg-transparent text-canvas hover:bg-ink-soft',
    className,
  );
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  const external = href?.startsWith('http') && !href.startsWith(config.merchantUrl);
  return (
    <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

export function SectionTitle({ title, lead, center = true }: { title: string; lead?: string; center?: boolean }) {
  return (
    <div className={cx('max-w-2xl', center && 'mx-auto text-center')}>
      <h2 className="text-[28px] font-bold tracking-tight sm:text-[36px]">{title}</h2>
      {lead ? <p className="mt-3 text-[17px] leading-relaxed text-muted">{lead}</p> : null}
    </div>
  );
}

export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[15px] leading-relaxed">
      <Check className="mt-0.5 size-5 shrink-0 text-brand-text" />
      <span>{children}</span>
    </li>
  );
}

function Header() {
  const { d, language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  const links = [
    { to: '/features', label: d.nav.features },
    { to: '/pricing', label: d.nav.pricing },
    { to: '/contact', label: d.nav.contact },
  ];
  const navCls = ({ isActive }: { isActive: boolean }) =>
    cx('rounded-lg px-3 py-2 text-[15px] font-medium transition-colors', isActive ? 'text-ink underline decoration-brand decoration-[3px] underline-offset-[10px]' : 'text-ink/75 hover:text-ink');
  const switchLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar');

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center py-2" aria-label="dvote">
          <DvoteLogo height={26} className="text-ink" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <button type="button" onClick={switchLanguage} className="rounded-lg px-3 py-2 text-[15px] text-muted hover:text-ink">
            {d.nav.language}
          </button>
          <a href={config.merchantUrl} className="rounded-lg px-3 py-2 text-[15px] font-medium text-ink hover:text-brand-text">
            {d.nav.logIn}
          </a>
          <ButtonLink href={`${config.merchantUrl}/signup`} className="min-h-10 px-4">
            {d.nav.getStarted}
          </ButtonLink>
        </div>
        <button
          type="button"
          className="-me-2 inline-flex size-11 items-center justify-center rounded-lg md:hidden"
          aria-label={open ? d.nav.close : d.nav.menu}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </Container>
      {open ? (
        <div className="border-t border-line bg-white md:hidden">
          <Container className="grid gap-1 py-3">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={navCls}>
                {l.label}
              </NavLink>
            ))}
            <a href={config.merchantUrl} className="rounded-lg px-3 py-2 text-[15px] font-medium">
              {d.nav.logIn}
            </a>
            <button type="button" onClick={switchLanguage} className="rounded-lg px-3 py-2 text-start text-[15px] text-muted">
              {d.nav.language}
            </button>
            <ButtonLink href={`${config.merchantUrl}/signup`} className="mt-2">
              {d.nav.getStarted}
            </ButtonLink>
          </Container>
        </div>
      ) : null}
    </header>
  );
}

function Footer() {
  const { d } = useI18n();
  const year = new Date().getFullYear();
  const linkCls = 'text-[15px] text-muted hover:text-ink';
  return (
    <footer className="border-t border-line bg-white">
      <Container className="grid gap-10 py-12 sm:grid-cols-3">
        <div>
          <DvoteLogo height={24} className="text-ink" />
          <p className="mt-3 max-w-xs text-[15px] text-muted">{d.footer.tagline}</p>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-sm font-semibold">{d.footer.product}</p>
          <Link to="/features" className={linkCls}>{d.nav.features}</Link>
          <Link to="/pricing" className={linkCls}>{d.nav.pricing}</Link>
          <a href={config.merchantUrl} className={linkCls}>{d.nav.logIn}</a>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-sm font-semibold">{d.footer.company}</p>
          <Link to="/contact" className={linkCls}>{d.nav.contact}</Link>
          <a href={`${config.storefrontUrl}/privacy`} className={linkCls}>{d.footer.privacy}</a>
          <a href={`${config.storefrontUrl}/terms`} className={linkCls}>{d.footer.terms}</a>
        </div>
      </Container>
      <Container className="border-t border-line py-6 text-sm text-muted">{fill(d.footer.rights, { year })}</Container>
    </footer>
  );
}

/** The page frame: header, page, footer; back to the top on every page change. */
export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** A picture of the wallet card (not a real pass): the merchant's colour, points, member, QR. */
export function PassMock({ className }: { className?: string }) {
  const { d } = useI18n();
  return (
    <div className={cx('relative mx-auto w-full max-w-[320px]', className)} dir="ltr">
      <div className="absolute -inset-6 -z-10 rounded-[48px] bg-brand/40 blur-3xl" aria-hidden />
      <div className="rounded-[36px] border-[10px] border-ink bg-ink shadow-2xl">
        <div className="overflow-hidden rounded-[26px] bg-[#f2f2f7] p-3 pb-6">
          <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-ink" aria-hidden />
          <div className="rounded-2xl bg-ink p-4 text-canvas shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand text-ink">
                <Store className="size-[18px]" />
              </span>
              <span className="text-[15px] font-semibold">{d.pass.shop}</span>
            </div>
            <p className="mt-5 text-[11px] uppercase tracking-wider text-white/70">{d.pass.points}</p>
            <p className="text-[34px] font-bold leading-none">240</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-4/5 rounded-full bg-brand" />
            </div>
            <p className="mt-1.5 text-[11px] text-white/80">{d.pass.reward}</p>
            <div className="mt-4 flex items-end justify-between text-[11px]">
              <div>
                <p className="uppercase tracking-wider text-white/70">{d.pass.member}</p>
                <p className="text-[13px] font-semibold">Mona Ali</p>
              </div>
              <div className="text-end">
                <p className="uppercase tracking-wider text-white/70">{d.pass.code}</p>
                <p className="font-mono text-[13px] font-semibold">CZW-QNM</p>
              </div>
            </div>
            <div className="mx-auto mt-4 grid size-28 grid-cols-7 gap-0.5 rounded-lg bg-white p-2" aria-hidden>
              {QR.map((on, i) => (
                <span key={i} className={on ? 'rounded-[1px] bg-ink' : ''} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
const QR = '1110111100100110111011010110101011100111001101111010010101110110111110111'.split('').slice(0, 49).map((c) => c === '1');

export function WhatsAppButton({ message, label, variant = 'primary', className }: { message: string; label: string; variant?: 'primary' | 'secondary' | 'light' | 'onInk'; className?: string }) {
  return (
    <ButtonLink href={whatsappLink(message)} variant={variant} className={className}>
      <MessageCircle className="size-5" /> {label}
    </ButtonLink>
  );
}
