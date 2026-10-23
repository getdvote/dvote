import { ChatRoundDotsIcon } from '@solar-icons/react/linear';
import { ExternalLink } from '@/components/common';
import { DvoteLogo } from '@/components/dvote-logo';
import { Button } from '@/components/ui/button';
import { fill, useI18n } from '@/i18n';
import { config, signupUrl, whatsappLink } from '@/lib/config';
import { usePlans } from '@/lib/plans';

/** On the ink frame: the closing call to action over the brand orbit, then the links. */
export function Footer() {
  const { d } = useI18n();
  const { trialDays } = usePlans();
  const year = new Date().getFullYear();
  const linkCls = 'py-1 text-[14px] text-paper/60 transition duration-150 hover:text-paper';
  const columns = [
    {
      title: d.footer.product,
      links: [
        { href: '#how', label: d.nav.how },
        { href: '#features', label: d.nav.features },
        { href: '#pricing', label: d.nav.pricing },
        { href: config.merchantUrl, label: d.nav.logIn },
      ],
    },
    {
      title: d.footer.company,
      links: [
        { href: '#contact', label: d.nav.contact },
        { href: whatsappLink(d.contact.whatsappMessage), label: d.footer.help },
        { href: `mailto:${config.email}`, label: d.footer.email },
      ],
    },
    {
      title: d.footer.legal,
      links: [
        { href: `${config.storefrontUrl}/privacy`, label: d.footer.privacy },
        { href: `${config.storefrontUrl}/terms`, label: d.footer.terms },
      ],
    },
  ];

  return (
    <footer className="text-paper">
      <div className="relative isolate overflow-hidden px-5 pt-24 pb-28 text-center sm:pt-32 sm:pb-36">
        <img src="/brand/patterns/orbit-ink.svg" alt="" aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[150%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 opacity-40 [mask-image:radial-gradient(closest-side,black_45%,transparent)]" />
        <h2 className="mx-auto max-w-2xl text-[36px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-[52px]">{d.cta.title}</h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-paper/70">{fill(d.cta.text, { days: trialDays })}</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="xl" variant="brand" className="rounded-xl px-7">
            <a href={signupUrl()}>{d.cta.button}</a>
          </Button>
          <Button asChild size="xl" variant="outline" className="rounded-xl border-paper/20 bg-ink/60 px-6 text-paper backdrop-blur hover:bg-paper/10 hover:text-paper">
            <ExternalLink href={whatsappLink(d.contact.whatsappMessage)}>
              <ChatRoundDotsIcon aria-hidden />
              {d.cta.talk}
            </ExternalLink>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-3 md:px-5">
        <div className="grid gap-10 border-t-2 border-dotted border-paper/15 pt-12 pb-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <DvoteLogo height={22} spinOnHover className="text-paper" />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-paper/60">{d.footer.tagline}</p>
          </div>
          {columns.map((c) => (
            <div key={c.title} className="grid content-start justify-items-start gap-1">
              <p className="mb-1 text-[13px] font-semibold text-paper">{c.title}</p>
              {c.links.map((l) => (
                <ExternalLink key={l.label} href={l.href} className={linkCls}>
                  {l.label}
                </ExternalLink>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t-2 border-dotted border-paper/15 py-6 text-[13px] text-paper/50 sm:flex-row sm:justify-between">
          <span>{fill(d.footer.rights, { year })}</span>
          <span className="flex gap-5" dir="ltr">
            <span>{config.whatsappDisplay}</span>
            <span>{config.email}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
