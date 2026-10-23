import { ArrowRightIcon, CheckCircleIcon } from '@solar-icons/react/linear';
import { useEffect, useRef, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { Button } from '@/components/ui/button';
import { fill, useI18n } from '@/i18n';
import { config, signupUrl } from '@/lib/config';
import { usePlans } from '@/lib/plans';
import { cn } from '@/lib/utils';

export type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

/** Page width: 1200 px max, 20 px gutters on phones, 32 px from md. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-5 md:px-8', className)}>{children}</div>;
}

/** A page section; `id` is the anchor the header links to. */
export function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-20 sm:py-28', className)}>
      {children}
    </section>
  );
}

/** Section heading: semibold, tight, start-aligned like the dashboard's page titles. */
export function SectionHeading({ title, lead, center = false, as: H = 'h2', className }: { title: string; lead?: string; center?: boolean; as?: 'h1' | 'h2'; className?: string }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      <H className={cn('font-semibold tracking-[-0.03em] text-balance', H === 'h1' ? 'text-[40px] leading-[1.05] sm:text-[56px]' : 'text-[32px] leading-[1.1] sm:text-[44px]')}>{title}</H>
      {lead ? <p className="mt-4 text-[17px] leading-relaxed text-pretty text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

/** White rounded card with a faint border. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(17_25_12/0.04)]', className)}>{children}</div>;
}

/** Plain line icon in a small rounded square. */
export function IconTile({ icon: I, className }: { icon: Icon; className?: string }) {
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper text-ink', className)}>
      <I className="size-5" aria-hidden />
    </span>
  );
}

export function CheckItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cn('flex gap-2.5 text-[15px] leading-snug', className)}>
      <CheckCircleIcon className="mt-px size-[18px] shrink-0 text-ink/60" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/** Fades in once it scrolls into view; `.pop` children follow a beat later (styles.css). */
export function Reveal({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      el.dataset.shown = '';
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.shown = '';
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} className={cn('reveal', className)}>{children}</Tag>;
}

/** "Start your 14-day free trial" → merchant sign-up. */
export function TrialButton({ label, className }: { label?: string; className?: string }) {
  const { d } = useI18n();
  const { trialDays } = usePlans();
  return (
    <Button asChild size="xl" variant="brand" className={cn('rounded-xl px-7', className)}>
      <a href={signupUrl()}>{label ?? fill(d.hero.cta, { days: trialDays })}</a>
    </Button>
  );
}

/** "Founding Merchants · 7 of 10 spots left": hidden when the offer is closed or full. */
export function FoundingPill({ className }: { className?: string }) {
  const { d } = useI18n();
  const { founding } = usePlans();
  if (!founding.open || founding.left <= 0) return null;
  const params = { left: founding.left, total: founding.total };
  return (
    <a
      href="#pricing"
      className={cn('group inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white py-1 ps-3 pe-1 text-[13px] font-medium text-ink transition duration-150 hover:border-ink/30', className)}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-brand ring-1 ring-ink/25" aria-hidden />
      <span className="truncate sm:hidden">{fill(d.founding.pillShort, params)}</span>
      <span className="hidden truncate sm:inline">{fill(d.founding.pill, params)}</span>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-paper text-ink transition duration-100 group-hover:bg-ink group-hover:text-paper">
        <ArrowRightIcon className="size-3.5 rtl:rotate-180" aria-hidden />
      </span>
    </a>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const external = href.startsWith('http') && !href.startsWith(config.merchantUrl) && !href.startsWith(config.storefrontUrl);
  return (
    <a href={href} className={className} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}
