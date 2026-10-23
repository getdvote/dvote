import { ArrowRightIcon } from '@solar-icons/react/linear';
import { Card, Container, Reveal, Section, SectionHeading } from '@/components/common';
import { IPhone } from '@/components/phones';
import { JoinScreen, ReturnScreen, SaveScreen, TapScreen } from '@/components/screens';
import { useI18n } from '@/i18n';

const SCREENS = [TapScreen, JoinScreen, SaveScreen, ReturnScreen];

/** Tap → Join → Save → Return, each with the phone screen cropped at the bottom. */
export function Steps() {
  const { d } = useI18n();
  const s = d.steps;
  return (
    <Section id="how">
      <Container>
        <SectionHeading title={s.title} lead={s.lead} />
        <ol className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {s.items.map((item, i) => {
            const Screen = SCREENS[i];
            return (
              <Reveal as="li" key={item.label} className="relative">
                <Card className="group h-full p-5 transition duration-300 hover:border-ink/25 hover:shadow-[0_24px_50px_-30px_rgb(17_25_12/0.35)] sm:p-6">
                  <p className="flex items-center gap-3 text-[15px] font-semibold text-ink">
                    <span className="flex size-7 items-center justify-center rounded-full border border-black/10 text-[13px] tracking-normal text-ink">{i + 1}</span>
                    {item.label}
                  </p>
                  <div className="mt-5 aspect-[5/6] overflow-hidden rounded-2xl bg-paper pt-[9%]">
                    <IPhone className="mx-auto w-[82%] transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-[4%] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:transform-none">
                      <Screen />
                    </IPhone>
                  </div>
                  <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.01em]">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.text}</p>
                </Card>
                {i < 3 ? (
                  <ArrowRightIcon className="absolute top-[200px] -end-[15px] z-10 hidden size-5 text-black/25 xl:block rtl:rotate-180" aria-hidden />
                ) : null}
              </Reveal>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
