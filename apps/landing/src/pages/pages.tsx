import {
  ArrowRight,
  BellRing,
  ChartColumn,
  ChevronDown,
  Gift,
  Languages,
  Mail,
  MessageCircle,
  QrCode,
  Repeat,
  ScanLine,
  ShieldCheck,
  Store,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { ButtonLink, CheckItem, Container, cx, PassMock, SectionTitle, WhatsAppButton } from '../components/site';
import { fill, useI18n } from '../i18n';
import { config } from '../lib/config';

/** Same order as `features.items` in the dictionaries. */
const FEATURE_ICONS: LucideIcon[] = [Wallet, Gift, Store, BellRing, Users, ChartColumn, ScanLine, UserCog, Languages];
/** dvote brand kit scenes (public/brand, copied from the dashboard), one per step. */
const STEP_ART = ['scan-and-earn', 'welcome', 'reward-unlocked'];
const WHY_ICONS: LucideIcon[] = [Repeat, QrCode, TrendingUp, BellRing];

function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cx('flex size-11 items-center justify-center rounded-xl bg-brand-soft text-ink', className)}>
      <Icon className="size-5" />
    </span>
  );
}

function CtaBand() {
  const { d } = useI18n();
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-12 text-center text-canvas sm:px-12">
          <img src="/brand/patterns/orbit-ink.svg" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50 [mask-image:radial-gradient(ellipse_at_center,transparent_40%,black_85%)]" />
          <div className="relative">
          <h2 className="text-[26px] font-bold tracking-tight sm:text-[32px]">{d.home.ctaTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[17px] text-canvas/80">{d.home.ctaText}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`${config.merchantUrl}/signup`} variant="light">
              {d.home.trialCta}
            </ButtonLink>
            <WhatsAppButton message={d.contact.whatsappMessage} label={d.home.ctaPrimary} variant="onInk" />
          </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function HomePage() {
  const { d } = useI18n();
  return (
    <>
      {/* hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 text-line [mask-image:linear-gradient(to_bottom,black,transparent)]" style={{ backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.75px)', backgroundSize: '24px 24px' }} />
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-[13px] font-semibold text-brand-text">{d.home.eyebrow}</p>
            <h1 className="mt-5 text-[38px] font-extrabold leading-[1.1] tracking-tight sm:text-[52px]">{d.home.title}</h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-muted">{d.home.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`${config.merchantUrl}/signup`}>{d.home.trialCta}</ButtonLink>
              <WhatsAppButton message={d.contact.whatsappMessage} label={d.home.ctaPrimary} variant="secondary" />
            </div>
            <p className="mt-3 text-[14px] text-muted">{d.home.trialNote}</p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-muted">
              {[d.home.noApp, d.home.seconds, d.home.anyPhone].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-brand-text" /> {s}
                </li>
              ))}
            </ul>
          </div>
          <PassMock />
        </Container>
      </section>

      {/* how it works */}
      <section id="how" className="scroll-mt-20 py-16 sm:py-20">
        <Container>
          <SectionTitle title={d.home.howTitle} lead={d.home.howLead} />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {d.home.steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-white p-6">
                <img src={`/brand/illustrations/${STEP_ART[i]}.svg`} alt="" aria-hidden width={640} height={480} loading="lazy" className="mx-auto aspect-[4/3] w-full max-w-[260px] rounded-xl" />
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-ink">{i + 1}</span>
                  <h3 className="text-[19px] font-semibold">{s.title}</h3>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* why */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <SectionTitle title={d.home.whyTitle} />
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {d.home.why.map((w, i) => (
              <div key={w.title} className="flex gap-4 rounded-2xl border border-line bg-canvas p-6">
                <IconTile icon={WHY_ICONS[i]} className="shrink-0" />
                <div>
                  <h3 className="text-[18px] font-semibold">{w.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{w.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* features preview */}
      <section className="py-16 sm:py-20">
        <Container>
          <SectionTitle title={d.home.featuresTitle} />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.features.items.slice(0, 6).map((f, i) => (
              <div key={f.title} className="rounded-2xl border border-line p-5">
                <IconTile icon={FEATURE_ICONS[i]} />
                <h3 className="mt-4 text-[17px] font-semibold">{f.title}</h3>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/features" className="inline-flex items-center gap-2 py-2 text-[15px] font-semibold text-brand-text hover:underline">
              {d.home.featuresLink} <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </Container>
      </section>

      {/* pricing teaser */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <SectionTitle title={d.home.pricingTitle} lead={d.home.pricingText} />
          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {d.pricing.plans.map((p) => (
              <div key={p.name} className="rounded-2xl border border-line bg-canvas p-5 text-center">
                <p className="text-[17px] font-semibold">{p.name}</p>
                <p className="mt-1 text-[15px] text-brand-text">{p.branches}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <ButtonLink to="/pricing" variant="secondary">
              {d.home.pricingLink}
            </ButtonLink>
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}

export function FeaturesPage() {
  const { d } = useI18n();
  return (
    <>
      <section className="py-14 sm:py-20">
        <Container>
          <SectionTitle title={d.features.title} lead={d.features.lead} />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {d.features.items.map((f, i) => (
              <div key={f.title} className="rounded-2xl border border-line bg-white p-6">
                <IconTile icon={FEATURE_ICONS[i]} />
                <h2 className="mt-4 text-[19px] font-semibold">{f.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <section className="py-12">
        <Container>
          <div className="grid items-center gap-10 rounded-3xl bg-ink p-8 text-canvas md:grid-cols-2 md:p-12">
            <div>
              <IconTile icon={ShieldCheck} />
              <h2 className="mt-4 text-[26px] font-bold tracking-tight">{d.features.safetyTitle}</h2>
            </div>
            <ul className="grid gap-3 [&_svg]:text-brand">
              {d.features.safety.map((s) => (
                <CheckItem key={s}>{s}</CheckItem>
              ))}
            </ul>
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}

export function PricingPage() {
  const { d } = useI18n();
  return (
    <>
      <section className="py-14 sm:py-20">
        <Container>
          <SectionTitle title={d.pricing.title} lead={d.pricing.lead} />
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
            {d.pricing.plans.map((p, i) => {
              const popular = i === 1;
              return (
                <div
                  key={p.name}
                  className={cx(
                    'relative flex flex-col gap-0 rounded-3xl border bg-white p-7 [&>a:last-child]:mt-auto',
                    popular ? 'border-ink shadow-xl shadow-ink/10 ring-1 ring-ink' : 'border-line',
                  )}
                >
                  {popular ? (
                    <span className="absolute -top-3 start-7 rounded-full bg-brand px-3 py-1 text-[12px] font-semibold text-ink">{d.pricing.popular}</span>
                  ) : null}
                  <h2 className="text-[22px] font-bold">{p.name}</h2>
                  <p className="mt-1 text-[15px] font-semibold text-brand-text">{p.branches}</p>
                  <p className="mt-3 text-[15px] text-muted">{p.text}</p>
                  {/* until prices are set: "Pricing coming soon" (add "per month" back with a real price) */}
                  <p className="mt-6 mb-6 text-[20px] font-bold">{d.pricing.price}</p>
                  <WhatsAppButton
                    className="w-full"
                    variant={popular ? 'primary' : 'secondary'}
                    label={d.pricing.cta}
                    message={fill(d.pricing.whatsappMessage, { plan: p.name, branches: p.branches })}
                  />
                </div>
              );
            })}
          </div>
          <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-line bg-white p-8">
            <h2 className="text-[20px] font-semibold">{d.pricing.includedTitle}</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {d.pricing.included.map((s) => (
                <CheckItem key={s}>{s}</CheckItem>
              ))}
            </ul>
            <p className="mt-6 text-[14px] text-muted">{d.pricing.billing}</p>
          </div>
        </Container>
      </section>
    </>
  );
}

export function ContactPage() {
  const { d } = useI18n();
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <img src="/brand/illustrations/send-campaign.svg" alt="" aria-hidden width={640} height={480} className="mx-auto mb-6 aspect-[4/3] w-48 sm:w-56" />
        <SectionTitle title={d.contact.title} lead={d.contact.lead} />
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <a
            href={`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(d.contact.whatsappMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-line bg-white p-6 transition-colors hover:border-brand"
          >
            <IconTile icon={MessageCircle} className="shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{d.contact.whatsapp}</p>
              <p className="text-[15px] text-muted" dir="ltr">{config.whatsappDisplay}</p>
            </div>
          </a>
          <a href={`mailto:${config.email}`} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-6 transition-colors hover:border-brand">
            <IconTile icon={Mail} className="shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{d.contact.email}</p>
              <p className="truncate text-[15px] text-muted">{config.email}</p>
            </div>
          </a>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-[26px] font-bold tracking-tight">{d.contact.faqTitle}</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-white">
            {d.contact.faq.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
