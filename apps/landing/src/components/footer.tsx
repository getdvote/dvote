import { ChatRoundDotsIcon } from '@solar-icons/react/linear';
import { Container, ExternalLink } from '@/components/common';
import { DvoteLogo } from '@/components/dvote-logo';
import { Button } from '@/components/ui/button';
import { fill, useI18n } from '@/i18n';
import { config, signupUrl, whatsappLink } from '@/lib/config';
import { usePlans } from '@/lib/plans';

/** The page ends on its one blue block, the rally cry and the offer, then quiet links on white. */
export function Footer() {
  const { d } = useI18n();
  const { trialDays } = usePlans();
  const year = new Date().getFullYear();
  const linkCls = 'py-1 text-[14px] text-muted-foreground transition duration-150 hover:text-ink';
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
    <footer>
      <Container>
        <div className="on-blue rounded-[28px] bg-blue px-6 py-16 text-center sm:py-24">
          <h2 className="mx-auto max-w-[16ch] text-[40px] leading-[1.12] font-semibold tracking-[-0.03em] text-balance sm:text-[64px]">{d.cta.title}</h2>
          <p className="mt-5 text-[17px] sm:text-[18px]">{fill(d.cta.text, { days: trialDays })}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="xl" variant="brand" className="px-7">
              <a href={signupUrl()}>{d.cta.button}</a>
            </Button>
            <Button asChild size="xl" variant="outline" className="border-white/40 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white">
              <ExternalLink href={whatsappLink(d.contact.whatsappMessage)}>
                <ChatRoundDotsIcon aria-hidden />
                {d.cta.talk}
              </ExternalLink>
            </Button>
          </div>
        </div>

        <div className="grid gap-10 pt-14 pb-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <DvoteLogo height={22} markColor="#1F3DFF" spinOnHover className="text-ink" />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted-foreground">{d.footer.tagline}</p>
          </div>
          {columns.map((c) => (
            <div key={c.title} className="grid content-start justify-items-start gap-1">
              <p className="mb-1 text-[13px] font-semibold">{c.title}</p>
              {c.links.map((l) => (
                <ExternalLink key={l.label} href={l.href} className={linkCls}>
                  {l.label}
                </ExternalLink>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-line py-6 text-[13px] text-muted-foreground sm:flex-row sm:justify-between">
          <span>{fill(d.footer.rights, { year })}</span>
          <span className="flex gap-5" dir="ltr">
            <span>{config.whatsappDisplay}</span>
            <span>{config.email}</span>
          </span>
        </div>
      </Container>
    </footer>
  );
}
