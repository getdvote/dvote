import { SmartphoneVibrationIcon } from '@solar-icons/react/linear';
import { Card, Container, Reveal } from '@/components/common';
import { DvoteLogo } from '@/components/dvote-logo';
import { QrGlyph } from '@/components/screens';
import { useI18n } from '@/i18n';

/** "Your QR stand is free": text + the stand and extra-stand tiles. */
export function Stand() {
  const { d } = useI18n();
  const s = d.stand;
  return (
    <section className="pb-4">
      <Container>
        <Reveal>
          <Card className="grid items-center gap-10 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:p-14">
            <div className="max-w-xl">
              <h2 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[40px]">{s.title}</h2>
              <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
            <div className="flex flex-wrap gap-5 sm:flex-nowrap">
              <figure className="grid justify-items-center gap-3">
                <div className="w-[190px] rounded-2xl border border-line bg-white p-4 shadow-[0_20px_40px_-24px_rgb(17_25_12/0.35)]">
                  <DvoteLogo height={18} className="mx-auto text-ink" />
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <QrGlyph className="w-full" seed={11} />
                    <span className="h-14 w-px bg-black/10" />
                    <span className="flex aspect-square items-center justify-center rounded-full border border-dashed border-black/25 text-ink/70">
                      <SmartphoneVibrationIcon className="size-6" />
                    </span>
                  </div>
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">{s.tap}</p>
                </div>
                <figcaption className="flex items-center gap-2 text-[15px]">
                  {s.standName}
                  <span className="rounded-full bg-ink px-2.5 py-0.5 text-[12px] font-medium text-paper">{s.free}</span>
                </figcaption>
              </figure>
            </div>
          </Card>
        </Reveal>
      </Container>
    </section>
  );
}
