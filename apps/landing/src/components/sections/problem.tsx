import { Container, Section, SectionHeading } from '@/components/common';
import { useI18n } from '@/i18n';

/** Why customers don't come back: the owner's problem, in plain lines rather than cards. */
export function Problem() {
  const { d } = useI18n();
  const p = d.problem;
  return (
    <Section>
      <Container className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <SectionHeading title={p.title} lead={p.lead} />
        <ul className="border-t border-line">
          {p.items.map((it) => (
            <li key={it.title} className="border-b border-line py-6">
              <h3 className="text-[19px] font-semibold">{it.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">{it.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
