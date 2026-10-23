import { CheckCircleIcon, CloseCircleIcon } from '@solar-icons/react/linear';
import { Card, Container, Reveal, Section, SectionHeading } from '@/components/common';
import { useI18n } from '@/i18n';

/** Today (paper cards, apps) vs with dvote. */
export function Problem() {
  const { d } = useI18n();
  const p = d.problem;
  return (
    <Section className="pt-6 sm:pt-10">
      <Container>
        <SectionHeading title={p.title} lead={p.lead} />
        <Reveal className="mt-12 grid gap-4 md:grid-cols-2">
          <Card className="bg-transparent p-7 sm:p-9">
            <p className="text-[15px] font-semibold text-ink">{p.todayTitle}</p>
            <ul className="mt-6 grid gap-4">
              {p.today.map((t) => (
                <li key={t} className="flex gap-3 text-[16px] text-muted-foreground">
                  <CloseCircleIcon className="mt-0.5 size-5 shrink-0 text-black/25" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-7 sm:p-9">
            <p className="text-[15px] font-semibold">{p.withTitle}</p>
            <ul className="mt-6 grid gap-4">
              {p.with.map((t) => (
                <li key={t} className="flex gap-3 text-[16px]">
                  <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-brand-text" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
