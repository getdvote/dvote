import { ChatRoundDotsIcon, LetterIcon } from '@solar-icons/react/linear';
import { Card, Container, ExternalLink, IconTile, Section, SectionHeading } from '@/components/common';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { config, whatsappLink } from '@/lib/config';

/** FAQ (general + pricing questions) beside the contact cards. */
export function FaqContact() {
  const { d } = useI18n();
  const items = [...d.faq.items, ...d.pricing.faq];
  const c = d.contact;
  return (
    <Section id="faq">
      <Container className="grid gap-14 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHeading title={d.faq.title} />
          <Accordion type="single" collapsible className="mt-8 border-t border-line">
            {items.map((f, i) => (
              <AccordionItem key={f.q} value={String(i)} className="border-b border-line">
                <AccordionTrigger className="py-5 text-start text-[17px] font-medium hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div id="contact" className="scroll-mt-24 lg:pt-2">
          <div className="lg:sticky lg:top-28">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">{c.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.lead}</p>
            <div className="mt-6 grid gap-3">
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <IconTile icon={ChatRoundDotsIcon} />
                  <div className="min-w-0">
                    <p className="text-[16px]">{c.whatsapp}</p>
                    <p className="mt-0.5 text-[14px] text-muted-foreground">{c.whatsappText}</p>
                    <p className="mt-2 text-[15px]" dir="ltr">
                      {config.whatsappDisplay}
                    </p>
                  </div>
                </div>
                <Button asChild size="md" className="mt-5 h-10 w-full rounded-xl">
                  <ExternalLink href={whatsappLink(c.whatsappMessage)}>{c.whatsappCta}</ExternalLink>
                </Button>
              </Card>
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <IconTile icon={LetterIcon} />
                  <div className="min-w-0">
                    <p className="text-[16px]">{c.email}</p>
                    <p className="mt-0.5 text-[14px] text-muted-foreground">{c.emailText}</p>
                    <a href={`mailto:${config.email}`} className="mt-1.5 inline-block py-0.5 text-[15px] underline decoration-black/20 underline-offset-4 hover:decoration-ink">
                      {config.email}
                    </a>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
