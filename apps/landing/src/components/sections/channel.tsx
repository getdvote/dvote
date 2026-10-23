import { MapPointIcon, SmartphoneIcon } from '@solar-icons/react/linear';
import { Container, IconTile, Reveal, Section, SectionHeading } from '@/components/common';
import { IPhone } from '@/components/phones';
import { IosLockScreen, Notification } from '@/components/screens';
import { useI18n } from '@/i18n';

const ICONS = [MapPointIcon, SmartphoneIcon];

/** "You speak to your customer on their lock screen." */
export function Channel() {
  const { d } = useI18n();
  const c = d.channel;
  return (
    <Section>
      <Container className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <SectionHeading title={c.title} lead={c.lead} />
          <ul className="mt-10 grid gap-7">
            {c.items.map((it, i) => (
              <li key={it.title} className="flex gap-4">
                <IconTile icon={ICONS[i]} />
                <div>
                  <h3 className="text-[17px] font-semibold">{it.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{it.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Reveal className="mx-auto w-full max-w-[320px]">
          <IPhone className="w-full" tone="light">
            <IosLockScreen date={c.date}>
              <Notification className="pop" title={d.wallet.shop} text={c.notifText} time={d.steps.screen.now} />
            </IosLockScreen>
          </IPhone>
        </Reveal>
      </Container>
    </Section>
  );
}
