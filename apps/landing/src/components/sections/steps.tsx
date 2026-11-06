import { Container, Section, SectionHeading } from '@/components/common';
import { IPhone } from '@/components/phones';
import { JoinScreen, ReturnScreen, SaveScreen, TapScreen } from '@/components/screens';
import { Stand } from '@/components/sections/stand';
import { useI18n } from '@/i18n';

const SCREENS = [TapScreen, JoinScreen, SaveScreen, ReturnScreen];

/** Tap → Join → Save → Return, each with the phone cropped at the bottom of a froth tile, then the free stand. */
export function Steps() {
  const { d } = useI18n();
  const s = d.steps;
  return (
    <Section id="how" className="pt-0 sm:pt-0">
      <Container>
        <SectionHeading title={s.title} lead={s.lead} />
        <ol className="mt-12 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
          {s.items.map((item, i) => {
            const Screen = SCREENS[i];
            return (
              <li key={item.label} className="group">
                <div className="aspect-[5/6] overflow-hidden rounded-[20px] bg-paper pt-[9%]">
                  <IPhone className="mx-auto w-[74%]">
                    <Screen />
                  </IPhone>
                </div>
                <h3 className="mt-5 flex items-start gap-2.5 text-[18px] leading-snug font-semibold">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-medium text-paper">{i + 1}</span>
                  {item.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.text}</p>
              </li>
            );
          })}
        </ol>
        <Stand />
      </Container>
    </Section>
  );
}
