import { ChatRoundDotsIcon, LetterIcon } from '@solar-icons/react/linear';
import { Container, ExternalLink, IconTile, Section, SectionHeading } from '@/components/common';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useI18n } from '@/i18n';
import { config, whatsappLink } from '@/lib/config';

/** The heading and the ways to reach us on one side, the questions on the other. */
export function FaqContact() {
  const { d } = useI18n();
  const items = [...d.faq.items, ...d.pricing.faq];
  const c = d.contact;
  return (
    <Section id="faq" className="pt-0 sm:pt-0">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
        <div>
          <div className="lg:sticky lg:top-28">
            <SectionHeading title={d.faq.title} />
            <div id="contact" className="mt-8 scroll-mt-28">
              <p className="text-[18px] font-semibold">{c.title}</p>
              <p className="mt-1.5 max-w-[38ch] text-[15px] leading-relaxed text-muted-foreground">{c.lead}</p>
              <div className="mt-5 grid gap-2.5">
                <ExternalLink href={whatsappLink(c.whatsappMessage)} className="flex items-center gap-3.5 rounded-2xl border border-line p-3.5 transition duration-150 hover:border-ink/30">
                  <IconTile icon={ChatRoundDotsIcon} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{c.whatsapp}</span>
                    <span className="block text-[13px] text-muted-foreground">{c.whatsappText}</span>
                  </span>
                </ExternalLink>
                <a href={`mailto:${config.email}`} className="flex items-center gap-3.5 rounded-2xl border border-line p-3.5 transition duration-150 hover:border-ink/30">
                  <IconTile icon={LetterIcon} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium">{c.email}</span>
                    <span className="block truncate text-[13px] text-muted-foreground" dir="ltr">
                      {config.email}
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
        <Accordion type="single" collapsible className="border-t border-line">
          {items.map((f, i) => (
            <AccordionItem key={f.q} value={String(i)} className="border-b border-line">
              <AccordionTrigger className="py-5 text-start text-[16px] font-medium hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  );
}
